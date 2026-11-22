import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { startBackgroundTimer, TICK_INTERVAL_MS } from '../src/background.js'
import { createReputationService } from '../src/reputation/recompute.js'
import { VISIBILITY_DAYS } from '../src/reviews/visibility.js'
import { createVisibilitySweep, SWEEP_BATCH } from '../src/reviews/visibilitySweep.js'
import { quietLogger } from './reviewFakes.js'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const AMINA = 'f3000000-0000-4000-8000-000000000001'
const PETER = 'f3000000-0000-4000-8000-000000000002'
const ESTHER = 'f3000000-0000-4000-8000-000000000003'

// ---------------------------------------------------------------------------
// The sweep on its own, with the database query stubbed.

describe('visibility sweep (#53)', () => {
  let due
  let asked
  let recomputed
  let logger
  let sweep
  const clock = new Date('2026-11-21T09:00:00Z')

  beforeEach(() => {
    due = []
    asked = []
    recomputed = []
    logger = quietLogger()
    const reviews = {
      async listRevieweesDueForVisibility(args) {
        asked.push(args)
        return due
      },
    }
    const scoring = {
      async recompute(userId) {
        recomputed.push(userId)
        return {}
      },
    }
    sweep = createVisibilitySweep({ reviews, scoring, now: () => clock, logger }).sweep
  })

  it('asks for reviewees due at the current time with the 14-day rule, in batches', async () => {
    await sweep()
    assert.deepEqual(asked, [{ now: clock, days: VISIBILITY_DAYS, limit: SWEEP_BATCH }])
    assert.equal(VISIBILITY_DAYS, 14)
  })

  it('recomputes each reviewee found and logs one line', async () => {
    due = [PETER, AMINA]
    const outcome = await sweep()
    assert.deepEqual(outcome, { checked: 2, recomputed: 2, failed: 0 })
    assert.deepEqual(recomputed, [PETER, AMINA])
    assert.ok(logger.lines.some((l) => l.level === 'info' && /2 of 2 users recomputed/.test(l.text)))
  })

  it('logs nothing when nobody is due', async () => {
    assert.deepEqual(await sweep(), { checked: 0, recomputed: 0, failed: 0 })
    assert.equal(logger.lines.length, 0)
  })

  it('carries on past a failed recompute and says it will be tried again', async () => {
    const reviews = { listRevieweesDueForVisibility: async () => [PETER, AMINA] }
    const scoring = {
      async recompute(userId) {
        if (userId === PETER) throw new Error('database unavailable')
        recomputed.push(userId)
      },
    }
    const outcome = await createVisibilitySweep({ reviews, scoring, now: () => clock, logger }).sweep()
    assert.deepEqual(outcome, { checked: 2, recomputed: 1, failed: 1 })
    assert.deepEqual(recomputed, [AMINA])
    assert.ok(logger.lines.some((l) => l.level === 'error' && new RegExp(`recompute failed for user ${PETER}`).test(l.text)))
    assert.ok(logger.lines.some((l) => l.level === 'warn' && /1 will be tried again/.test(l.text)))
  })

  it('does not overlap: a second call while one is running shares it', async () => {
    due = [PETER]
    const [a, b] = await Promise.all([sweep(), sweep()])
    assert.equal(a, b)
    assert.equal(asked.length, 1)
  })
})

// ---------------------------------------------------------------------------
// The sweep with the real reputation service, on an in-memory database whose
// listRevieweesDueForVisibility follows the same rule as the SQL function in
// migration 20261121090000. This checks the claim the rule rests on: a
// recompute moves last_updated to the moment it judged visibility at, so a
// review is found once, at the first tick after its 14-day mark.

