q = require 'q'
Firebase = require 'firebase'
{EventEmitter} = require 'events'

BOUND_EVENTS = ['started', 'progress', 'succeeded', 'failed', 'done']

bound_listener_count = (emitter) ->
  BOUND_EVENTS.reduce (o, event) ->
    o + EventEmitter.listenerCount(emitter, event)
  , 0

class Job
  @claim: (queue, job_name) ->
    queue.connection.get().then (conn) =>
      @_claim_job(queue, conn, job_name)
  
  @_claim_job: (queue, conn, job_name) ->
    d = q.defer()
    
    claim = (claimed_at) =>
      return Firebase.ServerValue.TIMESTAMP unless claimed_at?
      
      claimed_ago = queue.connection.server_time_ms - claimed_at
      return Firebase.ServerValue.TIMESTAMP if claimed_ago > queue.options.claim_ttl
    
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
    
    conn.child('jobs/' + job_name + '/meta/claimed_at').transaction(claim, complete, false)
    d.promise
    
  constructor: (@queue) ->
    @_emitter = new EventEmitter()
  
  save: (data) ->
    throw new Error('Cannot save a job twice') if @ref?
    
    @data = data if data?
    @data ?= {}
    @meta = {state: 'pending'}
    
    @queue.connection.get().then(@_save_job.bind(@))
  
  _save_job: (conn) ->
    jobs = conn.child('jobs')
    pending = conn.child('pending')
    
    @ref = jobs.push()
    pending_ref = pending.push()
    @meta.ref = pending_ref.name()
    
    q.all([
      q.ninvoke(@ref, 'set', {data: @data, meta: @meta})
      q.ninvoke(pending_ref, 'set', @ref.name())
    ])
    .then(@_bind.bind(@))
  
  # Fetches meta and data for a job after ref has been set
  hydrate: ->
    throw new Error('Cannot inflate Job unless a ref has been set') unless @ref?
    
    d = q.defer()
    
    @ref.once 'value', (snap) =>
      throw new Error('Could not find job ' + @ref.name()) unless snap.val()
      
      @meta = snap.val().meta
      @data = snap.val().data
      d.resolve()
    
    d.promise
  
  # updates data on the server and then locally in the job object
  set: (obj) ->
    q.ninvoke(@ref.child('meta'), 'update', obj)
    .then =>
      @meta[k] = v for k, v of obj
  
  # could do something with onDisconnect here to ensure it doesn't
  # get caught in a weird state where it's on both queues at once  
  change_state: (to_state) ->
    @queue.connection.get().then (conn) =>
      @_change_job_state(conn, to_state)
  
  _change_job_state: (conn, to_state) ->
    from = conn.child(@meta.state)
    to = conn.child(to_state)
    
    # add to new state
    old_meta_ref = @meta.ref
    new_state_ref = to.push()
    q.ninvoke(new_state_ref, 'set', @ref.name())
    .then =>
      # update job metadata
      @set(
        state: to_state
        ref: new_state_ref.name()
      )
    .then =>
      # remove from old state
      q.ninvoke(from.child(old_meta_ref), 'remove')
  
  report_progress: (progress) ->
    @set(progress: progress)
  
  on: (event, cb) ->
    @_emitter.on(event, cb)
    @_bind()
  
  off: (event, cb) ->
    if event? and cb?
      @_emitter.removeListener(event, cb)
    else if event?
      delete @_emitter._events[event]
    else
      @_emitter.removeAllListeners()
    @_unbind()
  
  _bind: ->
    return unless @ref?
    return if @_emitter.bound
    return if bound_listener_count(@_emitter) is 0
    @_emitter.bound = true
    
    @ref.child('meta').on('value', @_on_meta_change, @)
  
  _unbind: ->
    return unless @_emitter.bound
    return unless bound_listener_count(@_emiiter) is 0
    @_emitter.bound = false
    
    @ref.child('meta').off('value', @_on_meta_change, @)
  
  _on_meta_change: (snap) ->
    data = snap.val()
    return unless data?
    
    @_last_meta ?= {}
    
    state_change = =>
      return if @_last_meta.state is data.state
      @_last_meta.state = data.state
      
      if data.state is 'succeeded' and @_last_meta.progress? and typeof @_last_meta.progress is 'number'
        @_emitter.emit('progress', 100)
        
      @_emitter.emit(data.state)
      switch data.state
        when 'succeeded' then @_emitter.emit('done', true)
        when 'failed'    then @_emitter.emit('done', false, data.last_error)
      
    progress_change = =>
      return if @_last_meta.progress is data.progress
      @_last_meta.progress = data.progress
      
      @_emitter.emit('progress', data.progress)
    
    progress_change() if data.state is 'started'
    state_change()

module.exports = Job
