q = require 'q'
Job = require './job'

class JobStateChangeTask
  constructor: (@queue, @opts) ->
    throw new Error('JobStateChangeTask requires options to include from and to') unless @opts.from? and @opts.to?
    throw new Error('JobStateChangeTask filter option must be a function') if @opts.filter? and typeof @opts.filter isnt 'function'
  
  run: ->
    @queue.connection.get().then (conn) =>
      q()
      .then =>
        @_collect_jobs(conn, @opts.from)
      .then (job_list) =>
        @_filter_jobs(conn, job_list)
      .then (job_list) =>
        @_change_jobs(conn, job_list, @opts.to)
  
  _collect_jobs: (conn, state) ->
    d = q.defer()
    
    conn.child(state).once 'value', (snap) ->
      job_map = snap.val()
      return d.resolve([]) unless job_map?
      
      d.resolve(
        Object.keys(job_map).map (state_name) ->
          {
            state: state
            name: state_name
            job_name: job_map[state_name]
          }
      )
      
    d.promise
  
  _filter_jobs: (conn, job_list) ->
    return job_list unless @opts.filter?
    
    list = []
    
    context =
      queue: @queue
      opts: @opts
    
    q.all(
      job_list.map (job) =>
        j = new Job(@queue)
        j.ref = conn.child('jobs/' + job.job_name)
        j.hydrate()
        .then =>
          @opts.filter.call(context, j)
        .then (filter_res) =>
          list.push(job) if filter_res
    )
    .then ->
      list
  
  _change_jobs: (conn, job_list, to_state) ->
    console.log 'Changing', job_list.length, @opts.from, 'job(s) to', to_state
    
    to_conn = conn.child(to_state)
    
    q.all(
      job_list.map (job) =>
        @_change_job_state(conn, job, to_state)
    )
  
  _change_job_state: (conn, job, to_state) ->
    to_ref = conn.child(to_state).push()
    q.ninvoke(to_ref, 'set', job.job_name)
    .then ->
      q.ninvoke(conn.child('jobs/' + job.job_name + '/meta'), 'update',
        state: to_state
        ref: to_ref.name()
      )
    .then ->
      q.ninvoke(conn.child(job.state + '/' + job.name), 'remove')

module.exports = JobStateChangeTask
