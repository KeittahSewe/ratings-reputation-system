import { Router } from 'express'
import { requireRole, requireUser } from '../auth/requireUser.js'
import { CATEGORIES } from '../categories.js'
import { ApiError, validationError as invalid } from '../errors.js'
import { UUID } from '../ids.js'
import { canSee } from '../jobs/access.js'
import { ACTIONS, STATUSES, timeline } from '../jobs/status.js'

const MAX_REQUIRED_SKILLS = 10

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Same cleaning as skill names on profiles, so the recommendation engine can
// compare the two lists ignoring capitals.
function cleanSkillName(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
}

function parseJob(body) {
  if (!isPlainObject(body)) throw invalid('Send a JSON body with title, description and category.')
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (title.length < 1 || title.length > 120) throw invalid('title must be between 1 and 120 characters.')
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  if (description.length < 1 || description.length > 4000) {
    throw invalid('description must be between 1 and 4000 characters.')
  }
  if (!CATEGORIES.includes(body.category)) throw invalid(`category must be one of: ${CATEGORIES.join(', ')}.`)

  const given = body.required_skills ?? []
  if (!Array.isArray(given)) throw invalid('required_skills must be a list of skill names.')
  const requiredSkills = []
  for (const value of given) {
    const name = cleanSkillName(value)
    if (name.length < 1 || name.length > 60) throw invalid('Each required skill must be between 1 and 60 characters.')
    // Repeats that differ only in capitals are dropped, keeping the first.
    if (!requiredSkills.some((s) => s.toLowerCase() === name.toLowerCase())) requiredSkills.push(name)
  }
  if (requiredSkills.length > MAX_REQUIRED_SKILLS) {
    throw invalid(`A job can list at most ${MAX_REQUIRED_SKILLS} required skills.`)
  }
  return { title, description, category: body.category, required_skills: requiredSkills }
}

// Query string filters shared by GET /jobs and GET /jobs/available.
function parseFilters(query, { allowStatus }) {
  const filters = {}
  if (query.status !== undefined) {
    if (!allowStatus) throw invalid('status cannot be filtered here; every job listed is open.')
    if (!STATUSES.includes(query.status)) throw invalid(`status must be one of: ${STATUSES.join(', ')}.`)
    filters.status = query.status
  }
  if (query.category !== undefined) {
    if (!CATEGORIES.includes(query.category)) throw invalid(`category must be one of: ${CATEGORIES.join(', ')}.`)
    filters.category = query.category
  }
  if (query.q !== undefined) {
    const q = typeof query.q === 'string' ? query.q.trim() : ''
    if (q.length > 100) throw invalid('q must be 100 characters or fewer.')
    if (q) filters.q = q
  }
  return filters
}

function withTimeline(job) {
  return { ...job, timeline: timeline(job) }
}

// scoring: the reputation service. Completing or cancelling a job changes
// the job history (H) of both parties, so both are recomputed.
export function jobsRouter({ users, jobs, scoring }) {
  const router = Router()
  const signedIn = requireUser(users)

  async function loadVisibleJob(id, user) {
    const job = UUID.test(id) ? await jobs.findById(id) : null
    if (!job || !canSee(job, user)) throw new ApiError(404, 'not_found', 'No job with this id.')
    return job
  }

  router.post('/jobs', signedIn, requireRole('client'), async (req, res) => {
    const fields = parseJob(req.body)
    const job = await jobs.insert({ ...fields, client_id: req.user.id })
    res.status(201).json({ job })
  })

  // A client's own jobs, or the jobs assigned to a worker.
  router.get('/jobs', signedIn, async (req, res) => {
    const filters = parseFilters(req.query, { allowStatus: true })
    const list =
      req.user.role === 'client'
        ? await jobs.listForClient(req.user.id, filters)
        : await jobs.listForWorker(req.user.id, filters)
    res.status(200).json({ jobs: list })
  })

  // Registered before /jobs/:id so "available" is not read as an id.
  router.get('/jobs/available', signedIn, requireRole('worker'), async (req, res) => {
    const filters = parseFilters(req.query, { allowStatus: false })
    res.status(200).json({ jobs: await jobs.listOpen(filters) })
  })

  router.get('/jobs/:id', signedIn, async (req, res) => {
    const job = await loadVisibleJob(req.params.id, req.user)
    res.status(200).json({ job: withTimeline(job) })
  })

  // One handler for all five status changes. Checks run in this order:
  // the job exists and the caller can see it (404), the caller's role (403),
  // the caller is this job's client or worker (403), the body (400), then the
  // status rules (409).
  for (const [action, rule] of Object.entries(ACTIONS)) {
    router.post(`/jobs/:id/${action}`, signedIn, requireRole(rule.role), async (req, res) => {
      const job = await loadVisibleJob(req.params.id, req.user)
      const ownerId = rule.role === 'client' ? job.client_id : job.worker_id
      if (ownerId !== req.user.id) {
        throw new ApiError(403, 'not_your_job', `Only the ${rule.role} on this job can ${action} it.`)
      }

      const fields = { status: rule.to, [rule.stamp]: new Date().toISOString() }

      if (action === 'assign') {
        const workerId = isPlainObject(req.body) ? req.body.worker_id : undefined
        if (typeof workerId !== 'string' || !UUID.test(workerId)) throw invalid('Send a JSON body with worker_id.')
        const worker = await users.findPublicById(workerId)
        if (!worker || worker.role !== 'worker') throw invalid('worker_id must be the id of a worker account.')
        if (job.status === 'open' && !worker.availability) {
          throw new ApiError(409, 'worker_unavailable', `${worker.name} is not taking jobs at the moment.`)
        }
        fields.worker_id = worker.id
      }

      if (!rule.from.includes(job.status)) {
        const allowed = rule.from.map((s) => s.replace('_', ' ')).join(' or ')
        throw new ApiError(
          409,
          'invalid_transition',
          `This job is ${job.status.replace('_', ' ')}. Only a job that is ${allowed} can be ${rule.done}.`,
        )
      }
      if (action === 'submit' && job.submitted_at) {
        throw new ApiError(409, 'already_submitted', 'This job has already been submitted.')
      }
      if (action === 'complete' && !job.submitted_at) {
        throw new ApiError(409, 'not_submitted', 'The worker has not submitted this job yet.')
      }

      const updated = await jobs.transition(job.id, { from: job.status, fields, unsubmitted: action === 'submit' })
      if (!updated) throw new ApiError(409, 'job_changed', 'This job changed while you were updating it. Reload and try again.')

      const fresh = await jobs.findById(job.id)
      if (action === 'complete' || action === 'cancel') await scoring.recomputeParties(fresh)
      res.status(200).json({ job: withTimeline(fresh) })
    })
  }

  return router
}
