(function() {
  var Firebase, FirebaseConnection, URL, q;

  q = require('q');

  URL = require('url');

  Firebase = require('firebase');

  FirebaseConnection = (function() {
    FirebaseConnection.cache = {};

    FirebaseConnection.connect = function(url) {
      var auth, key, parsed, pass, user, _ref;
      parsed = URL.parse(url);
      delete parsed.pathname;
      key = URL.format(parsed);
      if (this.cache[key] != null) {
        return this.cache[key];
      }
      auth = parsed.auth;
      delete parsed.auth;
      _ref = (auth || ':').split(':'), user = _ref[0], pass = _ref[1];
      if (user && pass) {
        auth = {
          username: user,
          password: pass
        };
      } else if (pass) {
        auth = {
          api_key: pass
        };
      } else {
        auth = null;
      }
      return this.cache[key] = new FirebaseConnection({
        key: key,
        url: URL.format(parsed),
        auth: auth
      });
    };

    FirebaseConnection.prototype._connect = function() {
      var conn,
        _this = this;
      conn = new Firebase(this.url);
      if (this.auth == null) {
        return this.promise.resolve(conn);
      }
      if (this.auth.api_key != null) {
        return conn.auth(this.auth.api_key, function(err, auth_data) {
          if (err != null) {
            return _this.promise.reject(err);
          }
          return _this.promise.resolve(conn);
        });
      } else if ((this.auth.username != null) && (this.auth.password != null)) {
        return this.promise.reject(new Error('username/password authentication is not supported yet'));
      }
    };

    function FirebaseConnection(_arg) {
      this.key = _arg.key, this.url = _arg.url, this.auth = _arg.auth;
      this.promise = q.defer();
      this._connect();
    }

    FirebaseConnection.prototype.get = function() {
      return this.promise.promise;
    };

    return FirebaseConnection;

  })();

  module.exports = FirebaseConnection;

}).call(this);
