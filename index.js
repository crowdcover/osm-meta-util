var zlib = require('zlib');
var request = require('request');
var fs = require('fs');
var expat = require('node-expat');
var Readable = require('stream').Readable;
var util = require('util');
var knex = require('./connection');



util.inherits(MetaUtil, Readable);

function MetaUtil(opts) {
    if (!(this instanceof MetaUtil)) return new MetaUtil(opts);

    opts = opts || {};
    Readable.call(this, opts);

    var that = this;
    //live mode
    this.liveMode = (!opts.start && !opts.end && !opts.delay);

    //collect mode
    this.collectMode = opts.collectMode;
    this.dbschema = opts.dbschema; //allows multiple instances of the tool to store data in the same db under difference schemas
    this.tags = (opts.tags ? opts.tags.split(" ") : []);

    //custom range mode
    this.state = Number(opts.start) || 0;
    this.end = Number(opts.end) || 1;


    this.diff = this.end - this.state + 1;
    this.delay = (opts.delay || 60000);
    this.initialized = true;



    this.baseURL = opts.baseURL || 'http://planet.osm.org/replication/changesets'
    this._changesetAttrs = {}
    this.started = false;

}

MetaUtil.prototype._read = function() {
    var that = this;
    if (!this.started) {
        if (this.liveMode) {
            request.get('http://planet.osm.org/replication/changesets/state.yaml',
            function(err, response, body) {
                that.state = Number(body.substr(body.length - 8));
                that.end = Infinity; //don't stop
                that.delay = 60000; //every minute
                that.run();
                that.started = true;
            }
        );
      } else if(this.collectMode) {
        //get the latest sequence from the DB
        knex.select('sequence').table(this.dbschema + '.sequence')
        .then(function(result){
          var seq = result[0].sequence;
          request.get('http://planet.osm.org/replication/changesets/state.yaml',
          function(err, response, body) {
              that.state =  Number(seq); //start whereever we left off in the database
              that.end = Number(body.substr(body.length - 8)); //end with the latest data
              that.diff = that.end - that.state + 1;
              that.run();
              that.started = true;
          });
        })
        .catch(function (err) {
          console.log(err);
        });

      } else {
            this.run();
            this.started = true;
        }
    }
};

MetaUtil.prototype.run = function() {
    var that = this;
    var numProcessed = 0;

    function queueNext() {
      that.diff -= 1;
      if (that.diff > 0 || that.liveMode) {
        setTimeout(function() {
          next();
        }, that.delay);
      }
    }

    var parserEnd = function(name, attrs) {
        if (name === 'changeset') {


            if (! that._changesetAttrs['comment']) { return; }
            var intersection = []; var j = 0;
            var tags = that._changesetAttrs['comment'].split(/[\s,]+/);
            for (var i=0; i < tags.length; ++i) {
              var t = tags[i];
              if (tags[i] != undefined) { t = t.replace('\%23','#'); }
              if (that.tags.indexOf(t.toLowerCase()) != -1)
                intersection[j++] = t;
            }
            if (j > 0) {
              that._changesetAttrs['comment'] = that._changesetAttrs['comment'].toLowerCase();
              that._changesetAttrs['created_at'] = new Date(that._changesetAttrs['created_at']);
              that._changesetAttrs['closed_at'] = new Date(that._changesetAttrs['closed_at']);

                if(that.collectMode){
                knex(that.dbschema +'.changesets')
                .insert({
                  changeset_id: that._changesetAttrs['id'],
                  username: that._changesetAttrs['user'],
                  closed_at: that._changesetAttrs['closed_at'],
                  num_changes: that._changesetAttrs['num_changes'],
                  comment: that._changesetAttrs['comment'],
                  tag: intersection[j-1]
                }).
                then(function(){
                  console.log(JSON.stringify(that._changesetAttrs) + '\n');
                })
                .catch(function (err) {
                  console.log(err);
                });
              }else{
                that.push(new Buffer(JSON.stringify(that._changesetAttrs) + '\n'), 'ascii');
              }

            }

        }
        if (name === 'osm') {
          queueNext();
          if (!that.liveMode && that.diff === 0) {
              that.push(null);
          }
        }
    };

    var parserStart = function(name, attrs) {
        if (name === 'changeset') {
            if (attrs) {
                that._changesetAttrs = attrs;
            }
        }
        if (name === 'tag' && that._changesetAttrs && that._changesetAttrs.open === 'false') {
            that._changesetAttrs[attrs.k] = attrs.v;
        }

    };
    function next()  {
        //Add padding
        var stateStr = that.state.toString().split('').reverse();
        var diff = 9 - stateStr.length;
        for (var i=0; i < diff; i++) { stateStr.push('0'); }
        stateStr = stateStr.join('');

        //Create URL
        var url = '';
        for (i=0; i<(stateStr.length/3); i++) {
            url += stateStr[i*3] + stateStr[i*3 + 1] + stateStr[i*3 + 2] + '/';
        }

        //XML Parser
        var xmlParser = new expat.Parser('UTF-8');
        xmlParser.on('startElement', parserStart);
        xmlParser.on('endElement', parserEnd);

        //Get YAML state file
        request.get('http://planet.osm.org/replication/changesets/state.yaml',
            function(err, response, body) {
                var nodata = true;
                //If YAML state is bigger, we can get a new file
                if (Number(body.substr(body.length - 8)) >= that.state) {
                    var ss = request.get(that.baseURL + url.split('').reverse().join('') + '.osm.gz')
                        .pipe(zlib.createUnzip())
                        .on('data', function(data) {
                          nodata = (data.length === 0) && nodata;
                        })
                        .on('end', function() {
                          if (nodata) {
                            queueNext();
                            ss.end();
                          }
                        })
                        .pipe(xmlParser);

                    if(that.collectMode){
                      knex(that.dbschema +'.sequence')
                      .update({sequence: that.state})
                      .then(function(){
                        that.state += 1;
                      })
                      .catch(function (err) {
                        console.log(err);
                      });
                    }else{
                      that.state += 1;
                    }

                }
            }
        );
    }
    next();
};

module.exports = MetaUtil
