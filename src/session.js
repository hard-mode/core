var fs    = require('fs')             // filesystem ops
  , path  = require('path')           // path operation
  , redis = require('redis')          // fast datastore
  , vm    = require('vm')             // eval isolation
  , wisp  = require('wisp/compiler'); // lispy language


var SessionLauncher = function () {
  
  this.data    = redis.createClient(process.env.REDIS, '127.0.0.1', {});
  this.bus     = redis.createClient(process.env.REDIS, '127.0.0.1', {});
  this.path    = process.env.SESSION;
  this.context = { exports: {}
                 , globals: { process: process
                            , console: console
                            , require: require
                            , data:    this.data } };
  this.sandbox = vm.createContext(this.context);

  this.bus.subscribe('updated');
  this.bus.subscribe('session-open');

  this.bus.on('message', function (channel, message) {
    if (message === 'session') {
      this.data.get('session', function (err, sessionCode) {

        if (err) throw err;
        if (!sessionCode) return;

        // compile session context
        var compiled = wisp.compile(
          fs.readFileSync(
            path.join(__dirname, 'core.wisp'),
            { encoding: 'utf8' }));

        // evaluate session context
        vm.runInContext(
          compiled.code,
          this.sandbox,
          '<session-context>');

        // evaluate your actual session code
        vm.runInContext(sessionCode, this.sandbox, '<session>');

        // let the world know we're running
        this.data.publish('session', 'start');

      }.bind(this));
    }
  }.bind(this));

}


if (require.main === module) {
  var app = new SessionLauncher();
}
