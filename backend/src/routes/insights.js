import { Router } from 'express'
import { requireUser } from '../auth/requireUser.js'
import { validationError as invalid } from '../errors.js'
import { buildInsights } from '../insights/build.js'
import { DEFAULT_PERIOD, PERIODS } from '../insights/months.js'

// GET /api/me/insights, Figure 4.12, for workers and clients alike. Nothing
// is stored: the dashboard is worked out from the reviews and jobs on every
// request.
export function insightsRouter({ users, reviews, jobs, reputation, now = () => new Date() }) {
  const router = Router()

  router.get('/me/insights', requireUser(users), async (req, res) => {
    const period = req.query.period ?? DEFAULT_PERIOD
    if (typeof period !== 'string' || !Object.hasOwn(PERIODS, period)) {
      throw invalid(`period must be one of ${Object.keys(PERIODS).join(', ')}.`)
    }

    const { user } = req
    const [received, history, score] = await Promise.all([
      reviews.listReceivedForInsights(user.id),
      jobs.historyFor(user.id, user.role),
      reputation.findForUser(user.id),
    ])
    const answeredJobIds = await reviews.jobIdsReviewedBy(user.id, [...new Set(received.map((r) => r.job_id))])

    res.status(200).json(
      buildInsights({
        role: user.role,
        period,
        now: now(),
        received,
        answeredJobIds,
        history,
        reputation: score,
      }),
    )
  })

  return router
}
