q = require 'q'
URL = require 'url'
FirebaseConnection = require './firebase_connection'

class Connection
  @cache: {}
  
  @connect: (url) ->
    conn = FirebaseConnection.connect(url)
    root_path = URL.parse(url).pathname.replace(/^\/+/, '')
    
    key = [conn.key, root_path].join(':')
    
    return @cache[key] if @cache[key]?
    
    @cache[key] = new Connection(
      key: key
      fb_connection: conn
      root_path: root_path
    )
  
  _connect: ->
    @fb_connection.get().then (conn) =>
      @promise.resolve(conn.child(@root_path))
    .catch (err) =>
      @promise.reject(err)
  
  constructor: ({@key, @fb_connection, @root_path}) ->
    @promise = q.defer()
    @server_time_offset = null
    
    @promise.promise.then (conn) =>
      conn.root().child('.info/serverTimeOffset').once 'value', (snap) =>
        @server_time_offset = snap.val()
    
    @__defineGetter__ 'server_time', ->
      new Date(@server_time_ms)
    
    @__defineGetter__ 'server_time_ms', ->
      throw new Error('Cannot access server_time before a connection to Firebase has been established') if @server_time_offset is null
      Date.now() + @server_time_offset
    
    @_connect()
  
  get: ->
    @promise.promise

module.exports = Connection
