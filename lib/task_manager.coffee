q = require 'q'

class TaskManager
  constructor: (opts = {}) ->
    @interval = opts.interval or 15 * 1000
    @tasks = []
  
  add: (task_runner) ->
    throw new Error('Task') unless task_runner?.run? and typeof task_runner.run is 'function'
    @tasks.push(task_runner)
    @
  
  start: (interval) ->
    return if @running
    @running = true
    @interval = interval if interval?
    
    @_run_tasks()
    @
  
  stop: ->
    @running = false
    if @timeout_id?
      clearTimeout(@timeout_id)
      delete @timeout_id
    @
  
  _run_tasks: ->
    return unless @running
    
    q.all(
      @tasks.map (task) ->
        task.run()
    )
    .then =>
      return unless @running
      @timeout_id = setTimeout =>
        @_run_tasks()
      , @interval
    

module.exports = TaskManager
