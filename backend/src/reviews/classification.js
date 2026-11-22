import { InferenceError } from '../inference/client.js'

// Classifies reviews and stores the result (plan 3.6, decision of
// 18 November on where the retry lives).
//
// On submit: /classify with a 5 second timeout and two retries. If every
// attempt fails, the review stays saved with pending_classification true and
// no sentiment_results row.
//
// Retry: the background timer (src/background.js) runs retryPending() every
// minute. It takes the oldest pending reviews and tries each once, stopping
// at the first failure that means the service is down, so a dead classifier
// gets one call a minute. The 14-day visibility sweep runs on the same timer,
// after the retry.

// A submit request can spend up to 16.5 s classifying (three 5 s attempts and
// two short waits). The retry leaves younger reviews alone so it does not
// classify one that its own request is still working on.
export const RETRY_MIN_AGE_MS = 30_000

export const RETRY_BATCH = 20

export function createClassificationService({ reviews, inference, scoring, now = () => new Date(), logger = console }) {
  // Recomputing is a follow-up to a write that has already happened, so a
  // failure is logged rather than undoing or failing anything. The next
  // recompute for that user puts it right.
  async function recomputeQuietly(userId) {
    try {
      await scoring.recompute(userId)
    } catch (err) {
      logger.error(`Reputation recompute failed for user ${userId}:`, err)
    }
  }

  // Classifies one review, stores the result and recomputes the reviewee.
  // Throws InferenceError if the service could not classify it.
  async function classifyAndStore(review, { attempts } = {}) {
    const result = await inference.classify(review.review_text, { attempts })
    const sentiment = await reviews.storeSentiment(review.id, {
      label: result.label,
      confidence_score: result.confidence,
      model_version: result.model_version,
      sentences: result.sentences,
    })
    await recomputeQuietly(review.reviewee_id)
    return sentiment
  }

  // The submit path. Returns the stored sentiment, or null when the review
  // has to wait for the retry. Never throws: the review is already saved.
  async function classifyOnSubmit(review) {
    try {
      return await classifyAndStore(review)
    } catch (err) {
      logger.warn(`Review ${review.id} saved as pending classification: ${err.message}`)
      return null
    }
  }

  let running = null

  async function runRetry() {
    const before = new Date(now().getTime() - RETRY_MIN_AGE_MS)
    const pending = await reviews.listPending({ before, limit: RETRY_BATCH })
    const outcome = { checked: pending.length, classified: 0, skipped: 0, stopped: null }

    for (const review of pending) {
      try {
        await classifyAndStore(review, { attempts: 1 })
        outcome.classified += 1
      } catch (err) {
        // The service refused this one text (422). Trying it again will not
        // help, so log it and carry on with the others.
        if (err instanceof InferenceError && err.scope === 'review') {
          outcome.skipped += 1
          logger.error(`Review ${review.id} cannot be classified: ${err.message}`)
          continue
        }
        // Anything else means no review can be classified right now.
        outcome.stopped = err.message
        break
      }
    }

    if (outcome.checked > 0) {
      const left = outcome.checked - outcome.classified
      const line = `Classification retry: ${outcome.classified} of ${outcome.checked} pending reviews classified`
      if (outcome.stopped) logger.warn(`${line}; stopped, ${left} still pending: ${outcome.stopped}`)
      else logger.info(`${line}.`)
    }
    return outcome
  }

  // One retry at a time: a slow tick and the next one never overlap.
  function retryPending() {
    if (!running) running = runRetry().finally(() => (running = null))
    return running
  }

  return { classifyOnSubmit, retryPending, recomputeQuietly }
}
