import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createClassificationService } from '../src/reviews/classification.js'
import { makeToken, verifyToken } from './helpers.js'
import { fakeInference, fakeReviewsRepo, fakeScoring, MODEL_VERSION, quietLogger } from './reviewFakes.js'

const AUTH = {
  amina: 'c1000000-0000-4000-8000-000000000001',
  peter: 'c1000000-0000-4000-8000-000000000002',
  daniel: 'c1000000-0000-4000-8000-000000000003',
  esther: 'c1000000-0000-4000-8000-000000000004',
}
const ID = {
  amina: 'd1000000-0000-4000-8000-000000000001',
  peter: 'd1000000-0000-4000-8000-000000000002',
  daniel: 'd1000000-0000-4000-8000-000000000003',
  esther: 'd1000000-0000-4000-8000-000000000004',
}
const JOB = {
  kitchen: 'e1000000-0000-4000-8000-000000000001',
  inProgress: 'e1000000-0000-4000-8000-000000000002',
  open: 'e1000000-0000-4000-8000-000000000003',
  elsewhere: 'e1000000-0000-4000-8000-000000000004',
}

const DAY_MS = 24 * 60 * 60 * 1000

const PEOPLE = [
  { id: ID.amina, auth_id: AUTH.amina, name: 'Amina Wanjiru', role: 'client' },
  { id: ID.peter, auth_id: AUTH.peter, name: 'Peter Mwangi', role: 'worker' },
  { id: ID.daniel, auth_id: AUTH.daniel, name: 'Daniel Kiprop', role: 'client' },
  { id: ID.esther, auth_id: AUTH.esther, name: 'Esther Njeri', role: 'worker' },
]
const JOBS = [
  { id: JOB.kitchen, title: 'Fix kitchen plumbing', status: 'completed', client_id: ID.amina, worker_id: ID.peter },
  { id: JOB.inProgress, title: 'Replace bathroom tap', status: 'in_progress', client_id: ID.amina, worker_id: ID.peter },
  { id: JOB.open, title: 'Paint the office', status: 'open', client_id: ID.daniel, worker_id: null },
  { id: JOB.elsewhere, title: 'Rewire reception lighting', status: 'completed', client_id: ID.daniel, worker_id: ID.esther },
]

const users = {
  async findByAuthId(authId) {
    return PEOPLE.find((p) => p.auth_id === authId) ?? null
  },
  async findPublicById(id) {
    return PEOPLE.find((p) => p.id === id) ?? null
  },
}
const jobs = {
  async findById(id) {
    const job = JOBS.find((j) => j.id === id)
    return job ? { ...job } : null
  },
}

const AMINA_ON_PETER = {
  rating: 5,
  review_text: 'Peter was punctual and professional. I would hire him again.',
}
const PETER_ON_AMINA = {
  rating: 4,
  review_text: 'Amina explained the job clearly and paid promptly.',
}

