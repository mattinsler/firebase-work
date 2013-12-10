(function() {
  var Manager, Worker, q;

  q = require('q');

  Worker = require('./worker');

  Manager = (function() {
    function Manager(queue, work_performer) {
      this.queue = queue;
      this.work_performer = work_performer;
      this.workers = {
        idle: [],
        working: []
      };
    }

    Manager.prototype.start = function() {
      return this.scale(1);
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
          w = new Worker(_this, _this.work_performer);
          _this.watch_worker(w);
          _this.workers.idle.push(w);
          _this.work_next_job();
          return w;
        });
        d.resolve(added);
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

    Manager.prototype.get_next_job = function(after_job) {
      return this.queue.pending.pop(after_job).then(function(job) {
        return job.claim().then(function(claimed) {
          if (!claimed) {
            return next_job(job);
          }
          return job;
        });
      });
    };

    Manager.prototype.work_next_job = function() {
      var worker;
      worker = this.workers.idle.pop();
      if (worker == null) {
        console.log('Error: No worker on the idle queue when one was expected');
        return;
      }
      this.workers.working.push(worker);
      return this.get_next_job().then(function(job) {
        return job.work().then(function() {
          return worker.perform(job);
        });
      });
    };

    return Manager;

  })();

  module.exports = Manager;

}).call(this);
