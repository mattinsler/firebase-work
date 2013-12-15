(function() {
  var TaskManager, q;

  q = require('q');

  TaskManager = (function() {
    function TaskManager(opts) {
      if (opts == null) {
        opts = {};
      }
      this.interval = opts.interval || 15 * 1000;
      this.tasks = [];
    }

    TaskManager.prototype.add = function(task_runner) {
      if (!(((task_runner != null ? task_runner.run : void 0) != null) && typeof task_runner.run === 'function')) {
        throw new Error('Task');
      }
      this.tasks.push(task_runner);
      return this;
    };

    TaskManager.prototype.start = function(interval) {
      if (this.running) {
        return;
      }
      this.running = true;
      if (interval != null) {
        this.interval = interval;
      }
      this._run_tasks();
      return this;
    };

    TaskManager.prototype.stop = function() {
      this.running = false;
      if (this.timeout_id != null) {
        clearTimeout(this.timeout_id);
        delete this.timeout_id;
      }
      return this;
    };

    TaskManager.prototype._run_tasks = function() {
      var _this = this;
      if (!this.running) {
        return;
      }
      return q.all(this.tasks.map(function(task) {
        return task.run();
      })).then(function() {
        if (!_this.running) {
          return;
        }
        return _this.timeout_id = setTimeout(function() {
          return _this._run_tasks();
        }, _this.interval);
      });
    };

    return TaskManager;

  })();

  module.exports = TaskManager;

}).call(this);
