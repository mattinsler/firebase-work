(function() {
  exports.Connection = require('./connection');

  exports.Job = require('./job');

  exports.Manager = require('./manager');

  exports.Queue = require('./queue');

  exports.Worker = require('./worker');

  exports.connections = {};

  exports.connect = function(url) {
    var URL;
    URL = require('url');
    url = URL.format(URL.parse(url));
    if (exports.connections[url] != null) {
      return exports.connections[url];
    }
    return exports.connections[url] = new exports.Connection(url);
  };

}).call(this);
