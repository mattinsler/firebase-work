q = require 'q'
URL = require 'url'
Firebase = require('firebase')
{EventEmitter} = require 'events'

class Connection extends EventEmitter
  constructor: (@url) ->
    @state = 'disconnected'
    @cache = {}
    @server_time_offset = null
    
    @on 'connected', =>
      @connection.child('.info/serverTimeOffset').once 'value', (s) =>
        @server_time_offset = s.val()
    
    @__defineGetter__ 'server_time', ->
      new Date(@server_time_ms)
    @__defineGetter__ 'server_time_ms', ->
      throw new Error('Cannot access server_time before a connection to Firebase has been established') if @server_time_offset is null
      Date.now() + @server_time_offset
  
  __change_state__: (new_state) ->
    @state = new_state
    @emit(new_state, @)
  
  get_child: (name) ->
    @get_connection()
    .then (c) =>
      @cache[name] = c.child(name)
  
  get_connection: ->
    return q(@connection) if @status is 'connected'
    
    if @state is 'connecting'
      d = q.defer()
      @once 'connected', =>
        d.resolve(@connection)
      return d.promise
    
    @__change_state__('connecting')
    
    url = URL.parse(@url)
    auth = url.auth
    delete url.auth
    
    c = new Firebase(URL.format(url))
    
    unless auth?
      @__change_state__('connected')
      return q(c)
    
    d = q.defer()
    c.auth auth.split(':')[1], (err, auth_data) =>
      return d.reject(err) if err?
      @connection = c
      @__change_state__('connected')
      d.resolve(@connection)
    d.promise

module.exports = Connection
