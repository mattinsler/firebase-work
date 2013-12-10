exports.Connection = require './connection'
exports.Job = require './job'
exports.Manager = require './manager'
exports.Queue = require './queue'
exports.Worker = require './worker'

exports.connections = {}
exports.connect = (url) ->
  URL = require 'url'
  
  # normalize url
  url = URL.format(URL.parse(url))
  return exports.connections[url] if exports.connections[url]?
  exports.connections[url] = new exports.Connection(url)
