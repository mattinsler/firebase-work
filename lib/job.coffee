q = require 'q'
utils = require './utils'
{EventEmitter} = require 'events'

class Job
  constructor: (@queue) ->
    @emitter = new EventEmitter()
  
  save: ->
    throw new Error('Cannot save a job twice') if @ref?
    
    @data ?= {}
    @meta = {state: 'pending'}
    
    utils.parallel(
      jobs: @queue.jobs.connection
      pending: @queue.pending.connection
    )
    .then (conn) =>
      @ref = conn.jobs.push()
      pending_ref = conn.pending.push()
      @meta.ref = pending_ref.name()
      
      q.all([
        q.ninvoke(@ref, 'set', {data: @data, meta: @meta})
        q.ninvoke(pending_ref, 'set', @ref.name())
      ])
    .then =>
      # now that there's a ref, we can bind
      @__bind__()
  
  inflate: ->
    throw new Error('Cannot inflate Job unless a ref has been set') unless @ref?
    
    d = q.defer()
    
    @ref.once 'value', (snap) =>
      throw new Error('Could not find job ' + @ref.name()) unless snap.val()
      
      @meta = snap.val().meta
      @data = snap.val().data
      d.resolve()
    
    d.promise
  
  # updates data on the server and then locally in the job object
  update_meta: (obj) ->
    q.ninvoke(@ref.child('meta'), 'update', obj)
    .then =>
      @meta[k] = v for k, v of obj
  
  report_progress: (progress) ->
    @update_meta(progress: progress)
  
  __on_meta_value__: (snap) ->
    data = snap.val()
    return unless data?
    
    @__last_meta__ ?= {}
    
    state_change = =>
      return if @__last_meta__.state is data.state
      @__last_meta__.state = data.state
      
      if data.state is 'succeeded' and @__last_meta__.progress? and typeof @__last_meta__.progress is 'number'
        @emitter.emit('progress', 100)
        
      @emitter.emit(data.state)
      switch data.state
        when 'succeeded' then @emitter.emit('done', true)
        when 'failed'    then @emitter.emit('done', false, data.last_error)
      
    progress_change = =>
      return if @__last_meta__.progress is data.progress
      @__last_meta__.progress = data.progress
      
      @emitter.emit('progress', data.progress)
    
    progress_change() if data.state is 'started'
    state_change()
  
  __event_count__: ->
    ['started', 'progress', 'succeeded', 'failed', 'done'].reduce (o, event) =>
      o + EventEmitter.listenerCount(@emitter, event)
    , 0
  
  __bind__: ->
    # for the case when creating a job, ref is filled in later and then calls __bind__
    return unless @ref?
    return if @__bound__
    return if @__event_count__() is 0
    @__bound__ = true
    
    @ref.child('meta').on('value', @__on_meta_value__, @)
  
  __unbind__: ->
    return unless @__bound__
    return unless @__event_count__() is 0
    @__bound__ = false
    
    @ref.child('meta').off('value', @__on_meta_value__, @)
  
  on: (event, cb) ->
    @emitter.on(event, cb)
    
    @__bind__()
  
  off: (event, cb) ->
    if event? and cb?
      @emitter.removeListener(event, cb)
    else if event?
      delete @emitter._events[event]
    else
      @emitter.removeAllListeners()
    
    @__unbind__()

module.exports = Job
