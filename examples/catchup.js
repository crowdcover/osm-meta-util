var MetaUtil = require('../');

var meta = MetaUtil({
    'delay': 1000,
//    'start': '001287540', //file number
//    'end':   '001288448', //file number
    'start': '001288449',
    'end': '001288591',
    'tags_collection':'changeset_tags',
    'db': 'nepal'
}).pipe(process.stdout) //outputs to console
