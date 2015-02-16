var fs      = require('fs')             // filesystem ops
  , path    = require('path')           // path operation
  , redis   = require('redis')          // fast datastore
  , vm      = require('vm')             // eval isolation
  , watcher = require('./watcher')      // watch our code
  , wisp    = require('wisp/compiler'); // lispy language

var Session = function (options) {
  
  var data = redis.createClient(options.redisPort, '127.0.0.1', {});

  data.get('session', function (err, sessionCode) {

    var script = vm.createScript(sessionCode, options.sessionPath)
      , module = new (require('module'))(options.sessionPath);
    script.runInNewContext(
      { module:     module
      , exports:    module.exports
      , __filename: options.sessionPath
      , __dirname:  path.dirname(options.sessionPath)
      , require:    function (spec) { return mod.require(spec) }
      , console:    console
      , process:    { env: process.env } } );

  }.bind(this));

}


if (require.main === module) {
  var app = new Session(
    { redisPort:   process.env.REDIS
    , sessionPath: process.env.SESSION });
}
