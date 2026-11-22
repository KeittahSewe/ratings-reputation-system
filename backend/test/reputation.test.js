import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { createReputationService } from '../src/reputation/recompute.js'
import {
  computeReputation,
  historyComponent,
  historyCounts,
  oneDecimal,
  sentimentComponent,
  twoDecimals,
} from '../src/reputation/score.js'

// n copies of a review.
const times = (n, review) => Array.from({ length: n }, () => ({ ...review }))

// Peter Mwangi from the sample data: 41 reviews at 78 / 15 / 7 percent, which
// is 32 positive, 6 neutral and 3 negative. 37 five-star and 4 four-star
// ratings give 201 / 41 = 4.90. He has completed 41 jobs, and one job Amina
// cancelled after assigning him.
const PETER = {
  role: 'worker',
  reviews: [
    ...times(28, { rating: 5, label: 'positive' }),
    ...times(4, { rating: 4, label: 'positive' }),
    ...times(6, { rating: 5, label: 'neutral' }),
    ...times(3, { rating: 5, label: 'negative' }),
  ],
  completed: 41,
  cancelled: 1,
}

describe('reputation score (plan 3.4)', () => {
  describe("Peter Mwangi's worked example", () => {
    const result = computeReputation(PETER)

    it('reproduces the stored components and score', () => {
      assert.equal(result.ratings_component, 4.9)
      assert.equal(result.sentiment_component, 4.41) // 181 / 41
      assert.equal(result.history_component, 5) // 5 x min(1, 41 / 10)
      assert.equal(result.score, 4.72) // 0.4 x 4.90 + 0.4 x 4.41 + 0.2 x 5.00 = 4.724
      assert.equal(result.review_count, 41)
      assert.equal(result.provisional, false)
    })

    it('counts 32 positive, 6 neutral and 3 negative, the 78 / 15 / 7 of Figure 4.8 (#84)', () => {
      assert.deepEqual(result.sentiment_counts, { positive: 32, neutral: 6, negative: 3 })
    })

    it('displays sentiment 4.4 and overall 4.7, as on Figures 4.8 and 4.11', () => {
      assert.equal(oneDecimal(result.sentiment_component), 4.4)
      assert.equal(oneDecimal(result.score), 4.7)
    })

    it('builds the score from the stored components, so the breakdown reproduces it', () => {
      const fromBreakdown = 0.4 * result.ratings_component + 0.4 * result.sentiment_component + 0.2 * result.history_component
      assert.equal(twoDecimals(fromBreakdown), result.score)
    })

    it('does not hold the cancellation Amina made against Peter', () => {
      // Under plan 3.4 as first written this was 4.76 and the score 4.68.
      assert.equal(historyComponent({ role: 'worker', completed: 41, cancelled: 1 }), 5)
    })
  })

  describe('job history (H)', () => {
    it('gives zero to a worker with no completed jobs', () => {
      assert.equal(historyComponent({ role: 'worker', completed: 0 }), 0)
    })

    it('gives zero to a client with no jobs, without dividing by zero', () => {
      assert.equal(historyComponent({ role: 'client', completed: 0, cancelled: 0 }), 0)
    })

    it('gives zero to a client whose every job was cancelled after assigning', () => {
      assert.equal(historyComponent({ role: 'client', completed: 0, cancelled: 3 }), 0)
    })

    it('never goes below zero when cancellations outnumber completions', () => {
      assert.equal(historyComponent({ role: 'client', completed: 2, cancelled: 5 }), 0)
    })

    it('weighs a client cancellation at twice a completion', () => {
      // 5 x (1 - 2 x 1 / 12) x min(1, 11 / 10) = 4.1666...
      assert.equal(twoDecimals(historyComponent({ role: 'client', completed: 11, cancelled: 1 })), 4.17)
    })

    it('gives Amina full credit for 14 completed jobs and no cancellations', () => {
      assert.equal(historyComponent({ role: 'client', completed: 14, cancelled: 0 }), 5)
    })

    it('needs ten completed jobs for full credit', () => {
      assert.equal(historyComponent({ role: 'worker', completed: 4 }), 2)
      assert.equal(historyComponent({ role: 'worker', completed: 10 }), 5)
    })

    it('rejects counts that are not whole numbers and unknown roles', () => {
      assert.throws(() => historyComponent({ role: 'worker', completed: -1 }), TypeError)
      assert.throws(() => historyComponent({ role: 'worker', completed: 1.5 }), TypeError)
      assert.throws(() => historyComponent({ role: 'admin', completed: 1 }), TypeError)
    })
  })

  describe('which jobs count towards H', () => {
    const t = '2026-11-18T10:00:00Z'
    const jobs = [
      { status: 'completed', assigned_at: t },
      { status: 'completed', assigned_at: t },
      { status: 'cancelled', assigned_at: t }, // cancelled after assigning
      { status: 'cancelled', assigned_at: null }, // cancelled while open
    ]

    it('counts only cancellations of assigned jobs against a client', () => {
      assert.deepEqual(historyCounts('client', jobs), { completed: 2, cancelled: 1 })
    })

    it('counts no cancellations against a worker', () => {
      assert.deepEqual(historyCounts('worker', jobs), { completed: 2, cancelled: 0 })
    })

    it('makes cancelling an open job cost the client nothing', () => {
      const open = historyCounts('client', [...times(10, { status: 'completed', assigned_at: t }), { status: 'cancelled', assigned_at: null }])
      assert.equal(historyComponent({ role: 'client', ...open }), 5)
    })
  })

  describe('cold start: Provisional under three reviews, with one neutral prior', () => {
    it('stops one five-star positive review from producing a perfect sentiment', () => {
      const result = computeReputation({ role: 'worker', reviews: [{ rating: 5, label: 'positive' }], completed: 1 })
      assert.equal(result.sentiment_component, 4) // (5 + 3) / 2
      assert.equal(result.ratings_component, 5) // the prior applies to S only
      assert.equal(result.history_component, 0.5)
      assert.equal(result.score, 3.7) // 2.00 + 1.60 + 0.10
      assert.equal(result.provisional, true)
    })

    it('lifts a single negative review towards neutral', () => {
      assert.equal(sentimentComponent(['negative']), 2) // (1 + 3) / 2
    })

    it('leaves the neutral prior out of the sentiment counts', () => {
      const one = computeReputation({ role: 'worker', reviews: [{ rating: 5, label: 'positive' }], completed: 1 })
      assert.deepEqual(one.sentiment_counts, { positive: 1, neutral: 0, negative: 0 })
      assert.equal(one.review_count, 1)
    })

    it('keeps the prior at two reviews', () => {
      assert.equal(twoDecimals(sentimentComponent(['positive', 'positive'])), 4.33) // 13 / 3
      const result = computeReputation({ role: 'worker', reviews: times(2, { rating: 5, label: 'positive' }), completed: 2 })
      assert.equal(result.provisional, true)
    })

    it('drops the prior and the Provisional label at three reviews', () => {
      assert.equal(sentimentComponent(['positive', 'positive', 'positive']), 5)
      const result = computeReputation({ role: 'worker', reviews: times(3, { rating: 5, label: 'positive' }), completed: 3 })
      assert.equal(result.provisional, false)
    })

    it('stores nothing for a user with no counted reviews', () => {
      assert.equal(computeReputation({ role: 'worker', reviews: [], completed: 5 }), null)
    })
  })

  describe('rounding', () => {
    it('rounds half up even where the float sits just below the half', () => {
      assert.equal(Math.round(4.725 * 100) / 100, 4.72) // the naive way rounds down
      assert.equal(twoDecimals(4.725), 4.73)
      assert.equal(oneDecimal(4.45), 4.5)
    })

    it('rejects ratings and labels outside the allowed values', () => {
      assert.throws(() => computeReputation({ role: 'worker', reviews: [{ rating: 6, label: 'positive' }], completed: 1 }), TypeError)
      assert.throws(() => computeReputation({ role: 'worker', reviews: [{ rating: 5, label: 'mixed' }], completed: 1 }), TypeError)
    })
  })
})

