var child_process = require('child_process')
  , path          = require('path');

// https://github.com/tlrobinson/long-stack-traces
require('long-stack-traces');

// setup logging
require('./winston.js');

var Launcher = module.exports.Launcher = function (srcPath) {

  // determine session path
  if (srcPath) {
    this.path = path.resolve(srcPath);
    log('info', 'Opening session', this.path);
  } else {
    this.path = '';
    log('info', 'Starting empty session.');
  }

  // start session as separate process
  var taskPath = path.resolve(path.join(__dirname, 'session.js'))
    , nodePath = [ path.join(path.dirname(this.path), 'node_modules')
                 , path.join(__dirname,               'node_modules')
                 , process.env['NODE_PATH'] ].join(':');

  //child_process.spawn('node', [taskPath],
    //{ stdio: 'inherit'
    //, env:   { SESSION:   this.path
             //, NODE_PATH: nodePath } });

  new (require('forever-monitor').Monitor)( taskPath,
    { watch:     false
    //, spawnWith: { stdio: "inherit" }
    , env:       { SESSION:   this.path
                 , NODE_PATH: nodePath  } } ).start();
  
};


// entry point
if (require.main === module) {
  var app = new Launcher(process.argv[2]);
};