describe('reviews (#50)', () => {
  let reviews
  let inference
  let scoring
  let logger
  let app
  let token
  let clock

  beforeEach(async () => {
    // The route reads the real time for visibility, so the fake clock is the
    // real time at the start of each test.
    clock = new Date()
    const now = () => clock
    reviews = fakeReviewsRepo({ now })
    inference = fakeInference()
    scoring = fakeScoring()
    logger = quietLogger()
    const classification = createClassificationService({ reviews, inference, scoring, now, logger })
    app = createApp({ verifyToken, users, jobs, reviews, scoring, classification })
    token = {}
    for (const [name, sub] of Object.entries(AUTH)) {
      token[name] = 'Bearer ' + (await makeToken({ claims: { sub, email: `${name}@example.com` } }))
    }
  })

  const post = (who, jobId, body) =>
    request(app).post(`/api/jobs/${jobId}/reviews`).set('Authorization', token[who]).send(body)
  const get = (who, jobId) => request(app).get(`/api/jobs/${jobId}/reviews`).set('Authorization', token[who])

  describe('POST /jobs/:id/reviews', () => {
    it('saves the review, stores its classification and recomputes the reviewee', async () => {
      const res = await post('amina', JOB.kitchen, AMINA_ON_PETER)
      assert.equal(res.status, 201)
      const { review } = res.body
      assert.equal(review.reviewer_id, ID.amina)
      assert.equal(review.reviewee_id, ID.peter)
      assert.equal(review.rating, 5)
      assert.equal(review.pending_classification, false)
      assert.equal(review.sentiment.label, 'positive')
      assert.equal(review.sentiment.confidence_score, 0.9)
      assert.equal(review.sentiment.model_version, MODEL_VERSION)

      const stored = reviews.sentiments.get(review.id)
      assert.equal(stored.model_version, MODEL_VERSION)
      assert.equal(stored.sentences.length, 1)
      assert.equal(inference.calls.length, 1)
      assert.equal(inference.calls[0].text, AMINA_ON_PETER.review_text)
      // Peter only: the pair is not complete, so Amina's received review
      // situation has not changed.
      assert.deepEqual(scoring.recomputed, [ID.peter])
    })

    it('lets the worker review the client, and recomputes both once the pair is complete', async () => {
      await post('amina', JOB.kitchen, AMINA_ON_PETER)
      scoring.recomputed.length = 0

      const res = await post('peter', JOB.kitchen, PETER_ON_AMINA)
      assert.equal(res.status, 201)
      assert.equal(res.body.review.reviewee_id, ID.amina)
      // Peter first, because Amina's review of him has just become visible;
      // then Amina, once Peter's review of her is classified.
      assert.deepEqual(scoring.recomputed, [ID.peter, ID.amina])
    })

    it('saves the review as pending when the classifier is down, with no sentiment row', async () => {
      inference.state.mode = 'down'
      const res = await post('amina', JOB.kitchen, AMINA_ON_PETER)
      assert.equal(res.status, 201)
      assert.equal(res.body.review.pending_classification, true)
      assert.equal(res.body.review.sentiment, null)
      assert.equal(reviews.sentiments.size, 0)
      assert.equal(reviews.rows[0].pending_classification, true)
      // The full five-second, two-retry budget was allowed.
      assert.equal(inference.calls[0].attempts, 3)
      assert.deepEqual(scoring.recomputed, [])
      assert.ok(logger.lines.some((l) => l.level === 'warn' && /pending classification/.test(l.text)))
    })

    it('still recomputes the reviewer when the pair completes with the classifier down', async () => {
      await post('amina', JOB.kitchen, AMINA_ON_PETER)
      scoring.recomputed.length = 0
      inference.state.mode = 'down'

      const res = await post('peter', JOB.kitchen, PETER_ON_AMINA)
      assert.equal(res.body.review.pending_classification, true)
      // Amina's classified review of Peter is now visible and counts, even
      // though Peter's own review is waiting.
      assert.deepEqual(scoring.recomputed, [ID.peter])
    })

    it('stores the text trimmed', async () => {
      const res = await post('amina', JOB.kitchen, { rating: 4, review_text: '  Good work, tidy finish.  ' })
      assert.equal(res.body.review.review_text, 'Good work, tidy finish.')
      assert.equal(inference.calls[0].text, 'Good work, tidy finish.')
    })

    it('refuses a second review of the same job by the same person', async () => {
      await post('amina', JOB.kitchen, AMINA_ON_PETER)
      const res = await post('amina', JOB.kitchen, { rating: 1, review_text: 'Changed my mind.' })
      assert.equal(res.status, 409)
      assert.equal(res.body.error.code, 'already_reviewed')
      assert.equal(reviews.rows.length, 1)
      assert.equal(inference.calls.length, 1)
    })

    it('refuses a job that is not completed', async () => {
      const res = await post('amina', JOB.inProgress, AMINA_ON_PETER)
      assert.equal(res.status, 409)
      assert.equal(res.body.error.code, 'job_not_completed')
      assert.equal(reviews.rows.length, 0)
    })

    it('checks the rating', async () => {
      for (const rating of [0, 6, 4.5, '5', null, undefined]) {
        const res = await post('amina', JOB.kitchen, { rating, review_text: 'Fine.' })
        assert.equal(res.status, 400, `rating ${rating}`)
        assert.match(res.body.error.message, /rating/)
      }
      assert.equal(reviews.rows.length, 0)
    })

    it('checks the text, including text the classifier would find empty', async () => {
      for (const review_text of ['', '   ', 'x'.repeat(5001), 42, '<b></b>', '!!! ...', '<br>']) {
        const res = await post('amina', JOB.kitchen, { rating: 4, review_text })
        assert.equal(res.status, 400, JSON.stringify(review_text))
        assert.match(res.body.error.message, /review_text/)
      }
      assert.equal(reviews.rows.length, 0)
      assert.equal(inference.calls.length, 0)
    })

    it('accepts text of exactly 5000 characters', async () => {
      const res = await post('amina', JOB.kitchen, { rating: 4, review_text: 'a'.repeat(5000) })
      assert.equal(res.status, 201)
    })

    it('refuses a body that is not an object', async () => {
      const res = await request(app)
        .post(`/api/jobs/${JOB.kitchen}/reviews`)
        .set('Authorization', token.amina)
        .set('content-type', 'application/json')
        .send('[1, 2]')
      assert.equal(res.status, 400)
    })

    it('hides jobs the caller cannot see behind a 404', async () => {
      for (const jobId of [JOB.elsewhere, 'e1000000-0000-4000-8000-0000000000ff', 'not-an-id']) {
        const res = await post('amina', jobId, AMINA_ON_PETER)
        assert.equal(res.status, 404, jobId)
      }
    })

    it('gives 403 to a worker looking at an open job they are not on', async () => {
      const res = await post('peter', JOB.open, AMINA_ON_PETER)
      assert.equal(res.status, 403)
      assert.equal(res.body.error.code, 'not_your_job')
    })

    it('needs a token', async () => {
      const res = await request(app).post(`/api/jobs/${JOB.kitchen}/reviews`).send(AMINA_ON_PETER)
      assert.equal(res.status, 401)
    })
  })

  describe('GET /jobs/:id/reviews', () => {
    it('shows nothing before anyone has reviewed', async () => {
      const res = await get('peter', JOB.kitchen)
      assert.equal(res.status, 200)
      assert.deepEqual(res.body, { job_id: JOB.kitchen, can_review: true, written: null, received: { status: 'none' } })
    })

    it("hides the other party's review until the caller has reviewed too", async () => {
      await post('amina', JOB.kitchen, AMINA_ON_PETER)

      const peter = await get('peter', JOB.kitchen)
      assert.equal(peter.body.can_review, true)
      const visibleAt = new Date(clock.getTime() + 14 * DAY_MS).toISOString()
      assert.deepEqual(peter.body.received, { status: 'hidden', visible_at: visibleAt })
      assert.equal(JSON.stringify(peter.body).includes('punctual'), false)

      const amina = await get('amina', JOB.kitchen)
      assert.equal(amina.body.can_review, false)
      assert.equal(amina.body.written.review_text, AMINA_ON_PETER.review_text)
      assert.equal(amina.body.written.sentiment.model_version, MODEL_VERSION)
      assert.deepEqual(amina.body.received, { status: 'none' })
    })

    it('shows both reviews once the pair is complete', async () => {
      await post('amina', JOB.kitchen, AMINA_ON_PETER)
      await post('peter', JOB.kitchen, PETER_ON_AMINA)

      const res = await get('peter', JOB.kitchen)
      assert.equal(res.body.can_review, false)
      assert.equal(res.body.written.reviewer_id, ID.peter)
      assert.equal(res.body.received.status, 'visible')
      assert.equal(res.body.received.review.rating, 5)
      assert.equal(res.body.received.review.sentiment.label, 'positive')
    })

    it('shows the review after 14 days even if the caller never answers', async () => {
      reviews.seed({
        job_id: JOB.kitchen,
        reviewer_id: ID.amina,
        reviewee_id: ID.peter,
        ...AMINA_ON_PETER,
        created_at: new Date(clock.getTime() - 14 * DAY_MS - 1000).toISOString(),
      })
      const res = await get('peter', JOB.kitchen)
      assert.equal(res.body.received.status, 'visible')
      assert.equal(res.body.received.review.sentiment, null)
      assert.equal(res.body.received.review.pending_classification, true)
    })

    it('says a job that is not completed cannot be reviewed yet', async () => {
      const res = await get('amina', JOB.inProgress)
      assert.equal(res.body.can_review, false)
    })

    it('is for the two parties only', async () => {
      assert.equal((await get('amina', JOB.elsewhere)).status, 404)
      assert.equal((await get('peter', JOB.open)).status, 403)
    })
  })
})
