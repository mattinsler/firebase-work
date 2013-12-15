(function() {
  var Job, JobStateChangeTask, q;

  q = require('q');

  Job = require('./job');

  JobStateChangeTask = (function() {
    function JobStateChangeTask(queue, opts) {
      this.queue = queue;
      this.opts = opts;
      if (!((this.opts.from != null) && (this.opts.to != null))) {
        throw new Error('JobStateChangeTask requires options to include from and to');
      }
      if ((this.opts.filter != null) && typeof this.opts.filter !== 'function') {
        throw new Error('JobStateChangeTask filter option must be a function');
      }
    }

    JobStateChangeTask.prototype.run = function() {
      var _this = this;
      return this.queue.connection.get().then(function(conn) {
        return q().then(function() {
          return _this._collect_jobs(conn, _this.opts.from);
        }).then(function(job_list) {
          return _this._filter_jobs(conn, job_list);
        }).then(function(job_list) {
          return _this._change_jobs(conn, job_list, _this.opts.to);
        });
      });
    };

    JobStateChangeTask.prototype._collect_jobs = function(conn, state) {
      var d;
      d = q.defer();
      conn.child(state).once('value', function(snap) {
        var job_map;
        job_map = snap.val();
        if (job_map == null) {
          return d.resolve([]);
        }
        return d.resolve(Object.keys(job_map).map(function(state_name) {
          return {
            state: state,
            name: state_name,
            job_name: job_map[state_name]
          };
        }));
      });
      return d.promise;
    };

    JobStateChangeTask.prototype._filter_jobs = function(conn, job_list) {
      var context, list,
        _this = this;
      if (this.opts.filter == null) {
        return job_list;
      }
      list = [];
      context = {
        queue: this.queue,
        opts: this.opts
      };
      return q.all(job_list.map(function(job) {
        var j;
        j = new Job(_this.queue);
        j.ref = conn.child('jobs/' + job.job_name);
        return j.hydrate().then(function() {
          return _this.opts.filter.call(context, j);
        }).then(function(filter_res) {
          if (filter_res) {
            return list.push(job);
          }
        });
      })).then(function() {
        return list;
      });
    };

    JobStateChangeTask.prototype._change_jobs = function(conn, job_list, to_state) {
      var to_conn,
        _this = this;
      console.log('Changing', job_list.length, this.opts.from, 'job(s) to', to_state);
      to_conn = conn.child(to_state);
      return q.all(job_list.map(function(job) {
        return _this._change_job_state(conn, job, to_state);
      }));
    };

    JobStateChangeTask.prototype._change_job_state = function(conn, job, to_state) {
      var to_ref;
      to_ref = conn.child(to_state).push();
      return q.ninvoke(to_ref, 'set', job.job_name).then(function() {
        return q.ninvoke(conn.child('jobs/' + job.job_name + '/meta'), 'update', {
          state: to_state,
          ref: to_ref.name()
        });
      }).then(function() {
        return q.ninvoke(conn.child(job.state + '/' + job.name), 'remove');
      });
    };

    return JobStateChangeTask;

  })();

  module.exports = JobStateChangeTask;

}).call(this);
