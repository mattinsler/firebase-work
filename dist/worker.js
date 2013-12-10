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
      var _this = this;
      return q().then(function() {
        console.log('Worker started job', job.ref.name());
        return job.update({
          __started_at__: Firebase.ServerValue.TIMESTAMP
        }).then(function() {
          return _this.emit('start', job);
        });
      }).then(function() {
        console.log('Worker performing job', job.ref.name());
        if (_this.work_performer.length === 1) {
          return q.when(_this.work_performer(job.data));
        } else if (_this.work_performer.length === 2) {
          return q.nfcall(_this.work_performer, job.data);
        } else {
          throw new Error('Queue work performer should either take 1 argument (job_data) and return a promise, or take 2 arguments (job_data, callback) and use the callback');
        }
      }).then(function() {
        console.log('Worker succeeded job', job.ref.name());
        return job.update({
          __succeeded_at__: Firebase.ServerValue.TIMESTAMP
        }).then(function() {
          return job.move_to('succeeded');
        }).then(function() {
          return _this.emit('success', job);
        });
      })["catch"](function(err) {
        console.log('Worker failed job', job.ref.name(), ':', err.toString());
        console.log(err.stack);
        return job.update({
          __failed_at__: Firebase.ServerValue.TIMESTAMP,
          __last_error__: {
            message: err.message,
            stack: err.stack
          }
        }).then(function() {
          return job.move_to('failed');
        }).then(function() {
          return _this.emit('fail', job, err);
        });
      }).then(function() {
        return _this.emit('idle');
      });
    };

    return Worker;

  })(EventEmitter);

  module.exports = Worker;

}).call(this);
