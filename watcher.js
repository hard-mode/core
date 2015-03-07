var chokidar = require('chokidar')       // watching files
  , events   = require('events')         // events emitter
  , fs       = require('fs')             // filesystem ops
  , glob     = require('glob')           // glob for files
  , path     = require('path')           // path operation
  , util     = require('util')           // node utilities
  , wisp     = require('wisp/compiler'); // lispy language


var Watcher = module.exports = function (options) {

  // file type handlers
  this.handlers =
    { '.js':   this.compileScripts
    , '.jade': this.compileScripts
    , '.wisp': this.compileSession };

  // modules used in session
  this.modules = {};

  // start watcher
  this.watcher = chokidar.watch(path.join(__dirname, '**', '*'), {});
  this.watcher.on('change', this.onChange.bind(this));

};


util.inherits(Watcher, events.EventEmitter);


Watcher.prototype.watch = function (pattern) {

  console.log("◉", pattern);

  process.nextTick(function () {

    glob(pattern, function (err, files) {

      if (err) throw err;

      if (!(files.length === 1 && files[0] === pattern)) {
        files.map(function (filename) {
          console.log("-", filename);
          this.compileFile(filename);
        }.bind(this));
      }

    });

    this.watcher.add(pattern);

  }.bind(this));

};


Watcher.prototype.onChange = function (filename, filestat) {

  // any changes to src dir of core module
  // trigger reload of watcher and session
  if (path.dirname(filename).indexOf(__dirname) === 0) {
    this.emit('reload', filename);
  } else {
    this.emit('update', filename);
  }

};


Watcher.prototype.compileFile = function (filename) {

  var handler = this.handlers[path.extname(filename)];

  if (!handler) {
    console.log("Don't know what to do with", filename);
    return;
  }

  (handler.bind(this))(filename);

};


Watcher.prototype.compileSession = function () {

  // compiles the (server-side) session script

  console.log('Compiling session:', this.modules['session'].file);

  fs.readFile(
    this.modules['session'].file,
    { encoding: 'utf8' },
    function (err, source) {
      if (err) throw err;
      var compiled = wisp.compile(source);
    }.bind(this)
  );

};


if (require.main === module) {
  var app = new Watcher({ redisPort: process.env.REDIS });
}
