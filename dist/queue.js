(function() {
  var Job, Queue, Work, q;

  q = require('q');

  Job = require('./job');

  Work = require('./firebase-work');

  Queue = (function() {
    var Type;

    Queue.Type = Type = (function() {
      function Type(queue, type) {
        this.queue = queue;
        this.type = type;
        this.connection = this.queue.connection.get_child(this.type);
      }

      Type.prototype.count = function() {
        return this.connection.then(function(c) {
          var d;
          d = q.defer();
          c.once('value', function(s) {
            return d.resolve(s.numChildren());
          });
          return d.promise;
        });
      };

      Type.prototype.clear = function() {
        return this.connection.then(function(c) {
          return q.ninvoke(c, 'set', null);
        });
      };

      Type.prototype.pop = function(after_job) {
        var _this = this;
        return this.connection.then(function(c) {
          var d, query;
          d = q.defer();
          query = after_job != null ? c.startAt(void 0, after_job.ref.name()) : c.startAt();
          query.limit(1).on('child_added', function(s) {
            if (s.val() == null) {
              return d.resolve(null);
            }
            return d.resolve(new Job(s.ref(), _this.queue));
          });
          return d.promise;
        });
      };

      return Type;

    })();

    function Queue(root_url) {
      this.root_url = root_url;
      this.connection = Work.connect(this.root_url);
      this.connection.on('connecting', function() {
        return console.log('connecting');
      });
      this.connection.on('connected', function() {
        return console.log('connected');
      });
      this.connection.on('disconnected', function() {
        return console.log('disconnected');
      });
      this.pending = new Queue.Type(this, 'pending');
      this.working = new Queue.Type(this, 'working');
      this.succeeded = new Queue.Type(this, 'succeeded');
      this.failed = new Queue.Type(this, 'failed');
      this.options = {
        claim_ttl: 5000
      };
    }

    Queue.prototype.push = function(job_data) {
      var _this = this;
      return this.pending.connection.then(function(c) {
        var job, ref;
        ref = c.push();
        job = new Job(ref, _this);
        return q.ninvoke(ref, 'set', job_data);
      });
    };

    return Queue;

  })();

  module.exports = Queue;

}).call(this);
