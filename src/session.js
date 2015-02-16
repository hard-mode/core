var fs      = require('fs')             // filesystem ops
  , path    = require('path')           // path operation
  , redis   = require('redis')          // fast datastore
  , vm      = require('vm')             // eval isolation
  , Watcher = require('./watcher')      // watch our code
  , wisp    = require('wisp/compiler'); // lispy language

var Session = function (options) {
  
  var data = redis.createClient(options.redisPort, '127.0.0.1', {});

  // run watcher, compiling assets
  // any time the session code changes, end this process
  // and allow launcher to restart it with the new code
  var watcher = new Watcher(options);
  watcher.watch(options.sessionPath);
  watcher.on('reload', function (filepath) {
    console.log();
    process.exit(64);
  })

  // compile session and execude session code
  var compiled = wisp.compile(
    fs.readFileSync(options.sessionPath,
                    { encoding: 'utf8' }));
  var script = vm.createScript(compiled.code, options.sessionPath)
    , module = new (require('module'))(options.sessionPath);
  script.runInNewContext(
    { module:     module
    , exports:    module.exports
    , __filename: options.sessionPath
    , __dirname:  path.dirname(options.sessionPath)
    , require:    function (spec) { return module.require(spec) }
    , console:    console
    , process:    { env: process.env } } );

}


if (require.main === module) {
  var app = new Session(
    { redisPort:   process.env.REDIS
    , sessionPath: process.env.SESSION });
}
