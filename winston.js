//var path    = require('path')
  //, winston = require('winston')
  //, logPath = path.resolve(path.join(process.cwd(), 'hardmode.log.json'));

//winston.remove(winston.transports.Console);

//winston.add(winston.transports.File, { filename: logPath });

//GLOBAL.log = winston.log;
GLOBAL.log = console.log;

//GLOBAL.info = //console.log =
  //function () { winston.info.call(winston, arguments) };

//process.stdout.pipe({ write: function (msg, enc) { winston.info(message); } });
//process.stderr.pipe({ write: function (msg, enc) { winston.error(message) } });
