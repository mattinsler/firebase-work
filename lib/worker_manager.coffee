q = require 'q'
Job = require './job'
Worker = require './worker'
Firebase = require 'firebase'

class WorkerManager
  constructor: (@queue, @work_performer) ->
    @workers =
      idle: []
      working: []
  
  start: (n_workers) ->
    @scale(n_workers or 1)
  
  stop: ->
    @scale(0)
  
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
        w = new Worker(@queue, @work_performer)
        @_watch_worker(w)
        @workers.idle.push(w)
        w
      d.resolve(added)
      @_work_next_job()
    
    # no scaling
    else
      d.resolve([])
    
    d.promise
  
  _watch_worker: (worker) ->
    worker.on 'idle', =>
      idx = @workers.working.indexOf(worker)
      if idx is -1
        console.log 'Error: Worker went idle and was not in the working list'
        return
      @workers.working.splice(idx, 1)
      @workers.idle.push(worker)
      @_work_next_job()
  
  _create_job: (conn, job_name) ->
    jobs = conn.child('jobs')
    
    job = new Job(@queue)
    job.ref = jobs.child(job_name)
    job.hydrate()
    .then ->
      job
  
  _get_next_job: (after_name) ->
    @queue.next(after_name)
    .then (pending_snap) =>
      return null unless pending_snap.val()?
      
      Job.claim(@queue, pending_snap.val())
      .then (claimed) =>
        return @_get_next_job(pending_snap.name()) unless claimed
        
        @queue.connection.get().then (conn) =>
          @_create_job(conn, pending_snap.val())
  
  _work_next_job: ->
    return if @workers.idle.length is 0
  
    worker = @workers.idle.pop()
    unless worker?
      console.log 'Error: No worker on the idle queue when one was expected'
      return
    @workers.working.push(worker)
    
    @_get_next_job()
    .then (job) =>
      # no job waiting
      return unless job?
      
      worker.perform(job)
      setTimeout => @_work_next_job()

module.exports = WorkerManager
