(function() {
  var EventEmitter, Job, q, utils;

  q = require('q');

  utils = require('./utils');

  EventEmitter = require('events').EventEmitter;

  Job = (function() {
    function Job(queue) {
      this.queue = queue;
      this.emitter = new EventEmitter();
    }

    Job.prototype.save = function() {
      var _this = this;
      if (this.ref != null) {
        throw new Error('Cannot save a job twice');
      }
      if (this.data == null) {
        this.data = {};
      }
      this.meta = {
        state: 'pending'
      };
      return utils.parallel({
        jobs: this.queue.jobs.connection,
        pending: this.queue.pending.connection
      }).then(function(conn) {
        var pending_ref;
        _this.ref = conn.jobs.push();
        pending_ref = conn.pending.push();
        _this.meta.ref = pending_ref.name();
        return q.all([
          q.ninvoke(_this.ref, 'set', {
            data: _this.data,
            meta: _this.meta
          }), q.ninvoke(pending_ref, 'set', _this.ref.name())
        ]);
      }).then(function() {
        return _this.__bind__();
      });
    };

    Job.prototype.inflate = function() {
      var d,
        _this = this;
      if (this.ref == null) {
        throw new Error('Cannot inflate Job unless a ref has been set');
      }
      d = q.defer();
      this.ref.once('value', function(snap) {
        if (!snap.val()) {
          throw new Error('Could not find job ' + _this.ref.name());
        }
        _this.meta = snap.val().meta;
        _this.data = snap.val().data;
        return d.resolve();
      });
      return d.promise;
    };

    Job.prototype.update_meta = function(obj) {
      var _this = this;
      return q.ninvoke(this.ref.child('meta'), 'update', obj).then(function() {
        var k, v, _results;
        _results = [];
        for (k in obj) {
          v = obj[k];
          _results.push(_this.meta[k] = v);
        }
        return _results;
      });
    };

    Job.prototype.report_progress = function(progress) {
      return this.update_meta({
        progress: progress
      });
    };

    Job.prototype.__on_meta_value__ = function(snap) {
      var data, progress_change, state_change,
        _this = this;
      data = snap.val();
      if (data == null) {
        return;
      }
      if (this.__last_meta__ == null) {
        this.__last_meta__ = {};
      }
      state_change = function() {
        if (_this.__last_meta__.state === data.state) {
          return;
        }
        _this.__last_meta__.state = data.state;
        if (data.state === 'succeeded' && (_this.__last_meta__.progress != null) && typeof _this.__last_meta__.progress === 'number') {
          _this.emitter.emit('progress', 100);
        }
        _this.emitter.emit(data.state);
        switch (data.state) {
          case 'succeeded':
            return _this.emitter.emit('done', true);
          case 'failed':
            return _this.emitter.emit('done', false, data.last_error);
        }
      };
      progress_change = function() {
        if (_this.__last_meta__.progress === data.progress) {
          return;
        }
        _this.__last_meta__.progress = data.progress;
        return _this.emitter.emit('progress', data.progress);
      };
      if (data.state === 'started') {
        progress_change();
      }
      return state_change();
    };

    Job.prototype.__event_count__ = function() {
      var _this = this;
      return ['started', 'progress', 'succeeded', 'failed', 'done'].reduce(function(o, event) {
        return o + EventEmitter.listenerCount(_this.emitter, event);
      }, 0);
    };

    Job.prototype.__bind__ = function() {
      if (this.ref == null) {
        return;
      }
      if (this.__bound__) {
        return;
      }
      if (this.__event_count__() === 0) {
        return;
      }
      this.__bound__ = true;
      return this.ref.child('meta').on('value', this.__on_meta_value__, this);
    };

    Job.prototype.__unbind__ = function() {
      if (!this.__bound__) {
        return;
      }
      if (this.__event_count__() !== 0) {
        return;
      }
      this.__bound__ = false;
      return this.ref.child('meta').off('value', this.__on_meta_value__, this);
    };

    Job.prototype.on = function(event, cb) {
      this.emitter.on(event, cb);
      return this.__bind__();
    };

    Job.prototype.off = function(event, cb) {
      if ((event != null) && (cb != null)) {
        this.emitter.removeListener(event, cb);
      } else if (event != null) {
        delete this.emitter._events[event];
      } else {
        this.emitter.removeAllListeners();
      }
      return this.__unbind__();
    };

    return Job;

  })();

  module.exports = Job;

}).call(this);
