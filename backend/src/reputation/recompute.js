import { isVisible } from '../reviews/visibility.js'
import { computeReputation, historyCounts } from './score.js'

// Recomputes and stores a user's reputation from the database.
//
// Only reviews that are both visible and classified count (decision of
// 18 November). A hidden review that moved the score would give itself away:
// if Peter's ratings component dropped from 4.90 to 4.88, he could work out
// the stars Amina gave him before writing his own review.
//
// A review hidden by the 14-day rule becomes visible with no request to
// trigger a recompute; the visibility sweep (src/reviews/visibilitySweep.js)
// finds it by comparing the review's 14-day mark with last_updated. That
// works because visibility and last_updated below come from the same 'at'.
export function createReputationService({ users, reviews, jobs, reputation, now = () => new Date() }) {
  async function recompute(userId) {
    const user = await users.findPublicById(userId)
    if (!user) return null

    const [received, history] = await Promise.all([reviews.listReceived(userId), jobs.historyFor(userId, user.role)])
    const answered = await reviews.jobIdsReviewedBy(userId, [...new Set(received.map((r) => r.job_id))])
    const at = now()
    const counted = received
      .filter((r) => r.sentiment && isVisible(r, answered, at))
      .map((r) => ({ rating: r.rating, label: r.sentiment.label }))

    const result = computeReputation({ role: user.role, reviews: counted, ...historyCounts(user.role, history) })
    // No counted reviews: nothing to store. Reviews are never deleted and
    // visibility only ever turns on, so a user who has a row keeps one.
    if (!result) return null
    return reputation.save(userId, result, at)
  }

  return {
    recompute,

    // After a job is completed or cancelled, H may have changed for both
    // parties. The job's status change has already been saved, so a failed
    // recompute is logged rather than turned into an error for the caller;
    // the next recompute for that user puts it right.
    async recomputeParties(job) {
      for (const userId of [job.client_id, job.worker_id]) {
        if (!userId) continue
        try {
          await recompute(userId)
        } catch (err) {
          console.error(`Reputation recompute failed for user ${userId}:`, err)
        }
      }
    },
  }
}
