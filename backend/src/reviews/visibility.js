// When a review becomes visible (plan 3.1, confirmed 12 November): once the
// person reviewed has also reviewed the same job, or 14 days after the review
// was submitted, whichever comes first. Without the timeout, one party could
// hide the other's review forever by never writing their own.
export const VISIBILITY_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000

// review: { job_id, created_at }. answeredJobIds: the jobs the reviewee has
// reviewed in return.
export function isVisible(review, answeredJobIds, now = new Date()) {
  if (answeredJobIds.has(review.job_id)) return true
  return now.getTime() - new Date(review.created_at).getTime() >= VISIBILITY_DAYS * DAY_MS
}