function memoryDb() {
  const users = new Map([
    [AMINA, { id: AMINA, role: 'client' }],
    [PETER, { id: PETER, role: 'worker' }],
    [ESTHER, { id: ESTHER, role: 'worker' }],
  ])
  const reviews = []
  const jobs = []
  const scores = new Map()

  const answered = (r) => reviews.some((a) => a.job_id === r.job_id && a.reviewer_id === r.reviewee_id)

  return {
    reviews,
    jobs,
    scores,
    repos: {
      users: { findPublicById: async (id) => users.get(id) ?? null },
      jobs: {
        async historyFor(userId) {
          return jobs.filter((j) => j.client_id === userId || j.worker_id === userId)
        },
      },
      reputation: {
        async save(userId, result, at) {
          const row = { ...result, last_updated: at.toISOString() }
          scores.set(userId, row)
          return row
        },
      },
      reviews: {
        async listReceived(userId) {
          return reviews.filter((r) => r.reviewee_id === userId)
        },
        async jobIdsReviewedBy(userId, jobIds) {
          return new Set(reviews.filter((r) => r.reviewer_id === userId && jobIds.includes(r.job_id)).map((r) => r.job_id))
        },
        // Mirrors public.reviewees_due_visibility_recompute.
        async listRevieweesDueForVisibility({ now, days, limit }) {
          const due = new Set()
          for (const r of reviews) {
            if (!r.sentiment) continue
            const mark = new Date(r.created_at).getTime() + days * DAY
            if (mark > now.getTime()) continue
            const score = scores.get(r.reviewee_id)
            if (score && mark <= new Date(score.last_updated).getTime()) continue
            if (answered(r)) continue
            due.add(r.reviewee_id)
          }
          return [...due].slice(0, limit)
        },
      },
    },
  }
}

describe('visibility sweep with the reputation service', () => {
  let clock
  let db
  let scoring
  let sweep
  const now = () => clock

  // A completed job between Amina and Peter, and the reviews written on it.
  function job(id, reviewsWritten) {
    db.jobs.push({ id, client_id: AMINA, worker_id: PETER, status: 'completed', assigned_at: clock.toISOString() })
    for (const [reviewer, reviewee, rating, label, createdAt] of reviewsWritten) {
      db.reviews.push({
        job_id: id,
        reviewer_id: reviewer,
        reviewee_id: reviewee,
        rating,
        created_at: createdAt.toISOString(),
        sentiment: label ? { label, confidence_score: 0.9 } : null,
      })
    }
  }

  beforeEach(async () => {
    clock = new Date('2026-11-21T09:00:00Z')
    db = memoryDb()
    scoring = createReputationService({ ...db.repos, now })
    sweep = createVisibilitySweep({ reviews: db.repos.reviews, scoring, now, logger: quietLogger() }).sweep

    // Peter's live data: two answered 5-star reviews, one neutral and one positive.
    const earlier = new Date(clock.getTime() - 2 * DAY)
    job('kitchen', [
      [AMINA, PETER, 5, 'neutral', earlier],
      [PETER, AMINA, 4, 'positive', earlier],
    ])
    job('bathroom', [
      [AMINA, PETER, 5, 'positive', earlier],
      [PETER, AMINA, 5, 'positive', earlier],
    ])
    // A third completed job, reviewed by Amina only, written 14 days ago less
    // one minute: still hidden.
    job('shower', [[AMINA, PETER, 4, 'positive', new Date(clock.getTime() - VISIBILITY_DAYS * DAY + MINUTE)]])
    await scoring.recompute(PETER)
  })

  it('leaves the hidden review out until its mark, then counts it at the next tick', async () => {
    const before = db.scores.get(PETER)
    assert.equal(before.review_count, 2)
    assert.equal(before.provisional, true)
    assert.equal(before.score, 3.77) // R 5.00, S 3.67, H 1.50

    // Half a minute before the mark: nothing to do.
    clock = new Date(clock.getTime() + MINUTE / 2)
    assert.equal((await sweep()).checked, 0)

    // The next tick after the mark.
    clock = new Date(clock.getTime() + MINUTE)
    assert.deepEqual(await sweep(), { checked: 1, recomputed: 1, failed: 0 })
    const after = db.scores.get(PETER)
    assert.equal(after.review_count, 3)
    assert.equal(after.provisional, false)
    assert.equal(after.ratings_component, 4.67)
    assert.equal(after.sentiment_component, 4.33) // (3 + 5 + 5) / 3, the neutral prior gone
    assert.equal(after.score, 3.9)

    // Found once: the tick after that has nothing to do.
    clock = new Date(clock.getTime() + MINUTE)
    assert.equal((await sweep()).checked, 0)
  })

  it('catches up after the API slept through the mark', async () => {
    clock = new Date(clock.getTime() + 3 * DAY)
    assert.deepEqual(await sweep(), { checked: 1, recomputed: 1, failed: 0 })
    assert.equal(db.scores.get(PETER).review_count, 3)
  })

  it('leaves out a review that is still pending classification', async () => {
    db.reviews.find((r) => r.job_id === 'shower').sentiment = null
    clock = new Date(clock.getTime() + 2 * MINUTE)
    assert.equal((await sweep()).checked, 0)
  })

  it('leaves out a review the reviewee answered, which was counted when the answer came', async () => {
    db.reviews.push({ job_id: 'shower', reviewer_id: PETER, reviewee_id: AMINA, rating: 5, created_at: clock.toISOString(), sentiment: null })
    await scoring.recompute(PETER)
    assert.equal(db.scores.get(PETER).review_count, 3)
    clock = new Date(clock.getTime() + 2 * MINUTE)
    assert.equal((await sweep()).checked, 0)
  })

  it('finds a reviewee who has no reputation row yet', async () => {
    db.scores.delete(PETER)
    clock = new Date(clock.getTime() + 2 * MINUTE)
    assert.equal((await sweep()).checked, 1)
    assert.equal(db.scores.get(PETER).review_count, 3)
  })

  it('finds the user again next tick when the recompute failed', async () => {
    clock = new Date(clock.getTime() + 2 * MINUTE)
    const save = db.repos.reputation.save
    db.repos.reputation.save = async () => {
      throw new Error('database unavailable')
    }
    assert.deepEqual(await sweep(), { checked: 1, recomputed: 0, failed: 1 })
    db.repos.reputation.save = save
    clock = new Date(clock.getTime() + MINUTE)
    assert.deepEqual(await sweep(), { checked: 1, recomputed: 1, failed: 0 })
  })
})

