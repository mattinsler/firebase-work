q = require 'q'
URL = require 'url'
Firebase = require 'firebase'

class FirebaseConnection
  @cache: {}
  
  @connect: (url) ->
    parsed = URL.parse(url)
    delete parsed.pathname
    key = URL.format(parsed)
    
    return @cache[key] if @cache[key]?
    
    auth = parsed.auth
    delete parsed.auth
    [user, pass] = (auth or ':').split(':')
    if user and pass
      auth =
        username: user
        password: pass
    else if pass
      auth =
        api_key: pass
    else
      auth = null
    
    @cache[key] = new FirebaseConnection(
      key: key
      url: URL.format(parsed)
      auth: auth
    )
  
  _connect: ->
    conn = new Firebase(@url)
    return @promise.resolve(conn) unless @auth?
    
    if @auth.api_key?
      conn.auth @auth.api_key, (err, auth_data) =>
        return @promise.reject(err) if err?
        @promise.resolve(conn)
    else if @auth.username? and @auth.password?
      @promise.reject(new Error('username/password authentication is not supported yet'))
  
  constructor: ({@key, @url, @auth}) ->
    @promise = q.defer()
    @_connect()
  
  get: ->
    @promise.promise

module.exports = FirebaseConnection
