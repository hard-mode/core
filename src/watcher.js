var browserify  = require('browserify')     // bundle scripts
  , esprima     = require('esprima')        // transform jade
  , escodegen   = require('escodegen')      // jade transform
  , fs          = require('fs')             // filesystem ops
  , gaze        = require('gaze')           // watching files
  , glob        = require('glob')           // glob for files
  , jade        = require('jade')           // html templates
  , path        = require('path')           // path operation
  , redis       = require('redis')          // fast datastore
  , stylus      = require('stylus')         // css preprocess
  , util        = require('util')           // node utilities
  , wisp        = require('wisp/compiler'); // lispy language


function DynamicMixinsCompiler () {
    jade.Compiler.apply(this, arguments);
    this.dynamicMixins = true;
}
util.inherits(DynamicMixinsCompiler, jade.Compiler);


var endsWith = function (a, b) {
  return a.lastIndexOf(b) === (a.length - b.length);
}


var Watcher = module.exports = function () {

  // redis connections
  var data = this.data = redis.createClient(process.env.REDIS, '127.0.0.1', {});
  var bus  = this.bus  = redis.createClient(process.env.REDIS, '127.0.0.1', {});

  // modules used in session
  this.modules = {};

  // start watcher
  this.gaze = gaze(
    [ 'src/**/*' ],
    function (err, watcher) {
      if (err) throw err;
      watcher.on('all', this.onWatcherEvent.bind(this));
    }.bind(this));

  // listen for messages over redis
  this.bus.subscribe('using');
  this.bus.subscribe('session-open');
  this.bus.on('message', function (channel, message) {
    if (this.onMessage[channel]) {
      (this.onMessage[channel].bind(this))(message);
    }
  }.bind(this));

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

  this.data.publish('watcher', event + ':' + filepath);

  // editing any file in the core directory
  // triggers reload of watcher and session
  if (path.dirname(filepath) === __dirname) {
    this.data.publish('reload', 'all');
    return;
  } else {

  if (endsWith(filepath, '.js') || endsWith(filepath, '.jade')) {
    this.compileScripts();
    this.data.publish('reload', 'all');
  } else if (endsWith(filepath, '.styl')) {
    this.compileStyles();
  } else if (endsWith(filepath, '.wisp')) {
    this.compileSession();
    this.data.publish('reload', 'all');
  }

  }

};


Watcher.prototype.compileStyles = function () {

  // compiles master stylesheet

  console.log("Compiling stylesheets.");

  var styl = stylus('');
  styl.set('filename', 'style.css');
  styl.import('modules/global');

  for (var i in this.modules) {
    var d = this.modules[i].dir
      , p = path.join(d, i + '.styl');
    if (fs.existsSync(p)) {
      styl.import(d + '/' + i);
    }
  }

  styl.render(function (err, css) {
    if (err) throw err;
    this.data.set('style', css);
    this.data.publish('updated', 'style');
  }.bind(this));

};


Watcher.prototype.compileScripts = function () {

  // compiles all client-side scripts
  // and bundles them together with browserify

  console.log("Compiling scripts.");

  var br = browserify();

  // add wisp runtime
  br.add(path.resolve(path.join('node_modules', 'wisp', 'engine', 'browser.js')));

  Object.keys(this.modules).map(function(module){

    var moduleDir = this.modules[module].dir;

    // add jade templates
    glob.sync(path.join(moduleDir, '**', '*.jade'))
        .map(function (template) { br.add(template); });

    // add main client script
    // TODO replace with package.json
    var wispPath = path.join(moduleDir, 'client.wisp')
      , jsPath   = path.join(moduleDir, 'client.js');
    if (fs.existsSync(wispPath)) { br.add(wispPath); } else
    if (fs.existsSync(jsPath))   { br.add(jsPath);   }

  }.bind(this));

  // transform, bundle, and store in redis
  br.transform('wispify')
    .transform(require('jadeify'), { compiler: DynamicMixinsCompiler })
    .transform(require('./transform_jade.js'))
    //.transform({ global: true }, 'uglifyify' )
    .bundle(function (err, bundled) {
      if (err) throw err;
      this.data.set('script', bundled);
      this.data.publish('updated', 'scripts');
    }.bind(this));

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
  var app = new Watcher();
}
