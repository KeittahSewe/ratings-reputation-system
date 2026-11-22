import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { isVisible } from '../src/reviews/visibility.js'
import { makeToken, verifyToken } from './helpers.js'

const NOW = new Date('2026-11-18T12:00:00Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

describe('isVisible', () => {
  it('shows a review once the reviewee has reviewed the same job', () => {
    assert.equal(isVisible({ job_id: 'j1', created_at: daysAgo(1) }, new Set(['j1']), NOW), true)
  })

  it('hides a one-sided review for 14 days', () => {
    assert.equal(isVisible({ job_id: 'j1', created_at: daysAgo(13.9) }, new Set(), NOW), false)
  })

  it('shows a one-sided review after 14 days', () => {
    assert.equal(isVisible({ job_id: 'j1', created_at: daysAgo(14) }, new Set(), NOW), true)
  })

  it('does not count a return review on a different job', () => {
    assert.equal(isVisible({ job_id: 'j1', created_at: daysAgo(2) }, new Set(['j2']), NOW), false)
  })
})

const PETER_ID = 'b0000000-0000-4000-8000-000000000001'
const AMINA_ID = 'b0000000-0000-4000-8000-000000000002'

function fakes() {
  const people = {
    [PETER_ID]: { id: PETER_ID, name: 'Peter Mwangi', role: 'worker', company_name: null, bio: 'Licensed plumber', availability: true, created_at: '2025-01-10T00:00:00Z' },
    [AMINA_ID]: { id: AMINA_ID, name: 'Amina Wanjiru', role: 'client', company_name: 'Wanjiru Interiors Ltd', bio: null, availability: null, created_at: '2025-03-01T00:00:00Z' },
  }
  const reviewer = (name) => ({ id: 'r-' + name, name, role: 'client' })
  // Reviews Peter has received, newest first, as listReceived returns them.
  const received = [
    // Amina has not been reviewed back yet and it is 2 days old: hidden.
    { id: 'rev-new', job_id: 'job-new', rating: 3, review_text: 'Fine', created_at: new Date(Date.now() - 2 * 864e5).toISOString(), reviewer: reviewer('Amina Wanjiru'), job: { id: 'job-new', title: 'Replace kitchen tap' }, sentiment: null },
    // Peter reviewed Amina back on this job: visible.
    { id: 'rev-pair', job_id: 'job-plumbing', rating: 5, review_text: 'Arrived on time', created_at: new Date(Date.now() - 3 * 864e5).toISOString(), reviewer: reviewer('Amina Wanjiru'), job: { id: 'job-plumbing', title: 'Fix kitchen plumbing' }, sentiment: { label: 'positive', confidence_score: 0.97 } },
    // One-sided but older than 14 days: visible.
    { id: 'rev-old', job_id: 'job-old', rating: 4, review_text: 'Good work', created_at: new Date(Date.now() - 30 * 864e5).toISOString(), reviewer: reviewer('Faith Chebet'), job: { id: 'job-old', title: 'Unblock drain' }, sentiment: { label: 'neutral', confidence_score: 0.71 } },
  ]
  return {
    users: {
      async findByAuthId() {
        // Every caller in these tests is a bootstrapped client.
        return { id: AMINA_ID, role: 'client', name: 'Amina Wanjiru' }
      },
      async findPublicById(id) {
        return people[id] ?? null
      },
    },
    skills: {
      async listForUser(userId) {
        return userId === PETER_ID ? [{ id: 's1', skill_name: 'Residential plumbing', category: 'plumbing' }] : []
      },
    },
    reputation: {
      async findForUser() {
        return null
      },
    },
    jobs: {
      // Peter: two completed and one cancelled by a client. Amina: none.
      async historyFor(userId) {
        if (userId !== PETER_ID) return []
        return [
          { status: 'completed', assigned_at: '2026-08-01T00:00:00Z', completed_at: '2026-08-12T00:00:00Z' },
          { status: 'completed', assigned_at: '2026-09-01T00:00:00Z', completed_at: '2026-09-03T00:00:00Z' },
          { status: 'cancelled', assigned_at: '2026-10-01T00:00:00Z', completed_at: null },
        ]
      },
    },
    reviews: {
      async listReceived(userId) {
        return userId === PETER_ID ? received : []
      },
      async jobIdsReviewedBy(userId, jobIds) {
        return new Set(userId === PETER_ID ? jobIds.filter((j) => j === 'job-plumbing') : [])
      },
    },
  }
}

describe('GET /api/users/:id', () => {
  const app = createApp({ verifyToken, ...fakes() })
  const get = async (id) => request(app).get(`/api/users/${id}`).set('Authorization', `Bearer ${await makeToken()}`)

  it('returns a worker profile with skills and only the visible reviews', async () => {
    const res = await get(PETER_ID)
    assert.equal(res.status, 200)
    assert.equal(res.body.user.name, 'Peter Mwangi')
    assert.equal(res.body.user.email, undefined, 'email is never shown to other users')
    assert.equal(res.body.skills.length, 1)
    assert.equal(res.body.reputation, null)
    assert.equal(res.body.review_count, 2)
    assert.equal(res.body.completed_jobs, 2, 'cancelled jobs are not completed jobs')
    assert.deepEqual(res.body.reviews.map((r) => r.id), ['rev-pair', 'rev-old'])
    assert.equal(res.body.reviews[0].job_id, undefined)
    assert.deepEqual(res.body.reviews[0].sentiment, { label: 'positive', confidence_score: 0.97 })
  })

  it('returns a client profile with no skills', async () => {
    const res = await get(AMINA_ID)
    assert.equal(res.status, 200)
    assert.equal(res.body.user.company_name, 'Wanjiru Interiors Ltd')
    assert.deepEqual(res.body.skills, [])
    assert.deepEqual(res.body.reviews, [])
    assert.equal(res.body.completed_jobs, 0)
  })

  it('answers 404 for an unknown id and for a malformed one', async () => {
    for (const id of ['b0000000-0000-4000-8000-0000000000ff', 'not-a-uuid']) {
      const res = await get(id)
      assert.equal(res.status, 404)
      assert.equal(res.body.error.code, 'not_found')
    }
  })
})
