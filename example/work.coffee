q = require 'q'
Work = require '../lib/firebase-work'

# Firebase URLs can have auth tokens in them as well...
# https://:auth-token@your-firebase.firebaseIO.com
queue = new Work.Queue(process.env.YOUR_FIREBASE_URL)

performer = (job) ->
  console.log "I'm doing work now!!! Look at me go!!"
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

manager = new Work.Manager(queue, performer)
manager.start()
