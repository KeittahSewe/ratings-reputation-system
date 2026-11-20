import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { DISCLOSURE } from '../src/recommendations/match.js'
import { makeToken, verifyToken } from './helpers.js'

const AUTH = {
  amina: 'c1000000-0000-4000-8000-000000000001',
  daniel: 'c1000000-0000-4000-8000-000000000002',
  peter: 'c1000000-0000-4000-8000-000000000003',
}
const ID = {
  amina: 'd1000000-0000-4000-8000-000000000001',
  daniel: 'd1000000-0000-4000-8000-000000000002',
  peter: 'd1000000-0000-4000-8000-000000000003',
  esther: 'd1000000-0000-4000-8000-000000000004',
  grace: 'd1000000-0000-4000-8000-000000000005',
  faith: 'd1000000-0000-4000-8000-000000000006',
}
const JOB = {
  open: 'f1000000-0000-4000-8000-000000000001',
  danielsOpen: 'f1000000-0000-4000-8000-000000000002',
  kitchen: 'f1000000-0000-4000-8000-000000000003',
  cancelled: 'f1000000-0000-4000-8000-000000000004',
}

// In-memory stand-ins for the four repositories the route reads.
function fakeDb() {
  const people = [
    { id: ID.amina, auth_id: AUTH.amina, name: 'Amina Wanjiru', role: 'client', availability: null },
    { id: ID.daniel, auth_id: AUTH.daniel, name: 'Daniel Kiprop', role: 'client', availability: null },
    { id: ID.peter, auth_id: AUTH.peter, name: 'Peter Mwangi', role: 'worker', availability: true },
    { id: ID.esther, name: 'Esther Njeri', role: 'worker', availability: true },
    { id: ID.grace, name: 'Grace Otieno', role: 'worker', availability: false },
    { id: ID.faith, name: 'Faith Chebet', role: 'worker', availability: true },
  ]
  const jobs = [
    {
      id: JOB.open,
      client_id: ID.amina,
      worker_id: null,
      title: 'Rewire reception lighting',
      category: 'electrical',
      required_skills: ['Electrical wiring', 'Lighting installation'],
      status: 'open',
    },
    { id: JOB.danielsOpen, client_id: ID.daniel, worker_id: null, title: 'Fit shelves', category: 'carpentry', required_skills: [], status: 'open' },
    { id: JOB.kitchen, client_id: ID.amina, worker_id: ID.peter, title: 'Fix kitchen plumbing', category: 'plumbing', required_skills: [], status: 'completed' },
    // Daniel cancelled Esther's job after assigning her: not a hire.
    { id: JOB.cancelled, client_id: ID.daniel, worker_id: ID.esther, title: 'Fit shelves', category: 'carpentry', required_skills: [], status: 'cancelled' },
  ]
  const skills = new Map([
    [ID.peter, [{ id: 's1', skill_name: 'Basic electrical wiring', category: 'electrical' }, { id: 's2', skill_name: 'Residential plumbing', category: 'plumbing' }]],
    [ID.esther, [{ id: 's3', skill_name: 'Electrical wiring', category: 'electrical' }, { id: 's4', skill_name: 'Lighting installation', category: 'electrical' }]],
    [ID.grace, [{ id: 's5', skill_name: 'Electrical wiring', category: 'electrical' }]],
  ])
  const scores = new Map([[ID.peter, { score: 3.3, ratings_component: 5, sentiment_component: 3, history_component: 0.5, review_count: 1, provisional: true, last_updated: '2026-11-18T20:51:00.000Z' }]])

  const calls = []
  return {
    calls,
    users: {
      async findByAuthId(authId) {
        return people.find((p) => p.auth_id === authId) ?? null
      },
      async listAvailableWorkers() {
        return people.filter((p) => p.role === 'worker' && p.availability)
      },
    },
    jobs: {
      async findById(id) {
        return jobs.find((j) => j.id === id) ?? null
      },
      async completedCountsFor(ids) {
        calls.push(['completedCountsFor', ids])
        const counts = new Map()
        for (const j of jobs) if (j.status === 'completed' && ids.includes(j.worker_id)) counts.set(j.worker_id, (counts.get(j.worker_id) ?? 0) + 1)
        return counts
      },
      async workersHiredBy(clientId) {
        return new Set(jobs.filter((j) => j.client_id === clientId && j.status === 'completed').map((j) => j.worker_id))
      },
    },
    skills: {
      async listForUsers(ids) {
        return new Map([...skills].filter(([id]) => ids.includes(id)))
      },
    },
    reputation: {
      async findForUsers(ids) {
        return new Map([...scores].filter(([id]) => ids.includes(id)))
      },
    },
    setStatus(id, status) {
      jobs.find((j) => j.id === id).status = status
    },
  }
}

