import { VISIBILITY_DAYS } from './visibility.js'

// The 14-day visibility sweep (#53, decision of 18 November). A review hidden
// because its reviewee has not answered becomes visible 14 days after it was
// written, with no request to trigger a recompute. The background timer runs
// sweep() every minute, after the classification retry.
//
// Each tick asks the database for the reviewees whose 14-day mark has passed
// since their score was last computed (see reviews.listRevieweesDueForVisibility)
// and recomputes each one. A recompute moves last_updated past the mark, so
// the next tick does not find that user again. A recompute that fails leaves
// last_updated where it was, so the next tick tries again.

export const SWEEP_BATCH = 50

export function createVisibilitySweep({ reviews, scoring, now = () => new Date(), logger = console }) {
  let running = null

  async function runSweep() {
    const due = await reviews.listRevieweesDueForVisibility({ now: now(), days: VISIBILITY_DAYS, limit: SWEEP_BATCH })
    const outcome = { checked: due.length, recomputed: 0, failed: 0 }

    for (const userId of due) {
      try {
        await scoring.recompute(userId)
        outcome.recomputed += 1
      } catch (err) {
        outcome.failed += 1
        logger.error(`Visibility sweep: recompute failed for user ${userId}:`, err)
      }
    }

    if (outcome.checked > 0) {
      const line = `Visibility sweep: ${outcome.recomputed} of ${outcome.checked} users recomputed after a review turned visible`
      if (outcome.failed > 0) logger.warn(`${line}; ${outcome.failed} will be tried again next tick.`)
      else logger.info(`${line}.`)
    }
    return outcome
  }

  // One sweep at a time, as for the retry.
  function sweep() {
    if (!running) running = runSweep().finally(() => (running = null))
    return running
  }

  return { sweep }
}
