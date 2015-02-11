var forever  = require('forever-monitor') // runs eternally
  , freeport = require('freeport')        // get free ports
  , redis    = require('redis')           // fast datastore


module.exports = function (callback) {

  // get a free port for running a redis server
  freeport(function (err, port) {

    if (err) callback(err, null);

    console.log("Starting Redis on port", port);

    var cache =
      { port: port
      , server:  forever.start(
        ['redis-server', '--port', port],
        { silent:  true
        , pidFile: '/home/epimetheus/redis.pid' } )
      , clients:
        { monitor: redis.createClient(port, '127.0.0.1', {})
        , data:    redis.createClient(port, '127.0.0.1', {})
        , bus:     redis.createClient(port, '127.0.0.1', {})} };

    // start redis activity monitor
    cache.clients.monitor.monitor(function (err, res) {
      if (err) throw err;
      cache.clients.monitor.on('monitor', function (time, args) {
        //if (args[0] === 'publish')   console.log("PUBLISH ::", args.slice(1));
        //if (args[0] === 'subscribe') console.log("SUBSCRIBE ::", args.slice(1));
      });
    }.bind(this));

    callback(null, cache);

  });

};
