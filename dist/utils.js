(function() {
  var q;

  q = require('q');

  exports.fix_key = function(key) {
    var a;
    a = key.split('/').map(function(k) {
      return k.split('').map(function(c) {
        var _ref;
        if ((_ref = c[0]) === '.' || _ref === '$' || _ref === '[' || _ref === ']' || _ref === '#' || _ref === '/') {
          return '%' + Buffer([c.charCodeAt(0)]).toString('hex');
        }
        return c[0];
      }).join('');
    }).join('/');
    return a;
  };

  exports.parallel = function(obj) {
    var res;
    res = {};
    return q.all(Object.keys(obj).map(function(k) {
      return q.when(obj[k]).then(function(v) {
        return res[k] = v;
      });
    })).then(function() {
      return res;
    });
  };

}).call(this);
