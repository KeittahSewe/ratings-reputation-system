import { Router } from 'express'
import { requireUser } from '../auth/requireUser.js'
import { ApiError } from '../errors.js'
import { UUID } from '../ids.js'
import { isVisible } from '../reviews/visibility.js'

// How many visible reviews a profile carries. A paged reviews route is added
// only if a profile screen needs more (change log, 22 November).
const PROFILE_REVIEWS = 10

export function usersRouter({ users, skills, reputation, reviews, jobs }) {
  const router = Router()

  // Another user's public profile, as on Figures 4.7 and 4.8: no email, the
  // reputation with its three components, a worker's skills, the reviews the
  // user has received that are visible yet, and how many jobs they have
  // completed (#84), as worker or as client.
  router.get('/users/:id', requireUser(users), async (req, res) => {
    const { id } = req.params
    const profile = UUID.test(id) ? await users.findPublicById(id) : null
    if (!profile) throw new ApiError(404, 'not_found', 'No user with this id.')

    const [profileSkills, score, received, history] = await Promise.all([
      profile.role === 'worker' ? skills.listForUser(id) : [],
      reputation.findForUser(id),
      reviews.listReceived(id),
      jobs.historyFor(id, profile.role),
    ])
    const answered = await reviews.jobIdsReviewedBy(id, [...new Set(received.map((r) => r.job_id))])
    const visible = received.filter((r) => isVisible(r, answered))

    res.status(200).json({
      user: profile,
      skills: profileSkills,
      reputation: score,
      review_count: visible.length,
      completed_jobs: history.filter((job) => job.status === 'completed').length,
      reviews: visible.slice(0, PROFILE_REVIEWS).map(({ job_id, ...review }) => review),
    })
  })

  return router
}
