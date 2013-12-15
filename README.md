# firebase-work

Firebase work-queue system

## Usage

Coming... Sorry, check out the example directory

## TODO

- [x] Remotely monitoring a specific job's state (so you can submit a job and get a callback when it's done)
- [x] Report on remote job progress
- [ ] Monitor global state (new job IDs for the succeeded and failed queues so they can be monitored in ascending order)
- [ ] Methods to clear out succeeded/failed queues (jobs older than a certain amount of time)
- [x] Methods to clear out and re-queue hung or pre-empted jobs (like when your instance dies)
- [x] Keep a failed count on failed jobs
- [x] Methods to re-queue failed jobs up to a configured number of times
