q = require 'q'
URL = require 'url'
Job = require './job'
Connection = require './connection'

class Queue
  constructor: (url) ->
    @connection = Connection.connect(url)
    @options = 
      claim_ttl: 5000
  
  _get_next: (conn, after) ->
    d = q.defer()
    
    pending = conn.child('pending')
    
    if after?
      if typeof after is 'number'
        query = pending.startAt(after)
      else if typeof after is 'string'
        query = pending.startAt(null, after + ' ')
      else if after.priority? and after.name?
        query = pending.startAt(after.priority, after.name)
      else if after.priority?
        query = pending.startAt(after.priority)
      else if after.name?
        query = pending.startAt(null, after.name + ' ')
    
    query ?= pending.startAt()
    
    query.limit(1).once 'child_added', (snap) ->
      d.resolve(snap)
    
    d.promise
  
  next: (after) ->
    @connection.get().then (conn) =>
      @_get_next(conn, after)
  
  push: (data) ->
    job = new Job(@)
    job.save(data)
    job

module.exports = Queue
