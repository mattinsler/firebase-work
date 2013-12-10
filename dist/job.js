(function() {
  var Firebase, Job, q;

  q = require('q');

  Firebase = require('firebase');

  Job = (function() {
    function Job(ref, queue) {
      this.ref = ref;
      this.queue = queue;
    }

    Job.prototype.claim = function() {
      var claim, complete, d,
        _this = this;
      d = q.defer();
      claim = function(claimed_at) {
        var claimed_ago;
        if (claimed_at == null) {
          return Firebase.ServerValue.TIMESTAMP;
        }
        claimed_ago = _this.queue.connection.server_time - claimed_at;
        if (claimed_ago > _this.queue.options.claim_ttl) {
          return Firebase.ServerValue.TIMESTAMP;
        }
      };
      complete = function(err, committed, snap) {
        if (err != null) {
          return d.reject(err);
        }
        if (committed) {
          return _this.ref.once('value', function(snap) {
            _this.data = snap.val();
            return d.resolve(true);
          });
        } else {
          return d.resolve(false);
        }
      };
      this.ref.child('__claimed_at__').transaction(claim, complete, false);
      return d.promise;
    };

    Job.prototype.work = function() {
      return this.move_to('working');
    };

    Job.prototype.move_to = function(other_queue_type) {
      var current_ref,
        _this = this;
      current_ref = this.ref;
      return this.queue[other_queue_type].connection.then(function(c) {
        _this.ref = c.child(current_ref.name());
        return q.ninvoke(_this.ref, 'set', _this.data);
      }).then(function() {
        return q.ninvoke(current_ref, 'remove');
      });
    };

    Job.prototype.update = function(obj) {
      var _this = this;
      return q.ninvoke(this.ref, 'update', obj).then(function() {
        var k, v, _results;
        _results = [];
        for (k in obj) {
          v = obj[k];
          _results.push(_this.data[k] = v);
        }
        return _results;
      });
    };

    return Job;

  })();

  module.exports = Job;

}).call(this);
