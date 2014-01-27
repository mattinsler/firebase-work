Work = require '../lib/firebase-work'
compiler_queue = new Work.Queue(process.env.YOUR_FIREBASE_URL + '/compiler')
new_version_queue = new Work.Queue(process.env.YOUR_FIREBASE_URL + '/new-version')

watch_job = (job) ->
  job.on 'pending', ->
    console.log 'PENDING', job.data.type, job.data.data.version

  job.on 'started', ->
    console.log 'STARTED', job.data.type, job.data.data.version
  
  job.on 'progress', (progress) ->
    console.log 'PROGRESS', job.data.type, job.data.data.version, parseInt(100 * progress / 100) + '%'
  
  job.on 'succeeded', ->
    console.log 'SUCCEEDED', job.data.type, job.data.data.version

  job.on 'failed', ->
    console.log 'FAILED', job.data.type, job.data.data.version

  job.on 'done', ->
    console.log 'DONE', arguments

[0...10].forEach (x) ->
  job = compiler_queue.push(
    type: 'compile'
    data:
      description: 'we just need some fun sometimes'
      motivation: 'boredom'
      version: x
  )
  watch_job(job)
  
  job = new_version_queue.push(
    type: 'new-version'
    data:
      description: 'we just need some fun sometimes'
      motivation: 'boredom'
      version: x
  )
  watch_job(job)
