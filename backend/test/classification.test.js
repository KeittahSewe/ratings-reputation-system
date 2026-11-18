import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  createClassificationService,
  RETRY_BATCH,
  RETRY_INTERVAL_MS,
  RETRY_MIN_AGE_MS,
} from '../src/reviews/classification.js'
import { fakeInference, fakeReviewsRepo, fakeScoring, MODEL_VERSION, quietLogger } from './reviewFakes.js'

const AMINA = 'd2000000-0000-4000-8000-000000000001'
const PETER = 'd2000000-0000-4000-8000-000000000002'
const ESTHER = 'd2000000-0000-4000-8000-000000000003'
const JOB = 'e2000000-0000-4000-8000-000000000001'
const OTHER_JOB = 'e2000000-0000-4000-8000-000000000002'

describe('classification retry (decision of 18 November)', () => {
  let clock
  let reviews
  let inference
  let scoring
  let logger
  let service

  // A pending review submitted ageMs before the current clock.
  const pending = (ageMs, row) =>
    reviews.seed({ created_at: new Date(clock.getTime() - ageMs).toISOString(), ...row })

  beforeEach(() => {
    clock = new Date('2026-11-18T20:00:00Z')
    const now = () => clock
    reviews = fakeReviewsRepo({ now })
    inference = fakeInference()
    scoring = fakeScoring()
    logger = quietLogger()
    service = createClassificationService({ reviews, inference, scoring, now, logger })
  })

  it('classifies a pending review once the classifier is back, and recomputes the reviewee', async () => {
    const review = pending(2 * 60_000, {
      job_id: JOB,
      reviewer_id: PETER,
      reviewee_id: AMINA,
      rating: 4,
      review_text: 'Amina explained the job clearly.',
    })

    const outcome = await service.retryPending()
    assert.deepEqual(outcome, { checked: 1, classified: 1, skipped: 0, stopped: null })
    assert.equal(review.pending_classification, false)
    assert.equal(reviews.sentiments.get(review.id).model_version, MODEL_VERSION)
    assert.deepEqual(scoring.recomputed, [AMINA])
    // One attempt per review: the next tick is the retry.
    assert.equal(inference.calls[0].attempts, 1)
    assert.ok(logger.lines.some((l) => l.level === 'info' && /1 of 1 pending/.test(l.text)))
  })

  it('leaves alone a review its own submit request may still be classifying', async () => {
    pending(RETRY_MIN_AGE_MS - 1000, { job_id: JOB, reviewer_id: PETER, reviewee_id: AMINA, review_text: 'Fine.' })
    const outcome = await service.retryPending()
    assert.equal(outcome.checked, 0)
    assert.equal(inference.calls.length, 0)
    assert.equal(logger.lines.length, 0)
  })

  it('stops at the first failure while the classifier is down, so it is called once per tick', async () => {
    const first = pending(3 * 60_000, { job_id: JOB, reviewer_id: PETER, reviewee_id: AMINA, review_text: 'One.' })
    const second = pending(2 * 60_000, { job_id: OTHER_JOB, reviewer_id: ESTHER, reviewee_id: AMINA, review_text: 'Two.' })
    inference.state.mode = 'down'

    const outcome = await service.retryPending()
    assert.equal(outcome.classified, 0)
    assert.match(outcome.stopped, /unreachable/)
    assert.equal(inference.calls.length, 1)
    assert.equal(inference.calls[0].text, 'One.')
    assert.equal(first.pending_classification, true)
    assert.equal(second.pending_classification, true)
    assert.deepEqual(scoring.recomputed, [])
    assert.ok(logger.lines.some((l) => l.level === 'warn' && /2 still pending/.test(l.text)))
  })

  it('skips a review the classifier refuses, and carries on with the rest', async () => {
    pending(3 * 60_000, { job_id: JOB, reviewer_id: PETER, reviewee_id: AMINA, review_text: 'Refused.' })
    const good = pending(2 * 60_000, { job_id: OTHER_JOB, reviewer_id: ESTHER, reviewee_id: AMINA, review_text: 'Good.' })
    inference.state.refuse.add('Refused.')

    const outcome = await service.retryPending()
    assert.deepEqual(outcome, { checked: 2, classified: 1, skipped: 1, stopped: null })
    assert.equal(good.pending_classification, false)
    assert.ok(logger.lines.some((l) => l.level === 'error' && /cannot be classified/.test(l.text)))
  })

  it(`takes at most ${RETRY_BATCH} reviews a tick, oldest first`, async () => {
    for (let i = 0; i < RETRY_BATCH + 5; i++) {
      pending((100 - i) * 60_000, { job_id: JOB, reviewer_id: PETER, reviewee_id: AMINA, review_text: `Review ${i}.` })
    }
    const outcome = await service.retryPending()
    assert.equal(outcome.classified, RETRY_BATCH)
    assert.equal(inference.calls[0].text, 'Review 0.')
    assert.equal(reviews.rows.filter((r) => r.pending_classification).length, 5)
  })

  it('does not overlap: a second call while one is running shares it', async () => {
    pending(2 * 60_000, { job_id: JOB, reviewer_id: PETER, reviewee_id: AMINA, review_text: 'Once.' })
    const [a, b] = await Promise.all([service.retryPending(), service.retryPending()])
    assert.equal(a, b)
    assert.equal(inference.calls.length, 1)
  })

  it('keeps going when a recompute fails, and logs it', async () => {
    const review = pending(2 * 60_000, { job_id: JOB, reviewer_id: PETER, reviewee_id: AMINA, review_text: 'Fine.' })
    scoring.recompute = async () => {
      throw new Error('database unavailable')
    }
    const outcome = await service.retryPending()
    assert.equal(outcome.classified, 1)
    assert.equal(review.pending_classification, false)
    assert.ok(logger.lines.some((l) => l.level === 'error' && /recompute failed/.test(l.text)))
  })

  it('start() runs now and then every minute, until stopped', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    let ticks = 0
    reviews.listPending = async () => {
      ticks += 1
      return []
    }
    const flush = () => new Promise((resolve) => setImmediate(resolve))

    const stop = service.start()
    await flush()
    assert.equal(ticks, 1)

    t.mock.timers.tick(RETRY_INTERVAL_MS)
    await flush()
    assert.equal(ticks, 2)

    stop()
    t.mock.timers.tick(RETRY_INTERVAL_MS * 3)
    await flush()
    assert.equal(ticks, 2)
  })

  it('logs a tick that fails outright instead of crashing the process', async () => {
    reviews.listPending = async () => {
      throw new Error('database unavailable')
    }
    const stop = service.start(RETRY_INTERVAL_MS)
    await new Promise((resolve) => setImmediate(resolve))
    stop()
    assert.ok(logger.lines.some((l) => l.level === 'error' && /Classification retry failed/.test(l.text)))
  })
})
