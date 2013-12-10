FirebaseWork = require '../lib/firebase-work'
queue = new FirebaseWork.Queue(process.env.YOUR_FIREBASE_URL)

[0...10].forEach (x) ->
  job = queue.push(
    type: 'fun'
    data:
      description: 'we just need some fun sometimes'
      motivation: 'boredom'
      version: x
  )

  job.on 'pending', ->
    console.log 'PENDING', job.data.data.version

  job.on 'started', ->
    console.log 'STARTED', job.data.data.version
  
  job.on 'progress', (progress) ->
    console.log 'PROGRESS', job.data.data.version, parseInt(100 * progress / 100) + '%'
  
  job.on 'succeeded', ->
    console.log 'SUCCEEDED', job.data.data.version

  job.on 'failed', ->
    console.log 'FAILED', job.data.data.version

  job.on 'done', ->
    console.log 'DONE', arguments