describe('GET /api/jobs/:id/recommendations', () => {
  let db
  let app
  const token = {}

  beforeEach(async () => {
    db = fakeDb()
    app = createApp({ verifyToken, users: db.users, jobs: db.jobs, skills: db.skills, reputation: db.reputation })
    for (const [name, sub] of Object.entries(AUTH)) {
      token[name] = 'Bearer ' + (await makeToken({ claims: { sub, email: `${name}@example.com` } }))
    }
  })

  const get = (id, who) => request(app).get(`/api/jobs/${id}/recommendations`).set('Authorization', token[who])

  it("ranks the available workers for the client's open job", async () => {
    const res = await get(JOB.open, 'amina')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.job, {
      id: JOB.open,
      title: 'Rewire reception lighting',
      category: 'electrical',
      required_skills: ['Electrical wiring', 'Lighting installation'],
    })
    assert.equal(res.body.total, 3)
    assert.equal(res.body.disclosure, DISCLOSURE)
    assert.deepEqual(
      res.body.recommendations.map((c) => [c.rank, c.worker.name, c.match]),
      [
        [1, 'Peter Mwangi', 74], // scored: 37.5 + 26.4 + 10
        [2, 'Esther Njeri', 50], // no reviews yet: listed after every scored worker
        [3, 'Faith Chebet', 0], // no electrical skill and no reviews
      ],
    )
  })

  it('sends each card with its parts and three explanation sentences', async () => {
    const [peter] = (await get(JOB.open, 'amina')).body.recommendations
    assert.deepEqual(peter.worker, { id: ID.peter, name: 'Peter Mwangi' })
    assert.equal(peter.completed_jobs, 1)
    assert.equal(peter.reputation.score, 3.3)
    assert.equal(peter.reputation.provisional, true)
    assert.deepEqual(peter.match_points, { skill: 37.5, reputation: 26.4, hired_before: 10 })
    assert.equal(peter.skill_match, 0.75)
    assert.deepEqual(peter.skills_held, [{ required: 'Electrical wiring', listed_as: 'Basic electrical wiring' }])
    assert.deepEqual(peter.skills_missing, ['Lighting installation'])
    assert.equal(peter.hired_before, true)
    assert.equal(peter.explanation.length, 3)
    assert.equal(peter.explanation[2], 'You have hired this worker before.')
  })

  it('leaves out workers whose availability is off', async () => {
    const res = await get(JOB.open, 'amina')
    assert.ok(!res.body.recommendations.some((c) => c.worker.id === ID.grace))
  })

  it('does not count a cancelled job as a hire', async () => {
    const res = await get(JOB.danielsOpen, 'daniel')
    assert.equal(res.status, 200)
    for (const card of res.body.recommendations) assert.equal(card.hired_before, false)
  })

  it('refuses workers with 403 wrong_role', async () => {
    const res = await get(JOB.open, 'peter')
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'wrong_role')
  })

  it("answers another client's job with the same 404 as a missing one", async () => {
    for (const id of [JOB.danielsOpen, 'f1000000-0000-4000-8000-0000000000ff', 'not-a-uuid']) {
      const res = await get(id, 'amina')
      assert.equal(res.status, 404)
      assert.equal(res.body.error.code, 'not_found')
    }
  })

  it('refuses a job that is not open with 409 job_not_open', async () => {
    db.setStatus(JOB.open, 'assigned')
    const res = await get(JOB.open, 'amina')
    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, 'job_not_open')
    assert.match(res.body.error.message, /This job is assigned/)
  })

  it('returns an empty list when no worker is available', async () => {
    db.users.listAvailableWorkers = async () => []
    const res = await get(JOB.open, 'amina')
    assert.equal(res.status, 200)
    assert.equal(res.body.total, 0)
    assert.deepEqual(res.body.recommendations, [])
  })
})
