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
    }

    Worker.prototype.perform = function(job) {
      this.job = job;
      return q().then(this._start.bind(this)).then(this._work.bind(this)).then(this._successful.bind(this))["catch"](this._failure.bind(this)).fin(this._idle.bind(this));
    };

    Worker.prototype._start = function() {
      var _this = this;
      console.log('Worker started job', this.job.ref.name());
      return this.job.set({
        started_at: Firebase.ServerValue.TIMESTAMP
      }).then(function() {
        return _this.job.change_state('started');
      }).then(function() {
        return _this.emit('started', _this.job);
      });
    };

    Worker.prototype._work = function() {
      var context,
        _this = this;
      console.log('Worker performing job', this.job.ref.name());
      context = {
        progress: function(progress) {
          return _this.job.report_progress(progress);
        }
      };
      if (this.work_performer.length === 1) {
        return q.when(this.work_performer.call(context, this.job.data));
      } else if (this.work_performer.length === 2) {
        return q.nfcall(this.work_performer.bind(context), this.job.data);
      } else {
        throw new Error('Queue work performer should either take 1 argument (job_data) and return a promise, or take 2 arguments (job_data, callback) and use the callback');
      }
    };

    Worker.prototype._successful = function() {
      var _this = this;
      console.log('Worker succeeded job', this.job.ref.name());
      return this.job.set({
        succeeded_at: Firebase.ServerValue.TIMESTAMP
      }).then(function() {
        return _this.job.change_state('succeeded');
      }).then(function() {
        return _this.emit('succeeded', _this.job);
      });
    };

    Worker.prototype._failure = function(err) {
      var _this = this;
      console.log('Worker failed job', this.job.ref.name(), ':', err.toString());
      console.log(err.stack);
      return this.job.set({
        failed_at: Firebase.ServerValue.TIMESTAMP,
        last_error: {
          message: err.message,
          stack: err.stack
        }
      }).then(function() {
        return _this.job.change_state('failed');
      }).then(function() {
        return _this.emit('failed', _this.job, err);
      });
    };

    Worker.prototype._idle = function() {
      return this.emit('idle');
    };

    return Worker;

  })(EventEmitter);

  module.exports = Worker;

}).call(this);
