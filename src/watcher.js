var events      = require('events')         // events emitter
  , fs          = require('fs')             // filesystem ops
  , gaze        = require('gaze')           // watching files
  , glob        = require('glob')           // glob for files
  , path        = require('path')           // path operation
  , redis       = require('redis')          // fast datastore
  , util        = require('util')           // node utilities
  , wisp        = require('wisp/compiler'); // lispy language


//function DynamicMixinsCompiler () {
    //jade.Compiler.apply(this, arguments);
    //this.dynamicMixins = true;
//}
//util.inherits(DynamicMixinsCompiler, jade.Compiler);


var Watcher = module.exports = function (options) {

  // redis connections
  var data = this.data = redis.createClient(options.redisPort, '127.0.0.1', {});
  var bus  = this.bus  = redis.createClient(options.redisPort, '127.0.0.1', {});

  // file type handlers
  this.handlers =
    { '.js':   this.compileScripts
    , '.jade': this.compileScripts
    , '.wisp': this.compileSession };

  // modules used in session
  this.modules = {};

  // start watcher
  this.gaze = gaze(
    [ path.join(__dirname, '**', '*') ],
    function (err, watcher) {
      if (err) throw err;
      watcher.on('all', this.onWatcherEvent.bind(this));
    }.bind(this));

  // listen for messages over redis
  this.bus.subscribe('using');
  this.bus.subscribe('watch');
  this.bus.subscribe('session-open');
  this.bus.on('message', function (channel, message) {
    if (this.onMessage[channel]) {
      (this.onMessage[channel].bind(this))(message);
    }
  }.bind(this));

};


util.inherits(Watcher, events.EventEmitter);


Watcher.prototype.watch = function (pattern) {

  console.log("Watching", pattern);

  var files = glob.sync(pattern);

  if (!(files.length === 1 && files[0] === pattern)) {
    files.map(function (filename) {
      console.log("-", filename);
      this.compileFile(filename);
    }.bind(this));
  }

  this.gaze.add(pattern);

};


Watcher.prototype.onMessage = {

  'session-open': function (message) {
    console.log("OPEN", message);
    var s = this.modules['session'] =
      { dir:  path.dirname(message)
      , file: message };
    //s.glob = path.join(s.dir, '**', '*');
    s.glob = path.join(s.dir, '*.wisp');
    console.log(s.glob);
    this.gaze.add(s.glob);

    this.compileSession();
  },

  'watch': function (pattern) {
    this.watch(pattern);
  },

  'using': function (message) {
    var modules = message.split(',');
    for (var i in modules) {
      var module = modules[i]
        , dir    = path.resolve(path.join('modules', module));
      this.modules[module] =
        { dir:  dir
        , glob: path.join(dir, '**', '*') }
      this.gaze.add(this.modules[module].glob);
    }

    this.compileScripts();
    this.compileStyles();
  }

};


Watcher.prototype.onWatcherEvent = function (event, filepath) {

  // any changes to src dir of core module
  // trigger reload of watcher and session
  if (path.dirname(filepath).indexOf(__dirname) === 0) {
    this.emit('reload', filepath);
  } else {
    this.emit('update', filepath);
  }

};


Watcher.prototype.compileFile = function (filepath) {

  var handler = this.handlers[path.extname(filepath)];

  if (!handler) {
    console.log("Don't know what to do with", filepath);
    return;
  }

  (handler.bind(this))(filepath);

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
      this.data.set('session', compiled.code);
      this.data.publish('updated', 'session');
    }.bind(this)
  );

};


if (require.main === module) {
  var app = new Watcher({ redisPort: process.env.REDIS });
}
