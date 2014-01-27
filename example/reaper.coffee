Work = require '../lib/firebase-work'
compiler_queue = new Work.Queue(process.env.YOUR_FIREBASE_URL + '/compiler')
new_version_queue = new Work.Queue(process.env.YOUR_FIREBASE_URL + '/new-version')

manager = new Work.TaskManager()
manager.add(new Work.JobStateChangeTask(compiler_queue,
  from: 'failed'
  to: 'pending'
))
# started jobs older than 60 seconds
manager.add(new Work.JobStateChangeTask(compiler_queue,
  from: 'started'
  to: 'pending'
  filter: (job) ->
    @queue.connection.server_time_ms - job.meta.started_at > 60 * 1000
))

manager.add(new Work.JobStateChangeTask(new_version_queue,
  from: 'failed'
  to: 'pending'
))
manager.add(new Work.JobStateChangeTask(new_version_queue,
  from: 'started'
  to: 'pending'
  filter: (job) ->
    @queue.connection.server_time_ms - job.meta.started_at > 60 * 1000
))

manager.start()
