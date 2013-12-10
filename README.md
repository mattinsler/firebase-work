# firebase-work

Firebase work-queue system

## Usage

Coming... Sorry, check out the example directory

## TODO

- Remotely monitoring a specific job's state (so you can submit a job and get a callback when it's done)
- Monitor global state (new job IDs for the succeeded and failed queues so they can be monitored in ascending order)
- Methods to clear out succeeded/failed queues (jobs older than a certain amount of time)
- Methods to clear out and re-queue hung or pre-empted jobs (like when your instance dies)
- Keep a failed count on failed jobs
- Methods to re-queue failed jobs up to a configured number of times
