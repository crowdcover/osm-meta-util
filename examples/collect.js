var MetaUtil = require('../');

MetaUtil({
    'collectMode': true,
    'dbschema': 'logging',
    'delay': 1000,
    'tags': 'building road school'
}).pipe(process.stdout)
