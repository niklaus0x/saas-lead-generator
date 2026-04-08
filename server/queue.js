/**
 * Job Queue v5 — Background search with polling
 * Uses an in-memory queue (upgradeable to Redis/BullMQ)
 * Prevents HTTP timeouts on long searches
 */

const { EventEmitter } = require('events');

const jobs = new Map(); // jobId -> job object
const emitter = new EventEmitter();

const JOB_STATES = { PENDING: 'pending', RUNNING: 'running', DONE: 'done', FAILED: 'failed' };

function createJob(type, payload) {
  const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const job = {
    id,
    type,
    payload,
    status: JOB_STATES.PENDING,
    progress: 0,
    progressMsg: 'Queued',
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };
  jobs.set(id, job);
  return job;
}

function getJob(id) { return jobs.get(id) || null; }

function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, updates);
  emitter.emit('update', job);
  return job;
}

function startJob(id) {
  return updateJob(id, { status: JOB_STATES.RUNNING, startedAt: new Date().toISOString(), progress: 5, progressMsg: 'Starting search...' });
}

function progressJob(id, progress, msg) {
  return updateJob(id, { progress: Math.min(progress, 99), progressMsg: msg });
}

function completeJob(id, result) {
  return updateJob(id, { status: JOB_STATES.DONE, progress: 100, progressMsg: 'Complete', result, completedAt: new Date().toISOString() });
}

function failJob(id, error) {
  return updateJob(id, { status: JOB_STATES.FAILED, progressMsg: 'Failed', error: error.message || String(error), completedAt: new Date().toISOString() });
}

// Clean up old jobs (older than 1 hour)
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs.entries()) {
    if (new Date(job.createdAt).getTime() < cutoff && (job.status === JOB_STATES.DONE || job.status === JOB_STATES.FAILED)) {
      jobs.delete(id);
    }
  }
}, 10 * 60 * 1000);

function registerQueueRoutes(app) {
  // Poll job status
  app.get('/api/jobs/:id', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const { payload, ...safe } = job; // don't expose full payload
    res.json(safe);
  });

  // List recent jobs
  app.get('/api/jobs', (req, res) => {
    const list = [...jobs.values()]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 20)
      .map(({ payload, ...safe }) => safe);
    res.json({ jobs: list, count: list.length });
  });

  // SSE stream for real-time progress
  app.get('/api/jobs/:id/stream', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send current state immediately
    res.write(`data: ${JSON.stringify(job)}\n\n`);

    const listener = (updated) => {
      if (updated.id === req.params.id) {
        res.write(`data: ${JSON.stringify(updated)}\n\n`);
        if (updated.status === JOB_STATES.DONE || updated.status === JOB_STATES.FAILED) res.end();
      }
    };
    emitter.on('update', listener);
    req.on('close', () => emitter.off('update', listener));
  });
}

module.exports = { createJob, getJob, startJob, progressJob, completeJob, failJob, registerQueueRoutes, JOB_STATES };
