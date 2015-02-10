var fs    = require('fs')             // filesystem ops
  , path  = require('path')           // path operation
  , redis = require('redis')          // fast datastore
  , vm    = require('vm')             // eval isolation
  , wisp  = require('wisp/compiler'); // lispy language


var Module = require('module');


var SessionLauncher = function () {
  
  this.data = redis.createClient(process.env.REDIS, '127.0.0.1', {});
  this.bus  = redis.createClient(process.env.REDIS, '127.0.0.1', {});

  this.path = process.env.SESSION;
  var mod   = this.module = new Module(this.path);

  this.context =
    { module:     mod
    , exports:    mod.exports
    , __filename: this.path
    , __dirname:  path.dirname(this.path)
    , require:    function (spec) { return mod.require(spec) }
    , console:    console
    , process:    { env: process.env }
    , globals:    { process: process
                  , data:    this.data } };

  this.sandbox = vm.createContext(this.context);

  this.bus.subscribe('updated');
  this.bus.on('message', function (channel, message) {
    if (channel === 'updated' && message === 'session') {
      this.data.get('session', function (err, sessionCode) {

        if (err) throw err;
        if (!sessionCode) return;

        // evaluate your actual session code
        var m = vm.createScript(sessionCode, this.path);
        m.runInNewContext(this.context)

        // let the world know we're running
        this.data.publish('session', 'start');

      }.bind(this));
    }
  }.bind(this));

}


if (require.main === module) {
  var app = new SessionLauncher();
}
