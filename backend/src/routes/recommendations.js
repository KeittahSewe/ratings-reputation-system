import { Router } from 'express'
import { requireRole, requireUser } from '../auth/requireUser.js'
import { ApiError } from '../errors.js'
import { UUID } from '../ids.js'
import { canSee } from '../jobs/access.js'
import { DISCLOSURE, rankWorkers } from '../recommendations/match.js'

// GET /api/jobs/:id/recommendations, Figure 4.11. Rankings are worked out
// on every request and never stored (plan 3.5; there is no recommendations
// table).
export function recommendationsRouter({ users, jobs, skills, reputation }) {
  const router = Router()

  // Checks run in this order: the caller's role (403), the job exists and is
  // the caller's (404), the job is open (409).
  router.get('/jobs/:id/recommendations', requireUser(users), requireRole('client'), async (req, res) => {
    const { id } = req.params
    const job = UUID.test(id) ? await jobs.findById(id) : null
    if (!job || !canSee(job, req.user)) throw new ApiError(404, 'not_found', 'No job with this id.')
    if (job.status !== 'open') {
      throw new ApiError(
        409,
        'job_not_open',
        `This job is ${job.status.replace('_', ' ')}. Recommendations are only for open jobs.`,
      )
    }

    const workers = await users.listAvailableWorkers()
    const ids = workers.map((w) => w.id)
    const [skillsByWorker, scores, completed, hired] = await Promise.all([
      skills.listForUsers(ids),
      reputation.findForUsers(ids),
      jobs.completedCountsFor(ids),
      jobs.workersHiredBy(req.user.id),
    ])

    const candidates = workers.map((w) => ({
      worker: { id: w.id, name: w.name },
      skills: skillsByWorker.get(w.id) ?? [],
      reputation: scores.get(w.id) ?? null,
      completed_jobs: completed.get(w.id) ?? 0,
    }))

    res.status(200).json({
      job: { id: job.id, title: job.title, category: job.category, required_skills: job.required_skills },
      total: candidates.length,
      recommendations: rankWorkers(job, candidates, hired),
      disclosure: DISCLOSURE,
    })
  })

  return router
}
