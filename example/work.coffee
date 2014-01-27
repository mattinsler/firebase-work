q = require 'q'
Work = require '../lib/firebase-work'
compiler_queue = new Work.Queue(process.env.YOUR_FIREBASE_URL + '/compiler')
new_version_queue = new Work.Queue(process.env.YOUR_FIREBASE_URL + '/new-version')

# Firebase URLs can have auth tokens in them as well...
# https://:auth-token@your-firebase.firebaseIO.com

compiler_performer = (job) ->
  console.log "I'm doing compiler work now!!! Look at me go!!"
  q.delay(2000)
  .then =>
    @progress(25)
    q.delay(2000)
  .then =>
    @progress(50)
    q.delay(2000)
  .then =>
    @progress(75)
    q.delay(2000)

new_version_performer = (job, cb) ->
  console.log "We have a new version! Looky!"
  x = 0
  interval_id = setInterval =>
    @progress(++x)
    if x is 100
      clearInterval(interval_id)
      cb()
  , 100

# performer = (job) ->
#   console.log "I'm doing work now!!! Look at me go!!"
#   q.delay(2000)
#   .then ->
#     throw new Error('You are a jerk')

# performer = (job, callback) ->
#   console.log "I'm doing work now!!! Look at me go!!"
#   setTimeout ->
#     callback(new Error('This is a problem for me'))
#   , 2000

compiler_manager = new Work.WorkerManager(compiler_queue, compiler_performer)
compiler_manager.start()

new_version_manager = new Work.WorkerManager(new_version_queue, new_version_performer)
new_version_manager.start()
