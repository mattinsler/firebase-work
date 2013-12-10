q = require 'q'
Firebase = require 'firebase'

class Job
  # @data will have the job data after claimed
  constructor: (@ref, @queue) ->
  
  claim: ->
    d = q.defer()
    
    claim = (claimed_at) =>
      return Firebase.ServerValue.TIMESTAMP unless claimed_at?
      
      claimed_ago = @queue.connection.server_time - claimed_at
      return Firebase.ServerValue.TIMESTAMP if claimed_ago > @queue.options.claim_ttl
    
    complete = (err, committed, snap) =>
      return d.reject(err) if err?
      
      if committed
        @ref.once 'value', (snap) =>
          @data = snap.val()
          d.resolve(true)
      else
        d.resolve(false)
    
    @ref.child('__claimed_at__').transaction(claim, complete, false)
    d.promise
  
  work: ->
    @move_to('working')
  
  move_to: (other_queue_type) ->
    current_ref = @ref
    
    # could do something with onDisconnect here to ensure it doesn't
    # get caught in a weird state where it's on both queues at once
    @queue[other_queue_type].connection.then (c) =>
      @ref = c.child(current_ref.name())
      q.ninvoke(@ref, 'set', @data)
    .then =>
      q.ninvoke(current_ref, 'remove')
  
  # updates data on the server and then locally in the job object
  update: (obj) ->
    q.ninvoke(@ref, 'update', obj)
    .then =>
      @data[k] = v for k, v of obj

module.exports = Job
