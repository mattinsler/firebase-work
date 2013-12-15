q = require 'q'
Firebase = require 'firebase'
{EventEmitter} = require 'events'

class Worker extends EventEmitter
  constructor: (@queue, @work_performer) ->
  
  # job is already claimed
  perform: (job) ->
    @job = job
    
    q()
    .then(@_start.bind(@))
    .then(@_work.bind(@))
    .then(@_successful.bind(@))
    .catch(@_failure.bind(@))
    .fin(@_idle.bind(@))
  
  _start: ->
    console.log 'Worker started job', @job.ref.name()
    
    @job.set(started_at: Firebase.ServerValue.TIMESTAMP)
    .then =>
      @job.change_state('started')
    .then =>
      @emit('started', @job)
  
  _work: ->
    console.log 'Worker performing job', @job.ref.name()
    
    context =
      progress: (progress) =>
        @job.report_progress(progress)
    
    if @work_performer.length is 1
      q.when(@work_performer.call(context, @job.data))
    else if @work_performer.length is 2
      q.nfcall(@work_performer.bind(context), @job.data)
    else
      throw new Error('Queue work performer should either take 1 argument (job_data) and return a promise, or take 2 arguments (job_data, callback) and use the callback')
    
  _successful: ->
    console.log 'Worker succeeded job', @job.ref.name()
    
    @job.set(succeeded_at: Firebase.ServerValue.TIMESTAMP)
    .then =>
      @job.change_state('succeeded')
    .then =>
      @emit('succeeded', @job)
  
  _failure: (err) ->
    console.log 'Worker failed job', @job.ref.name(), ':', err.toString()
    console.log err.stack
    
    @job.set(
      failed_at: Firebase.ServerValue.TIMESTAMP
      last_error:
        message: err.message
        stack: err.stack
    )
    .then =>
      @job.change_state('failed')
    .then =>
      @emit('failed', @job, err)
  
  _idle: ->
    @emit('idle')

module.exports = Worker
