var path = require('path');  // path operation


// https://github.com/tlrobinson/long-stack-traces
require('long-stack-traces');


var Launcher = module.exports.Launcher = function (srcPath) {

  // determine session path
  if (srcPath) {
    this.path = path.resolve(srcPath);
    console.log('Opening session', this.path);
  } else {
    this.path = '';
    console.log('Starting empty session.');
  }

  // start session as separate process
  var taskPath = path.resolve(path.join(__dirname, 'session.js'))
    , nodePath = [ path.join(path.dirname(this.path), 'node_modules')
                 , path.join(__dirname,               'node_modules')
                 , process.env['NODE_PATH'] ].join(':');

  new (require('forever-monitor').Monitor)( taskPath,
    { watch:     false
    , spawnWith: { customFds: [ process.stdin.fd
                              , process.stdout.fd
                              , process.stderr.fd ] }
    , env:       { SESSION:   this.path
                 , NODE_PATH: nodePath  } } ).start();
  
};


// entry point
if (require.main === module) {
  var app = new Launcher(process.argv[2]);
};
