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

      Type.prototype.pop = function(after_name) {
        var _this = this;
        return this.connection.then(function(c) {
          var d, query;
          d = q.defer();
          query = after_name != null ? c.startAt(null, after_name + ' ') : c.startAt();
          query.limit(1).once('child_added', function(snap) {
            if (snap.val() == null) {
              return d.resolve(null);
            }
            return d.resolve(snap);
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
      this.jobs = new Queue.Type(this, 'jobs');
      this.pending = new Queue.Type(this, 'pending');
      this.started = new Queue.Type(this, 'started');
      this.succeeded = new Queue.Type(this, 'succeeded');
      this.failed = new Queue.Type(this, 'failed');
      this.options = {
        claim_ttl: 5000
      };
    }

    Queue.prototype.push = function(job_data) {
      var job;
      job = new Job(this);
      job.data = job_data;
      job.save();
      return job;
    };

    return Queue;

  })();

  module.exports = Queue;

}).call(this);
