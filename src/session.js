var fs      = require('fs')               // filesystem ops
  , path    = require('path')             // path operation
  , redis   = require('redis')            // fast datastore
  , sandbox = require('sandboxed-module') // module sandbox
  , vm      = require('vm')               // eval isolation
  , Watcher = require('./watcher')        // watch our code
  , wisp    = require('wisp/compiler');   // lispy language


var Session = function (options) {
  
  var data = redis.createClient(options.redisPort, '127.0.0.1', {});

  // keep track of files used on the server side
  // changes to those would trigger full reloads
  var included = [options.sessionPath];

  // run watcher, compiling assets
  // any time the session code changes, end this process
  // and allow launcher to restart it with the new code
  var watcher = new Watcher(options);
  watcher.watch(options.sessionPath);
  watcher.on('reload', reload);
  watcher.on('update', function (filePath) {
    if (included.indexOf(filePath) !== -1) reload();
  });

  function reload () {
    console.log();
    process.exit(64);
  }

  // execute session in sandbox
  var session = sandbox.require(
    options.sessionPath,
    { sourceTransformers: { wisp: compileWisp
                          , hash: stripHashBang } }
  );

  function stripHashBang (source) {
    // if the first line of a source file starts with #!,
    // remove that line so that it doesn't break the vm.
    return source.replace(/^#!.*/m, '');
  }

  function compileWisp (source) {
    // make sandboxed `require` calls aware of `.wisp` files
    // but don't add require-time compilation like `wisp.engine.node`
    // leaving it to this very sourceTransformer to handle compilation

    // the newline allows stripHashBang to work
    src = 'require.extensions[".wisp"]=true;\n';

    // 'this' is bound to the sandboxed module instance
    if (path.extname(this.filename) === '.wisp') {

      if (included.indexOf(this.filename) === -1) {
        included.push(this.filename);
        watcher.watch(this.filename);
      }

      var compiled = wisp.compile(source);
      if (!compiled) throw new Error("Could not compile " + this.filename)
      src += compiled.code;
      src += "\n;require('source-map-support').install();";

    } else { 

      src += source;

    }

    return src;
  }

  // compile session and execute in custom context
  //var source   = fs.readFileSync(options.sessionPath, { encoding: 'utf8' })
    //, compiled = wisp.compile(source)
    //, script   = vm.createScript(compiled.code, options.sessionPath)
    //, module   = new (require('module'))(options.sessionPath);
  //script.runInNewContext(
    //{ module:     module
    //, exports:    module.exports
    //, __filename: options.sessionPath
    //, __dirname:  path.dirname(options.sessionPath)
    //, require:    function (spec) { return module.require(spec) }
    //, console:    console
    //, watcher:    watcher
    //, process:    { env: process.env } } );

}


if (require.main === module) {
  var app = new Session(
    { redisPort:   process.env.REDIS
    , sessionPath: process.env.SESSION }
  );
}
