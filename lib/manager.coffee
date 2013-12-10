q = require 'q'
Job = require './job'
Worker = require './worker'
Firebase = require 'firebase'

class Manager
  constructor: (@queue, @work_performer) ->
    @queue.manager = @
    @workers =
      idle: []
      working: []
  
  start: (n_workers) ->
    @connections = {}
    q.all(
      ['jobs', 'pending', 'started', 'succeeded', 'failed'].map (name) =>
        @queue[name].connection.then (c) =>
          @connections[name] = c
    )
    .then =>
      @scale(n_workers or 1)
  
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
        @watch_worker(w)
        @workers.idle.push(w)
        w
      d.resolve(added)
      @work_next_job()
    
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
  
  claim_job: (job_name) ->
    d = q.defer()
    
    claim = (claimed_at) =>
      return Firebase.ServerValue.TIMESTAMP unless claimed_at?
      
      claimed_ago = @queue.connection.server_time - claimed_at
      return Firebase.ServerValue.TIMESTAMP if claimed_ago > @queue.options.claim_ttl
    
    complete = (err, committed, snap) =>
      if err?
        if err.message is 'set'
          console.log "Error: Claim Transaction had an error (don't fret, this one isn't fatal)"
        else
          console.log 'Error: Claim Transaction had an error'
          console.log err.stack
        return d.resolve(false)
      
      return d.resolve(true) if committed
      d.resolve(false)
    
    @connections.jobs.child(job_name + '/meta/claimed_at').transaction(claim, complete, false)
    d.promise
  
  get_next_job: (after_name) ->
    @queue.pending.pop(after_name)
    .then (pending_snap) =>
      @claim_job(pending_snap.val())
      .then (claimed) =>
        return @get_next_job(pending_snap.name()) unless claimed
        
        job = new Job(@queue)
        job.ref = @connections.jobs.child(pending_snap.val())
        job.inflate()
        .then ->
          job
  
  work_next_job: ->
    return if @workers.idle.length is 0
  
    worker = @workers.idle.pop()
    unless worker?
      console.log 'Error: No worker on the idle queue when one was expected'
      return
    @workers.working.push(worker)
    
    @get_next_job()
    .then (job) =>
      worker.perform(job)
    
      setTimeout => @work_next_job()
  
module.exports = Manager
