q = require 'q'
Firebase = require 'firebase'
{EventEmitter} = require 'events'

class Worker extends EventEmitter
  constructor: (@queue, @work_performer) ->
  
  # job is clamied and moved into the working queue already
  perform: (job) ->
    q()
    .then =>
      # already on the working queue
      console.log 'Worker started job', job.ref.name()
      
      job.update(__started_at__: Firebase.ServerValue.TIMESTAMP)
      .then =>
        @emit('start', job)
    
    # do work
    .then =>
      console.log 'Worker performing job', job.ref.name()
      
      if @work_performer.length is 1
        q.when(@work_performer(job.data))
      else if @work_performer.length is 2
        q.nfcall(@work_performer, job.data)
      else
        throw new Error('Queue work performer should either take 1 argument (job_data) and return a promise, or take 2 arguments (job_data, callback) and use the callback')
    
    # success
    .then =>
      console.log 'Worker succeeded job', job.ref.name()
      
      job.update(__succeeded_at__: Firebase.ServerValue.TIMESTAMP)
      .then =>
        job.move_to('succeeded')
      .then =>
        @emit('success', job)
    
    # failure
    .catch (err) =>
      console.log 'Worker failed job', job.ref.name(), ':', err.toString()
      console.log err.stack
      
      job.update(
        __failed_at__: Firebase.ServerValue.TIMESTAMP
        __last_error__:
          message: err.message
          stack: err.stack
      )
      .then =>
        job.move_to('failed')
      .then =>
        @emit('fail', job, err)
    
    # worker done, going idle
    .then =>
      @emit('idle')

module.exports = Worker
