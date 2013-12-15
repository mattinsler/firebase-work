(function() {
  var Connection, Job, Queue, URL, q;

  q = require('q');

  URL = require('url');

  Job = require('./job');

  Connection = require('./connection');

  Queue = (function() {
    function Queue(url) {
      this.connection = Connection.connect(url);
      this.options = {
        claim_ttl: 5000
      };
    }

    Queue.prototype._get_next = function(conn, after) {
      var d, pending, query;
      d = q.defer();
      pending = conn.child('pending');
      if (after != null) {
        if (typeof after === 'number') {
          query = pending.startAt(after);
        } else if (typeof after === 'string') {
          query = pending.startAt(null, after + ' ');
        } else if ((after.priority != null) && (after.name != null)) {
          query = pending.startAt(after.priority, after.name);
        } else if (after.priority != null) {
          query = pending.startAt(after.priority);
        } else if (after.name != null) {
          query = pending.startAt(null, after.name + ' ');
        }
      }
      if (query == null) {
        query = pending.startAt();
      }
      query.limit(1).once('child_added', function(snap) {
        return d.resolve(snap);
      });
      return d.promise;
    };

    Queue.prototype.next = function(after) {
      var _this = this;
      return this.connection.get().then(function(conn) {
        return _this._get_next(conn, after);
      });
    };

    Queue.prototype.push = function(data) {
      var job;
      job = new Job(this);
      job.save(data);
      return job;
    };

    return Queue;

  })();

  module.exports = Queue;

}).call(this);
