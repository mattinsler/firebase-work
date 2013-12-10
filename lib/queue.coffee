q = require 'q'
Job = require './job'
Work = require './firebase-work'

class Queue
  @Type: class Type
    constructor: (@queue, @type) ->
      @connection = @queue.connection.get_child(@type)
    
    count: ->
      @connection.then (c) ->
        d = q.defer()
        c.once 'value', (s) ->
          d.resolve(s.numChildren())
        d.promise
    
    clear: ->
      @connection.then (c) ->
        q.ninvoke(c, 'set', null)
    
    pop: (after_name) ->
      @connection.then (c) =>
        d = q.defer()
        
        query = if after_name? then c.startAt(null, after_name + ' ') else c.startAt()
        
        query.limit(1).once 'child_added', (snap) =>
          return d.resolve(null) unless snap.val()?
          d.resolve(snap)
        
        d.promise
  
  constructor: (@root_url) ->
    @connection = Work.connect(@root_url)
    @connection.on('connecting', -> console.log('connecting'))
    @connection.on('connected', -> console.log('connected'))
    @connection.on('disconnected', -> console.log('disconnected'))
    
    @jobs = new Queue.Type(@, 'jobs')
    @pending = new Queue.Type(@, 'pending')
    @started = new Queue.Type(@, 'started')
    @succeeded = new Queue.Type(@, 'succeeded')
    @failed = new Queue.Type(@, 'failed')
    
    @options = 
      claim_ttl: 5000
  
  push: (job_data) ->
    job = new Job(@)
    job.data = job_data
    job.save()
    job

module.exports = Queue
