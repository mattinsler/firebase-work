q = require 'q'
Worker = require './worker'

class Manager
  constructor: (@queue, @work_performer) ->
    @workers =
      idle: []
      working: []
  
  start: ->
    @scale(1)
  
  scale: (n_workers) ->
    d = q.defer()
    
    n_workers = Math.max(0, n_workers)
    diff = n_workers - (@workers.idle.length + @workers.working.length)
    
    # scale down
    if diff < 0
      removed = []
      # take idle workers first
      while removed.length < diff
        w = @workers.pop()
        break unless w?
        removed.push(w)
      
      # now take running workers
      # tell worker to stop or wait for finish
      d.resolve(removed)
    
    # scale up
    else if diff > 0
      added = [0...diff].map (x) =>
        w = new Worker(@, @work_performer)
        @watch_worker(w)
        @workers.idle.push(w)
        @work_next_job()
        w
      d.resolve(added)
    
    # no scaling
    else
      d.resolve([])
    
    d.promise
  
  watch_worker: (worker) ->
    worker.on 'idle', =>
      idx = @workers.working.indexOf(worker)
      if idx is -1
        console.log 'Error: Worker went idle and was not in the working list'
        return
      @workers.working.splice(idx, 1)
      @workers.idle.push(worker)
      @work_next_job()
  
  get_next_job: (after_job) ->
    @queue.pending.pop(after_job).then (job) ->
      job.claim().then (claimed) ->
        return next_job(job) unless claimed
        job
  
  work_next_job: ->
    worker = @workers.idle.pop()
    unless worker?
      console.log 'Error: No worker on the idle queue when one was expected'
      return
    @workers.working.push(worker)
    
    @get_next_job()
    .then (job) ->
      job.work()
      .then ->
        worker.perform(job)
  
module.exports = Manager
