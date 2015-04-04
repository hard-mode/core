var caches  = require('cache-manager')    // caching engine
  , deasync = require('deasync')          // async wrappers
  , fs      = require('fs')               // filesystem ops
  , path    = require('path')             // path operation
  , sandbox = require('sandboxed-module') // module sandbox
  , vm      = require('vm')               // eval isolation
  , Watcher = require('./watcher')        // watch our code
  , wisp    = require('wisp/compiler');   // lispy language

require('./winston.js');

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
    process.exit(64);
  }

  // start cache
  var cache = caches.caching({store: 'memory', max: 100, ttl: 100});
  var get   = deasync(cache.get);

  // execute session in sandbox
  var session = sandbox.require(
    options.sessionPath,
    { requires: { 'midi':     require('midi')
                , 'node-osc': require('node-osc') }
    , sourceTransformers: { wisp: compileWisp
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

    var filename = this.filename;

    // the newline allows stripHashBang to work
    src = 'require.extensions[".wisp"]=true;\n';

    // 'this' is bound to the sandboxed module instance
    if (path.extname(filename) === '.wisp') {

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

        if (compiled.error) throw new Error(
          "compile error in " + filename + "\n" +
          "  " + compiled.error + "\n");

        if (!compiled) throw new Error(
          "compiler returned nothing for " + filename);

        src += compiled.code;
        cache.set(key, compiled.code, 1000000, function (err) {
          if (err) console.log(
            "error caching " + filename +
            " under " + key, err);
          console.log("cached " + filename + " under " + key);
        });
      }

      src += "\n;require('source-map-support').install();";

      // watch this file and keep track of its inclusion
      if (included.indexOf(filename) === -1) {
        included.push(filename);
        watcher.watch(filename);
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
