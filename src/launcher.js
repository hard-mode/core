var path = require('path');  // path operation


// https://github.com/tlrobinson/long-stack-traces
require('long-stack-traces');


var Launcher = module.exports.Launcher = function (srcPath) {

  // determine session path
  if (srcPath) {
    this.path = path.resolve(srcPath);
    console.log('Opening session', this.path);
  } else {
    this.path = '';
    console.log('Starting new session.');
  }

  // launch redis on a free port
  // TODO use pidfiles to reuse redis instance
  // TODO make sure instances don't pile up
  require('./redis')(function (err, redis) {

    // clean up
    redis.clients.data.del('session');

    // start session as separate process
    var taskPath = path.resolve(path.join(__dirname, 'session.js'))
      , task =
        { path:    taskPath
        , monitor: new (require('forever-monitor').Monitor)
          ( taskPath
          , { watch: false
            , env:
              { REDIS:     redis.port
              , SESSION:   this.path
              , NODE_PATH: path.join(path.dirname(this.path), 'node_modules') + ':' +
                           path.join(__dirname, '..', 'node_modules')         + ':' +
                           process.env['NODE_PATH'] } } ) };
    task.monitor.start();
 
  }.bind(this));
  
};


// entry point
if (require.main === module) {
  var app = new Launcher(process.argv[2]);
};
