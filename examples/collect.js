var MetaUtil = require('../');

MetaUtil({
    'collectMode': true,
    'dbschema': 'logging',
    'delay': 10,
    'tags': '#logging-roads logging-roads #logging-roads-drc logging-roads-drc #logging-roads-car logging-roads-car #logging-roads-cog logging-roads-cog loggingroads loggingroads.org WRI'
}).pipe(process.stdout)
