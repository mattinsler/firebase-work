FirebaseWork = require '../lib/firebase-work'
queue = new FirebaseWork.Queue(process.env.YOUR_FIREBASE_URL)

for x in [0...10]
  queue.push(
    type: 'fun'
    data:
      description: 'we just need some fun sometimes'
      motivation: 'boredom'
  )
