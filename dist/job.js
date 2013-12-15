(function() {
  var BOUND_EVENTS, EventEmitter, Firebase, Job, bound_listener_count, q;

  q = require('q');

  Firebase = require('firebase');

  EventEmitter = require('events').EventEmitter;

  BOUND_EVENTS = ['started', 'progress', 'succeeded', 'failed', 'done'];

  bound_listener_count = function(emitter) {
    return BOUND_EVENTS.reduce(function(o, event) {
      return o + EventEmitter.listenerCount(emitter, event);
    }, 0);
  };

  Job = (function() {
    Job.claim = function(queue, job_name) {
      var _this = this;
      return queue.connection.get().then(function(conn) {
        return _this._claim_job(queue, conn, job_name);
      });
    };

    Job._claim_job = function(queue, conn, job_name) {
      var claim, complete, d,
        _this = this;
      d = q.defer();
      claim = function(claimed_at) {
        var claimed_ago;
        if (claimed_at == null) {
          return Firebase.ServerValue.TIMESTAMP;
        }
        claimed_ago = queue.connection.server_time_ms - claimed_at;
        if (claimed_ago > queue.options.claim_ttl) {
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
      conn.child('jobs/' + job_name + '/meta/claimed_at').transaction(claim, complete, false);
      return d.promise;
    };

    function Job(queue) {
      this.queue = queue;
      this._emitter = new EventEmitter();
    }

    Job.prototype.save = function(data) {
      if (this.ref != null) {
        throw new Error('Cannot save a job twice');
      }
      if (data != null) {
        this.data = data;
      }
      if (this.data == null) {
        this.data = {};
      }
      this.meta = {
        state: 'pending'
      };
      return this.queue.connection.get().then(this._save_job.bind(this));
    };

    Job.prototype._save_job = function(conn) {
      var jobs, pending, pending_ref;
      jobs = conn.child('jobs');
      pending = conn.child('pending');
      this.ref = jobs.push();
      pending_ref = pending.push();
      this.meta.ref = pending_ref.name();
      return q.all([
        q.ninvoke(this.ref, 'set', {
          data: this.data,
          meta: this.meta
        }), q.ninvoke(pending_ref, 'set', this.ref.name())
      ]).then(this._bind.bind(this));
    };

    Job.prototype.hydrate = function() {
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

    Job.prototype.set = function(obj) {
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

    Job.prototype.change_state = function(to_state) {
      var _this = this;
      return this.queue.connection.get().then(function(conn) {
        return _this._change_job_state(conn, to_state);
      });
    };

    Job.prototype._change_job_state = function(conn, to_state) {
      var from, new_state_ref, old_meta_ref, to,
        _this = this;
      from = conn.child(this.meta.state);
      to = conn.child(to_state);
      old_meta_ref = this.meta.ref;
      new_state_ref = to.push();
      return q.ninvoke(new_state_ref, 'set', this.ref.name()).then(function() {
        return _this.set({
          state: to_state,
          ref: new_state_ref.name()
        });
      }).then(function() {
        return q.ninvoke(from.child(old_meta_ref), 'remove');
      });
    };

    Job.prototype.report_progress = function(progress) {
      return this.set({
        progress: progress
      });
    };

    Job.prototype.on = function(event, cb) {
      this._emitter.on(event, cb);
      return this._bind();
    };

    Job.prototype.off = function(event, cb) {
      if ((event != null) && (cb != null)) {
        this._emitter.removeListener(event, cb);
      } else if (event != null) {
        delete this._emitter._events[event];
      } else {
        this._emitter.removeAllListeners();
      }
      return this._unbind();
    };

    Job.prototype._bind = function() {
      if (this.ref == null) {
        return;
      }
      if (this._emitter.bound) {
        return;
      }
      if (bound_listener_count(this._emitter) === 0) {
        return;
      }
      this._emitter.bound = true;
      return this.ref.child('meta').on('value', this._on_meta_change, this);
    };

    Job.prototype._unbind = function() {
      if (!this._emitter.bound) {
        return;
      }
      if (bound_listener_count(this._emiiter) !== 0) {
        return;
      }
      this._emitter.bound = false;
      return this.ref.child('meta').off('value', this._on_meta_change, this);
    };

    Job.prototype._on_meta_change = function(snap) {
      var data, progress_change, state_change,
        _this = this;
      data = snap.val();
      if (data == null) {
        return;
      }
      if (this._last_meta == null) {
        this._last_meta = {};
      }
      state_change = function() {
        if (_this._last_meta.state === data.state) {
          return;
        }
        _this._last_meta.state = data.state;
        if (data.state === 'succeeded' && (_this._last_meta.progress != null) && typeof _this._last_meta.progress === 'number') {
          _this._emitter.emit('progress', 100);
        }
        _this._emitter.emit(data.state);
        switch (data.state) {
          case 'succeeded':
            return _this._emitter.emit('done', true);
          case 'failed':
            return _this._emitter.emit('done', false, data.last_error);
        }
      };
      progress_change = function() {
        if (_this._last_meta.progress === data.progress) {
          return;
        }
        _this._last_meta.progress = data.progress;
        return _this._emitter.emit('progress', data.progress);
      };
      if (data.state === 'started') {
        progress_change();
      }
      return state_change();
    };

    return Job;

  })();

  module.exports = Job;

}).call(this);
