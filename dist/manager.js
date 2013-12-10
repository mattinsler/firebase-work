(function() {
  var Firebase, Job, Manager, Worker, q;

  q = require('q');

  Job = require('./job');

  Worker = require('./worker');

  Firebase = require('firebase');

  Manager = (function() {
    function Manager(queue, work_performer) {
      this.queue = queue;
      this.work_performer = work_performer;
      this.queue.manager = this;
      this.workers = {
        idle: [],
        working: []
      };
    }

    Manager.prototype.start = function() {
      var _this = this;
      this.connections = {};
      return q.all(['jobs', 'pending', 'started', 'succeeded', 'failed'].map(function(name) {
        return _this.queue[name].connection.then(function(c) {
          return _this.connections[name] = c;
        });
      })).then(function() {
        return _this.scale(5);
      });
    };

    Manager.prototype.scale = function(n_workers) {
      var added, d, diff, removed, w, _i, _results,
        _this = this;
      d = q.defer();
      n_workers = Math.max(0, n_workers);
      diff = n_workers - (this.workers.idle.length + this.workers.working.length);
      if (diff < 0) {
        removed = [];
        while (removed.length < diff) {
          w = this.workers.pop();
          if (w == null) {
            break;
          }
          removed.push(w);
        }
        d.resolve(removed);
      } else if (diff > 0) {
        added = (function() {
          _results = [];
          for (var _i = 0; 0 <= diff ? _i < diff : _i > diff; 0 <= diff ? _i++ : _i--){ _results.push(_i); }
          return _results;
        }).apply(this).map(function(x) {
          w = new Worker(_this.queue, _this.work_performer);
          _this.watch_worker(w);
          _this.workers.idle.push(w);
          return w;
        });
        d.resolve(added);
        this.work_next_job();
      } else {
        d.resolve([]);
      }
      return d.promise;
    };

    Manager.prototype.watch_worker = function(worker) {
      var _this = this;
      return worker.on('idle', function() {
        var idx;
        idx = _this.workers.working.indexOf(worker);
        if (idx === -1) {
          console.log('Error: Worker went idle and was not in the working list');
          return;
        }
        _this.workers.working.splice(idx, 1);
        _this.workers.idle.push(worker);
        return _this.work_next_job();
      });
    };

    Manager.prototype.claim_job = function(job_name) {
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
          if (err.message === 'set') {
            console.log("Error: Claim Transaction had an error (don't fret, this one isn't fatal)");
          } else {
            console.log('Error: Claim Transaction had an error');
            console.log(err.stack);
          }
          return d.resolve(false);
        }
        if (committed) {
          return d.resolve(true);
        }
        return d.resolve(false);
      };
      this.connections.jobs.child(job_name + '/meta/claimed_at').transaction(claim, complete, false);
      return d.promise;
    };

    Manager.prototype.get_next_job = function(after_name) {
      var _this = this;
      return this.queue.pending.pop(after_name).then(function(pending_snap) {
        return _this.claim_job(pending_snap.val()).then(function(claimed) {
          var job;
          if (!claimed) {
            return _this.get_next_job(pending_snap.name());
          }
          job = new Job(_this.queue);
          job.ref = _this.connections.jobs.child(pending_snap.val());
          return job.inflate().then(function() {
            return job;
          });
        });
      });
    };

    Manager.prototype.work_next_job = function() {
      var worker,
        _this = this;
      if (this.workers.idle.length === 0) {
        return;
      }
      worker = this.workers.idle.pop();
      if (worker == null) {
        console.log('Error: No worker on the idle queue when one was expected');
        return;
      }
      this.workers.working.push(worker);
      return this.get_next_job().then(function(job) {
        worker.perform(job);
        return setTimeout(function() {
          return _this.work_next_job();
        });
      });
    };

    return Manager;

  })();

  module.exports = Manager;

}).call(this);
