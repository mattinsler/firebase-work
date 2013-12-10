q = require 'q'
Firebase = require 'firebase'
{EventEmitter} = require 'events'

class Worker extends EventEmitter
  constructor: (@queue, @work_performer) ->
    @connections = @queue.manager.connections
  
  # could do something with onDisconnect here to ensure it doesn't
  # get caught in a weird state where it's on both queues at once
  change_job_state: (job, from_state, to_state) ->
    # add to new state
    old_meta_ref = job.meta.ref
    new_state_ref = @connections[to_state].push()
    q.ninvoke(new_state_ref, 'set', job.ref.name())
    .then =>
      # update job metadata
      job.update_meta(
        state: to_state
        ref: new_state_ref.name()
      )
    .then =>
      # remove from old state
      q.ninvoke(@connections[from_state].child(old_meta_ref), 'remove')
  
  # job is claimed
  perform: (job) ->
    q()
    # starting
    .then =>
      console.log 'Worker started job', job.ref.name()
      
      job.update_meta(started_at: Firebase.ServerValue.TIMESTAMP)
      .then =>
        @change_job_state(job, 'pending', 'started')
      .then =>
        @emit('started', job)
    
    # do work
    .then =>
      console.log 'Worker performing job', job.ref.name()
      
      context =
        progress: (progress) ->
          job.report_progress(progress)
      
      if @work_performer.length is 1
        q.when(@work_performer.call(context, job.data))
      else if @work_performer.length is 2
        q.nfcall(@work_performer.bind(context), job.data)
      else
        throw new Error('Queue work performer should either take 1 argument (job_data) and return a promise, or take 2 arguments (job_data, callback) and use the callback')
    
    # success
    .then =>
      console.log 'Worker succeeded job', job.ref.name()
      
      job.update_meta(succeeded_at: Firebase.ServerValue.TIMESTAMP)
      .then =>
        @change_job_state(job, 'started', 'succeeded')
      .then =>
        @emit('succeeded', job)
    
    # failure
    .catch (err) =>
      console.log 'Worker failed job', job.ref.name(), ':', err.toString()
      console.log err.stack
      
      job.update_meta(
        failed_at: Firebase.ServerValue.TIMESTAMP
        last_error:
          message: err.message
          stack: err.stack
      )
      .then =>
        @change_job_state(job, 'started', 'failed')
      .then =>
        @emit('failed', job, err)
    
    # worker done, going idle
    .then =>
      @emit('idle')

module.exports = Worker
