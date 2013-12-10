(function() {
  var Connection, EventEmitter, Firebase, URL, q,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  q = require('q');

  URL = require('url');

  Firebase = require('firebase');

  EventEmitter = require('events').EventEmitter;

  Connection = (function(_super) {
    __extends(Connection, _super);

    function Connection(url) {
      var _this = this;
      this.url = url;
      this.state = 'disconnected';
      this.cache = {};
      this.server_time_offset = null;
      this.on('connected', function() {
        return _this.connection.root().child('.info/serverTimeOffset').once('value', function(s) {
          return _this.server_time_offset = s.val();
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
    }

    Connection.prototype.__change_state__ = function(new_state) {
      this.state = new_state;
      return this.emit(new_state, this);
    };

    Connection.prototype.get_child = function(name) {
      var _this = this;
      return this.get_connection().then(function(c) {
        return _this.cache[name] = c.child(name);
      });
    };

    Connection.prototype.get_connection = function() {
      var auth, c, d, url,
        _this = this;
      if (this.status === 'connected') {
        return q(this.connection);
      }
      if (this.state === 'connecting') {
        d = q.defer();
        this.once('connected', function() {
          return d.resolve(_this.connection);
        });
        return d.promise;
      }
      this.__change_state__('connecting');
      url = URL.parse(this.url);
      auth = url.auth;
      delete url.auth;
      c = new Firebase(URL.format(url));
      if (auth == null) {
        this.__change_state__('connected');
        return q(c);
      }
      d = q.defer();
      c.auth(auth.split(':')[1], function(err, auth_data) {
        if (err != null) {
          return d.reject(err);
        }
        _this.connection = c;
        _this.__change_state__('connected');
        return d.resolve(_this.connection);
      });
      return d.promise;
    };

    return Connection;

  })(EventEmitter);

  module.exports = Connection;

}).call(this);
