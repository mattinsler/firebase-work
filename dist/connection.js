(function() {
  var Connection, FirebaseConnection, URL, q;

  q = require('q');

  URL = require('url');

  FirebaseConnection = require('./firebase_connection');

  Connection = (function() {
    Connection.cache = {};

    Connection.connect = function(url) {
      var conn, key, root_path;
      conn = FirebaseConnection.connect(url);
      root_path = URL.parse(url).pathname.replace(/^\/+/, '');
      key = [conn.key, root_path].join(':');
      if (this.cache[key] != null) {
        return this.cache[key];
      }
      return this.cache[key] = new Connection({
        key: key,
        fb_connection: conn,
        root_path: root_path
      });
    };

    Connection.prototype._connect = function() {
      var _this = this;
      return this.fb_connection.get().then(function(conn) {
        return _this.promise.resolve(conn.child(_this.root_path));
      })["catch"](function(err) {
        return _this.promise.reject(err);
      });
    };

    function Connection(_arg) {
      var _this = this;
      this.key = _arg.key, this.fb_connection = _arg.fb_connection, this.root_path = _arg.root_path;
      this.promise = q.defer();
      this.server_time_offset = null;
      this.promise.promise.then(function(conn) {
        return conn.root().child('.info/serverTimeOffset').once('value', function(snap) {
          return _this.server_time_offset = snap.val();
        });
      });
      this.__defineGetter__('server_time', function() {
        return new Date(this.server_time_ms);
      });
      this.__defineGetter__('server_time_ms', function() {
        if (this.server_time_offset === null) {
          throw new Error('Cannot access server_time before a connection to Firebase has been established');
        }
        return Date.now() + this.server_time_offset;
      });
      this._connect();
    }

    Connection.prototype.get = function() {
      return this.promise.promise;
    };

    return Connection;

  })();

  module.exports = Connection;

}).call(this);
