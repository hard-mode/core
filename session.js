var caches  = require('cache-manager')    // caching engine
  , deasync = require('deasync')          // async wrappers
  , fs      = require('fs')               // filesystem ops
  , path    = require('path')             // path operation
  , sandbox = require('sandboxed-module') // module sandbox
  , vm      = require('vm')               // eval isolation
  , Watcher = require('./watcher')        // watch our code
  , wisp    = require('wisp/compiler');   // lispy language


var Session = function (options) {
  
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

  // start cache
  var cache = caches.caching({store: 'memory', max: 100, ttl: 100});
  var get   = deasync(cache.get);

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

      // compute hash value for file contents
      var hash = require('string-hash')(source)
        , key  = "wisp:" + hash + ":" + source.length;

      // try to get cached compiler output
      var cached = get.call(cache, key);
      if (cached) {
        src += cached.item;
      } else {
        // compile and store in cache
        var compiled = wisp.compile(source);
        if (!compiled) throw new Error("Could not compile " + this.filename)
        src += compiled.code;
        cache.set(key, compiled.code, 1000000, function (err) {
          if (err) console.log("CACHERR", err);
        });
      }

      src += "\n;require('source-map-support').install();";

      // watch this file and keep track of its inclusion
      if (included.indexOf(this.filename) === -1) {
        included.push(this.filename);
        watcher.watch(this.filename);
      }

    } else { 

      src += source;

    }

    return src;
  }

}


if (require.main === module) {
  var app = new Session(
    { sessionPath: process.env.SESSION }
  );
}
