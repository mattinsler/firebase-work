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
    
    pop: (after_job) ->
      @connection.then (c) =>
        d = q.defer()
        
        query = if after_job? then c.startAt(undefined, after_job.ref.name()) else c.startAt()
        
        query.limit(1).on 'child_added', (s) =>
          return d.resolve(null) unless s.val()?
          d.resolve(new Job(s.ref(), @queue))
        
        d.promise
  
  constructor: (@root_url) ->
    @connection = Work.connect(@root_url)
    @connection.on('connecting', -> console.log('connecting'))
    @connection.on('connected', -> console.log('connected'))
    @connection.on('disconnected', -> console.log('disconnected'))
    
    @pending = new Queue.Type(@, 'pending')
    @working = new Queue.Type(@, 'working')
    @succeeded = new Queue.Type(@, 'succeeded')
    @failed = new Queue.Type(@, 'failed')
    
    @options = 
      claim_ttl: 5000
  
  push: (job_data) ->
    @pending.connection.then (c) =>
      ref = c.push()
      job = new Job(ref, @)
      q.ninvoke(ref, 'set', job_data)

module.exports = Queue