// ---------------------------------------------------------------------------
// The service that reads the database and stores the result, with fakes.

const NOW = new Date('2026-11-18T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000
const ago = (days) => new Date(NOW.getTime() - days * DAY).toISOString()

const AMINA = 'a0000000-0000-4000-8000-000000000001'
const PETER_ID = 'a0000000-0000-4000-8000-000000000002'

function fakeRepos({ received = [], answeredJobs = [], history = [] } = {}) {
  const saved = []
  return {
    saved,
    users: {
      async findPublicById(id) {
        if (id === AMINA) return { id, role: 'client' }
        if (id === PETER_ID) return { id, role: 'worker' }
        return null
      },
    },
    reviews: {
      async listReceived() {
        return received
      },
      async jobIdsReviewedBy(userId, jobIds) {
        return new Set(answeredJobs.filter((j) => jobIds.includes(j)))
      },
    },
    jobs: {
      async historyFor() {
        return history
      },
    },
    reputation: {
      async save(userId, result, at) {
        saved.push({ userId, result, at })
        return result
      },
    },
  }
}

function service(repos) {
  return createReputationService({ ...repos, now: () => NOW })
}

const review = (jobId, { rating = 5, label = 'positive', created = ago(1) } = {}) => ({
  job_id: jobId,
  rating,
  created_at: created,
  sentiment: label ? { label, confidence_score: 0.97 } : null,
})

const DONE = { status: 'completed', assigned_at: ago(30) }

describe('reputation service', () => {
  it('leaves a hidden review out until the reviewee reviews back', async () => {
    const received = [review('job-1', { rating: 2, label: 'negative' }), review('job-2'), review('job-3')]
    const hidden = fakeRepos({ received, answeredJobs: ['job-2', 'job-3'], history: times(3, DONE) })
    const before = await service(hidden).recompute(PETER_ID)
    assert.equal(before.review_count, 2)
    assert.equal(before.ratings_component, 5)

    const shown = fakeRepos({ received, answeredJobs: ['job-1', 'job-2', 'job-3'], history: times(3, DONE) })
    const after = await service(shown).recompute(PETER_ID)
    assert.equal(after.review_count, 3)
    assert.equal(after.ratings_component, 4) // (2 + 5 + 5) / 3
  })

  it('counts a review once 14 days have passed, even if the pair is not complete', async () => {
    const repos = fakeRepos({ received: [review('job-1', { created: ago(14) }), review('job-2', { created: ago(13) })], history: [DONE] })
    const result = await service(repos).recompute(PETER_ID)
    assert.equal(result.review_count, 1)
  })

  it('leaves out a visible review that is still waiting for classification', async () => {
    const repos = fakeRepos({
      received: [review('job-1'), review('job-2', { label: null })],
      answeredJobs: ['job-1', 'job-2'],
      history: times(2, DONE),
    })
    const result = await service(repos).recompute(PETER_ID)
    assert.equal(result.review_count, 1)
  })

  it('writes no row when no review counts yet', async () => {
    const repos = fakeRepos({ received: [review('job-1')], history: [DONE] })
    assert.equal(await service(repos).recompute(PETER_ID), null)
    assert.equal(repos.saved.length, 0)
  })

  it("applies the client's history rule to a client", async () => {
    const repos = fakeRepos({
      received: [review('job-1')],
      answeredJobs: ['job-1'],
      history: [...times(11, DONE), { status: 'cancelled', assigned_at: ago(5) }, { status: 'cancelled', assigned_at: null }],
    })
    const result = await service(repos).recompute(AMINA)
    assert.equal(result.history_component, 4.17) // 11 completed, 1 counted cancellation
    assert.equal(repos.saved[0].userId, AMINA)
    assert.equal(repos.saved[0].at, NOW)
  })

  it('returns null for a user that does not exist', async () => {
    assert.equal(await service(fakeRepos()).recompute('a0000000-0000-4000-8000-00000000ffff'), null)
  })

  it('recomputes both parties of a job, and a failure for one does not stop the other', async () => {
    const repos = fakeRepos({ received: [review('job-1')], answeredJobs: ['job-1'], history: [DONE] })
    const original = repos.reviews.listReceived
    let calls = 0
    repos.reviews.listReceived = async (...args) => {
      calls += 1
      if (calls === 1) throw new Error('database unreachable')
      return original(...args)
    }
    const logged = mock.method(console, 'error', () => {})
    try {
      await service(repos).recomputeParties({ client_id: AMINA, worker_id: PETER_ID })
    } finally {
      logged.mock.restore()
    }
    assert.equal(logged.mock.callCount(), 1)
    assert.deepEqual(repos.saved.map((s) => s.userId), [PETER_ID])
  })

  it('skips the worker of a job cancelled while open', async () => {
    const repos = fakeRepos({ received: [review('job-1')], answeredJobs: ['job-1'], history: [DONE] })
    await service(repos).recomputeParties({ client_id: AMINA, worker_id: null })
    assert.deepEqual(repos.saved.map((s) => s.userId), [AMINA])
  })
})
