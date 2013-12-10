(function() {
  var EventEmitter, Firebase, Worker, q,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  q = require('q');

  Firebase = require('firebase');

  EventEmitter = require('events').EventEmitter;

  Worker = (function(_super) {
    __extends(Worker, _super);

    function Worker(queue, work_performer) {
      this.queue = queue;
      this.work_performer = work_performer;
      this.connections = this.queue.manager.connections;
    }

    Worker.prototype.change_job_state = function(job, from_state, to_state) {
      var new_state_ref, old_meta_ref,
        _this = this;
      old_meta_ref = job.meta.ref;
      new_state_ref = this.connections[to_state].push();
      return q.ninvoke(new_state_ref, 'set', job.ref.name()).then(function() {
        return job.update_meta({
          state: to_state,
          ref: new_state_ref.name()
        });
      }).then(function() {
        return q.ninvoke(_this.connections[from_state].child(old_meta_ref), 'remove');
      });
    };

    Worker.prototype.perform = function(job) {
      var _this = this;
      return q().then(function() {
        console.log('Worker started job', job.ref.name());
        return job.update_meta({
          started_at: Firebase.ServerValue.TIMESTAMP
        }).then(function() {
          return _this.change_job_state(job, 'pending', 'started');
        }).then(function() {
          return _this.emit('started', job);
        });
      }).then(function() {
        var context;
        console.log('Worker performing job', job.ref.name());
        context = {
          progress: function(progress) {
            return job.report_progress(progress);
          }
        };
        if (_this.work_performer.length === 1) {
          return q.when(_this.work_performer.call(context, job.data));
        } else if (_this.work_performer.length === 2) {
          return q.nfcall(_this.work_performer.bind(context), job.data);
        } else {
          throw new Error('Queue work performer should either take 1 argument (job_data) and return a promise, or take 2 arguments (job_data, callback) and use the callback');
        }
      }).then(function() {
        console.log('Worker succeeded job', job.ref.name());
        return job.update_meta({
          succeeded_at: Firebase.ServerValue.TIMESTAMP
        }).then(function() {
          return _this.change_job_state(job, 'started', 'succeeded');
        }).then(function() {
          return _this.emit('succeeded', job);
        });
      })["catch"](function(err) {
        console.log('Worker failed job', job.ref.name(), ':', err.toString());
        console.log(err.stack);
        return job.update_meta({
          failed_at: Firebase.ServerValue.TIMESTAMP,
          last_error: {
            message: err.message,
            stack: err.stack
          }
        }).then(function() {
          return _this.change_job_state(job, 'started', 'failed');
        }).then(function() {
          return _this.emit('failed', job, err);
        });
      }).then(function() {
        return _this.emit('idle');
      });
    };

    return Worker;

  })(EventEmitter);

  module.exports = Worker;

}).call(this);
