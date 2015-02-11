var forever = require('forever-monitor') // runs eternally
  , path    = require('path')            // path operation
  , redis   = require('./redis.js')      // redis launcher


// https://github.com/tlrobinson/long-stack-traces
require('long-stack-traces');


var SessionLauncher = module.exports.SessionLauncher = function (srcPath) {

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
  redis(function (err, redis) {

    // clean up
    redis.clients.data.del('session');

    // start session as separate process
    var taskPath = path.resolve(path.join(__dirname, 'session.js'));

    var task =
      { path:    taskPath
      , monitor: new (forever.Monitor)
        ( taskPath
        , { env:
            { REDIS:     redis.port
            , SESSION:   this.path
            , NODE_PATH: path.join(path.dirname(this.path), 'node_modules') + ':' +
                         path.join(__dirname, '..', 'node_modules')         + ':' +
                         process.env['NODE_PATH']} } ) };
    task.monitor.start();

    // restart session when something has been updated
    redis.clients.bus.subscribe('reload');
    redis.clients.bus.on('message', function (channel, message) {
      console.log('---> Reload session');
      task.monitor.restart();
    });

    // load session
    setTimeout(function(){
      if (this.path) redis.clients.data.publish('session-open', this.path);
    }.bind(this), 1000);
 
  }.bind(this));
  
};


// entry point
if (require.main === module) {
  var app = new SessionLauncher(process.argv[2]);
};
