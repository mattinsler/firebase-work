(function() {
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

}).call(this);
