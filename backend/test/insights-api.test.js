import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { makeToken, verifyToken } from './helpers.js'

const MODEL = 'distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8'
const AUTH = {
  amina: 'c2000000-0000-4000-8000-000000000001',
  peter: 'c2000000-0000-4000-8000-000000000002',
  esther: 'c2000000-0000-4000-8000-000000000003',
  stranger: 'c2000000-0000-4000-8000-000000000004',
}
const ID = {
  amina: 'd2000000-0000-4000-8000-000000000001',
  peter: 'd2000000-0000-4000-8000-000000000002',
  esther: 'd2000000-0000-4000-8000-000000000003',
}
const hoursAgo = (n) => new Date(Date.now() - n * 60 * 60 * 1000).toISOString()

// In-memory stand-ins for the four repositories the route reads.
function fakeDb() {
  const people = [
    { id: ID.amina, auth_id: AUTH.amina, name: 'Amina Wanjiru', role: 'client' },
    { id: ID.peter, auth_id: AUTH.peter, name: 'Peter Mwangi', role: 'worker' },
    { id: ID.esther, auth_id: AUTH.esther, name: 'Esther Njeri', role: 'worker' },
  ]
  // Fix kitchen plumbing: both reviewed, so both reviews are visible.
  // Rewire reception lighting: only Amina has reviewed, so Peter cannot see hers.
  const reviews = [
    {
      job_id: 'kitchen', reviewer_id: ID.amina, reviewee_id: ID.peter, rating: 5, created_at: hoursAgo(30),
      sentiment: { label: 'positive', model_version: MODEL, sentences: [{ text: 'peter arrived on time.', label: 'positive', confidence: 0.91 }] },
    },
    {
      job_id: 'kitchen', reviewer_id: ID.peter, reviewee_id: ID.amina, rating: 4, created_at: hoursAgo(29),
      sentiment: { label: 'positive', model_version: MODEL, sentences: [{ text: 'paid through m-pesa the same day.', label: 'positive', confidence: 0.88 }] },
    },
    {
      job_id: 'lighting', reviewer_id: ID.amina, reviewee_id: ID.peter, rating: 2, created_at: hoursAgo(2),
      sentiment: { label: 'negative', model_version: MODEL, sentences: [{ text: 'he rescheduled without telling me.', label: 'negative', confidence: 0.97 }] },
    },
  ]
  const calls = []
  return {
    calls,
    users: {
      async findByAuthId(authId) {
        return people.find((p) => p.auth_id === authId) ?? null
      },
    },
    reviews: {
      async listReceivedForInsights(userId) {
        calls.push(['listReceivedForInsights', userId])
        return reviews.filter((r) => r.reviewee_id === userId)
      },
      async jobIdsReviewedBy(userId, jobIds) {
        return new Set(reviews.filter((r) => r.reviewer_id === userId && jobIds.includes(r.job_id)).map((r) => r.job_id))
      },
    },
    jobs: {
      async historyFor(userId, role) {
        calls.push(['historyFor', userId, role])
        return userId === ID.esther ? [] : [{ status: 'completed', assigned_at: hoursAgo(50), completed_at: hoursAgo(31) }]
      },
    },
    reputation: {
      async findForUser(userId) {
        return userId === ID.peter
          ? { score: 3.3, ratings_component: 5, sentiment_component: 3, history_component: 0.5, review_count: 1, provisional: true }
          : null
      },
    },
  }
}

describe('GET /api/me/insights', () => {
  let db
  let app
  const token = {}

  beforeEach(async () => {
    db = fakeDb()
    app = createApp({ verifyToken, users: db.users, reviews: db.reviews, jobs: db.jobs, reputation: db.reputation })
    for (const [name, sub] of Object.entries(AUTH)) {
      token[name] = 'Bearer ' + (await makeToken({ claims: { sub, email: `${name}@example.com` } }))
    }
  })

  const get = (who, query = '') => request(app).get(`/api/me/insights${query}`).set('Authorization', token[who])

  it("returns the worker's dashboard over six months by default", async () => {
    const res = await get('peter')
    assert.equal(res.status, 200)
    assert.equal(res.body.role, 'worker')
    assert.equal(res.body.period.key, '6m')
    assert.equal(res.body.period.months.length, 6)
    assert.equal(res.body.summary.reputation.score, 3.3)
    assert.deepEqual(res.body.summary.reviews, { count: 1, at_period_start: 0, pending: 0 })
    assert.deepEqual(res.body.summary.jobs_completed, { count: 1, at_period_start: 0 })
    assert.deepEqual(res.body.themes.map((t) => [t.key, t.reviews, t.of, t.sentiment]), [['punctuality', 1, 1, 'positive']])
    assert.deepEqual(res.body.guidance, [])
    assert.deepEqual(db.calls, [['listReceivedForInsights', ID.peter], ['historyFor', ID.peter, 'worker']])
  })

  it('keeps a review Peter cannot see yet out of his dashboard', async () => {
    const body = JSON.stringify((await get('peter')).body)
    assert.doesNotMatch(body, /advance_notice|rescheduled/)
    const res = await get('peter')
    assert.equal(res.body.sentiment_by_month.reduce((sum, m) => sum + m.total, 0), 1)
  })

  it('accepts 3m', async () => {
    const res = await get('peter', '?period=3m')
    assert.equal(res.status, 200)
    assert.equal(res.body.period.months.length, 3)
  })

  it('uses the client lexicon for a client', async () => {
    const res = await get('amina')
    assert.equal(res.status, 200)
    assert.equal(res.body.role, 'client')
    assert.equal(res.body.summary.reputation, null)
    assert.deepEqual(res.body.themes.map((t) => [t.key, t.name]), [['payment', 'Paying as agreed']])
  })

  it('gives a worker with no reviews an empty dashboard', async () => {
    const res = await get('esther')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.summary.reviews, { count: 0, at_period_start: 0, pending: 0 })
    assert.deepEqual(res.body.summary.average_rating, { value: null, at_period_start: null })
    assert.deepEqual(res.body.themes, [])
    assert.deepEqual(res.body.guidance, [])
    assert.ok(res.body.sentiment_by_month.every((m) => m.percent === null))
  })

  for (const query of ['?period=1y', '?period=6M', '?period=toString', '?period=3m&period=6m', '?period=']) {
    it(`refuses ${query} with 400`, async () => {
      const res = await get('peter', query)
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, 'validation_failed')
      assert.match(res.body.error.message, /3m, 6m/)
    })
  }

  it('needs a token', async () => {
    const res = await request(app).get('/api/me/insights')
    assert.equal(res.status, 401)
  })

  it('needs a users row', async () => {
    const res = await get('stranger')
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'not_bootstrapped')
  })
})
