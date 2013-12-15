(function() {
  var Firebase, Job, Worker, WorkerManager, q;

  q = require('q');

  Job = require('./job');

  Worker = require('./worker');

  Firebase = require('firebase');

  WorkerManager = (function() {
    function WorkerManager(queue, work_performer) {
      this.queue = queue;
      this.work_performer = work_performer;
      this.workers = {
        idle: [],
        working: []
      };
    }

    WorkerManager.prototype.start = function(n_workers) {
      return this.scale(n_workers || 1);
    };

    WorkerManager.prototype.stop = function() {
      return this.scale(0);
    };

    WorkerManager.prototype.scale = function(n_workers) {
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
          _this._watch_worker(w);
          _this.workers.idle.push(w);
          return w;
        });
        d.resolve(added);
        this._work_next_job();
      } else {
        d.resolve([]);
      }
      return d.promise;
    };

    WorkerManager.prototype._watch_worker = function(worker) {
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
        return _this._work_next_job();
      });
    };

    WorkerManager.prototype._create_job = function(conn, job_name) {
      var job, jobs;
      jobs = conn.child('jobs');
      job = new Job(this.queue);
      job.ref = jobs.child(job_name);
      return job.hydrate().then(function() {
        return job;
      });
    };

    WorkerManager.prototype._get_next_job = function(after_name) {
      var _this = this;
      return this.queue.next(after_name).then(function(pending_snap) {
        if (pending_snap.val() == null) {
          return null;
        }
        return Job.claim(_this.queue, pending_snap.val()).then(function(claimed) {
          if (!claimed) {
            return _this._get_next_job(pending_snap.name());
          }
          return _this.queue.connection.get().then(function(conn) {
            return _this._create_job(conn, pending_snap.val());
          });
        });
      });
    };

    WorkerManager.prototype._work_next_job = function() {
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
      return this._get_next_job().then(function(job) {
        if (job == null) {
          return;
        }
        worker.perform(job);
        return setTimeout(function() {
          return _this._work_next_job();
        });
      });
    };

    return WorkerManager;

  })();

  module.exports = WorkerManager;

}).call(this);