// ---------------------------------------------------------------------------
// The one-minute timer that runs the retry and then the sweep.

describe('background timer (decision of 18 November)', () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve))

  it('ticks now and then every minute, until stopped', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    let ticks = 0
    const stop = startBackgroundTimer({ tasks: [{ name: 'Count', run: async () => (ticks += 1) }], logger: quietLogger() })
    await flush()
    assert.equal(ticks, 1)

    t.mock.timers.tick(TICK_INTERVAL_MS)
    await flush()
    assert.equal(ticks, 2)

    stop()
    t.mock.timers.tick(TICK_INTERVAL_MS * 3)
    await flush()
    assert.equal(ticks, 2)
    assert.equal(TICK_INTERVAL_MS, 60_000)
  })

  it('runs the tasks in order, one after the other', async () => {
    const order = []
    let release
    const retry = async () => {
      order.push('retry started')
      await new Promise((resolve) => (release = resolve))
      order.push('retry done')
    }
    const stop = startBackgroundTimer({
      tasks: [
        { name: 'Classification retry', run: retry },
        { name: 'Visibility sweep', run: async () => order.push('sweep') },
      ],
      logger: quietLogger(),
    })
    await flush()
    assert.deepEqual(order, ['retry started'])
    release()
    await flush()
    stop()
    assert.deepEqual(order, ['retry started', 'retry done', 'sweep'])
  })

  it('still runs the sweep when the retry fails, and logs the failure', async () => {
    const logger = quietLogger()
    let swept = false
    const stop = startBackgroundTimer({
      tasks: [
        {
          name: 'Classification retry',
          run: async () => {
            throw new Error('database unavailable')
          },
        },
        { name: 'Visibility sweep', run: async () => (swept = true) },
      ],
      logger,
    })
    await flush()
    stop()
    assert.equal(swept, true)
    assert.ok(logger.lines.some((l) => l.level === 'error' && /Classification retry failed/.test(l.text)))
  })

  it('skips a tick while the previous one is still running', async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] })
    let started = 0
    let release
    const stop = startBackgroundTimer({
      tasks: [
        {
          name: 'Slow',
          run: () => {
            started += 1
            return new Promise((resolve) => (release = resolve))
          },
        },
      ],
      logger: quietLogger(),
    })
    t.mock.timers.tick(TICK_INTERVAL_MS)
    await flush()
    assert.equal(started, 1)
    release()
    await flush()
    t.mock.timers.tick(TICK_INTERVAL_MS)
    await flush()
    stop()
    assert.equal(started, 2)
  })
})
