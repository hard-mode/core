var forever  = require('forever-monitor') // runs eternally
  , freeport = require('freeport')        // get free ports
  , path     = require('path')            // path operation
  , redis    = require('redis')           // fast datastore


// https://github.com/tlrobinson/long-stack-traces
require('long-stack-traces');


var Launcher = module.exports = function (srcPath) {

  // determine session path
  if (srcPath) {
    this.path = path.resolve(srcPath);
    console.log('Opening session', this.path);
  } else {
    this.path = '';
    console.log('Starting new session.');
  }

  // get a free port for running a redis server
  freeport(function (err, port) {

    console.log("Starting Redis on port", port);

    var cache = this.cache = {
      server:  forever.start(
        ['redis-server', '--port', port],
        { silent:  true
        , pidFile: '/home/epimetheus/redis.pid' }) };

    // start redis activity monitor
    var mon = this.cache.monitor = redis.createClient(port, '127.0.0.1', {});
    mon.monitor(function (err, res) {
      if (err) throw err;
      mon.on('monitor', this.onMonitor.bind(this));
    }.bind(this));

    // clean up
    var data = this.cache.data = redis.createClient(port, '127.0.0.1', {});
    data.del('session');

    // start tasks
    var env = { REDIS: port, SESSION: this.path };
    Object.keys(this.tasks).map(function (taskName) {
      var task =
        { path:    this.tasks[taskName]
        , monitor: new (forever.Monitor)( this.tasks[taskName], { env: env } )};
      task.monitor.start();
      this.tasks[taskName] = task;
    }.bind(this));

    // restart tasks on command
    var bus = this.cache.bus = redis.createClient(port, '127.0.0.1', {});
    bus.subscribe('reload');
    bus.on('message', function (channel, message) {
      if (message === 'all') {
        Object.keys(this.tasks).map(this.reloadTask.bind(this));
        this.loadSession();
      } else if (this.tasks[message]) {
        this.reloadTask(message);
      }
    }.bind(this));

    // load session
    this.loadSession();
 
  }.bind(this));
  
};


Launcher.prototype.tasks =
  { watcher: path.resolve('./src/watcher.js')
  , session: path.resolve('./src/session.js') };


Launcher.prototype.loadSession = function () {
  setTimeout(function(){
    if (this.path) this.cache.data.publish('session-open', this.path);
  }.bind(this), 1000);
}


Launcher.prototype.reloadTask = function (taskName) {
  console.log('---> Reload', taskName);
  this.tasks[taskName].monitor.restart();
}


Launcher.prototype.onMonitor = function (time, args) {
  if (args[0] === 'publish')   console.log("PUBLISH ::", args.slice(1));
  if (args[0] === 'subscribe') console.log("SUBSCRIBE ::", args.slice(1));
};


// entry point
if (require.main === module) {
  var app = new Launcher(process.argv[2]);
};
