import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { makeToken, verifyToken } from './helpers.js'

const AUTH = {
  amina: 'c0000000-0000-4000-8000-000000000001',
  peter: 'c0000000-0000-4000-8000-000000000002',
  esther: 'c0000000-0000-4000-8000-000000000003',
  daniel: 'c0000000-0000-4000-8000-000000000004',
  grace: 'c0000000-0000-4000-8000-000000000005',
}
const ID = {
  amina: 'd0000000-0000-4000-8000-000000000001',
  peter: 'd0000000-0000-4000-8000-000000000002',
  esther: 'd0000000-0000-4000-8000-000000000003',
  daniel: 'd0000000-0000-4000-8000-000000000004',
  grace: 'd0000000-0000-4000-8000-000000000005',
}

// In-memory users and jobs repositories. transition() keeps the same
// conditional-update rule as src/db/jobs.js.
function fakeDb() {
  const people = [
    { id: ID.amina, auth_id: AUTH.amina, name: 'Amina Wanjiru', role: 'client', company_name: 'Wanjiru Interiors Ltd', availability: null },
    { id: ID.daniel, auth_id: AUTH.daniel, name: 'Daniel Kiprop', role: 'client', company_name: null, availability: null },
    { id: ID.peter, auth_id: AUTH.peter, name: 'Peter Mwangi', role: 'worker', company_name: null, availability: true },
    { id: ID.esther, auth_id: AUTH.esther, name: 'Esther Njeri', role: 'worker', company_name: null, availability: true },
    { id: ID.grace, auth_id: AUTH.grace, name: 'Grace Otieno', role: 'worker', company_name: null, availability: false },
  ]
  const rows = []
  const byId = (id) => people.find((p) => p.id === id)
  const detail = (job) => ({
    ...job,
    client: { id: job.client_id, name: byId(job.client_id).name, company_name: byId(job.client_id).company_name },
    worker: job.worker_id ? { id: job.worker_id, name: byId(job.worker_id).name } : null,
  })
  const filter = (list, { status, category, q }) =>
    list
      .filter((j) => (!status || j.status === status) && (!category || j.category === category))
      .filter((j) => !q || j.title.toLowerCase().includes(q.toLowerCase()))

  return {
    rows,
    users: {
      async findByAuthId(authId) {
        return people.find((p) => p.auth_id === authId) ?? null
      },
      async findPublicById(id) {
        return byId(id) ?? null
      },
    },
    jobs: {
      async insert(row) {
        const job = {
          id: randomUUID(),
          worker_id: null,
          status: 'open',
          created_at: new Date().toISOString(),
          assigned_at: null,
          accepted_at: null,
          submitted_at: null,
          completed_at: null,
          cancelled_at: null,
          ...row,
        }
        rows.push(job)
        return { ...job }
      },
      async findById(id) {
        const job = rows.find((j) => j.id === id)
        return job ? detail(job) : null
      },
      async listForClient(clientId, filters) {
        return filter(rows.filter((j) => j.client_id === clientId), filters)
      },
      async listForWorker(workerId, filters) {
        return filter(rows.filter((j) => j.worker_id === workerId), filters)
      },
      async listOpen(filters) {
        return filter(rows, { ...filters, status: 'open' })
      },
      async transition(id, { from, fields, unsubmitted = false }) {
        const job = rows.find((j) => j.id === id && j.status === from && (!unsubmitted || j.submitted_at === null))
        if (!job) return null
        Object.assign(job, fields)
        return { ...job }
      },
    },
  }
}

const KITCHEN = {
  title: 'Fix kitchen plumbing',
  description: 'Leaking pipe under the kitchen sink and a slow drain.',
  category: 'plumbing',
  required_skills: ['Pipe fitting', 'drain  unblocking', 'pipe FITTING'],
}

describe('jobs', () => {
  let db
  let app
  let token
  let recomputed

  beforeEach(async () => {
    db = fakeDb()
    // Records which jobs the reputation service was asked about.
    recomputed = []
    const scoring = {
      async recomputeParties(job) {
        recomputed.push({ client_id: job.client_id, worker_id: job.worker_id, status: job.status })
      },
    }
    app = createApp({ verifyToken, users: db.users, jobs: db.jobs, scoring })
    token = {}
    for (const [name, sub] of Object.entries(AUTH)) {
      token[name] = 'Bearer ' + (await makeToken({ claims: { sub, email: `${name}@example.com` } }))
    }
  })

  const post = (path, who, body) => request(app).post('/api' + path).set('Authorization', token[who]).send(body)
  const get = (path, who) => request(app).get('/api' + path).set('Authorization', token[who])

  async function createJob(body = KITCHEN) {
    const res = await post('/jobs', 'amina', body)
    assert.equal(res.status, 201)
    return res.body.job.id
  }

  // Moves a new job along the legal path and stops at the named status.
  async function jobAt(status) {
    const id = await createJob()
    if (status === 'open') return id
    assert.equal((await post(`/jobs/${id}/assign`, 'amina', { worker_id: ID.peter })).status, 200)
    if (status === 'assigned') return id
    assert.equal((await post(`/jobs/${id}/accept`, 'peter')).status, 200)
    if (status === 'in_progress') return id
    assert.equal((await post(`/jobs/${id}/submit`, 'peter')).status, 200)
    if (status === 'submitted') return id
    assert.equal((await post(`/jobs/${id}/complete`, 'amina')).status, 200)
    return id
  }

  describe('POST /jobs', () => {
    it('creates an open job for the client, with required skills cleaned', async () => {
      const res = await post('/jobs', 'amina', KITCHEN)
      assert.equal(res.status, 201)
      assert.equal(res.body.job.status, 'open')
      assert.equal(res.body.job.client_id, ID.amina)
      assert.equal(res.body.job.worker_id, null)
      assert.deepEqual(res.body.job.required_skills, ['Pipe fitting', 'drain unblocking'])
    })

    it('refuses workers', async () => {
      const res = await post('/jobs', 'peter', KITCHEN)
      assert.equal(res.status, 403)
      assert.equal(res.body.error.code, 'wrong_role')
    })

    it('ignores client_id and status in the body', async () => {
      const res = await post('/jobs', 'amina', { ...KITCHEN, client_id: ID.daniel, status: 'completed' })
      assert.equal(res.body.job.client_id, ID.amina)
      assert.equal(res.body.job.status, 'open')
    })

    for (const [name, body] of [
      ['a blank title', { ...KITCHEN, title: '   ' }],
      ['a missing description', { ...KITCHEN, description: undefined }],
      ['an unknown category', { ...KITCHEN, category: 'roofing' }],
      ['required_skills that is not a list', { ...KITCHEN, required_skills: 'pipe fitting' }],
      ['more than ten required skills', { ...KITCHEN, required_skills: Array.from({ length: 11 }, (_, i) => `skill ${i}`) }],
    ]) {
      it(`rejects ${name}`, async () => {
        const res = await post('/jobs', 'amina', body)
        assert.equal(res.status, 400)
        assert.equal(res.body.error.code, 'validation_failed')
      })
    }
  })

  describe('legal transitions', () => {
    it('runs open, assigned, in progress, submitted, completed and dates every step', async () => {
      const id = await createJob()

      let res = await post(`/jobs/${id}/assign`, 'amina', { worker_id: ID.peter })
      assert.equal(res.status, 200)
      assert.equal(res.body.job.status, 'assigned')
      assert.equal(res.body.job.worker.name, 'Peter Mwangi')
      assert.ok(res.body.job.assigned_at)

      res = await post(`/jobs/${id}/accept`, 'peter')
      assert.equal(res.body.job.status, 'in_progress')
      assert.ok(res.body.job.accepted_at)
      assert.equal(res.body.job.submitted_at, null)

      res = await post(`/jobs/${id}/submit`, 'peter')
      assert.equal(res.status, 200)
      assert.equal(res.body.job.status, 'in_progress')
      assert.ok(res.body.job.submitted_at, 'submit sets submitted_at')

      res = await post(`/jobs/${id}/complete`, 'amina')
      assert.equal(res.body.job.status, 'completed')
      assert.ok(res.body.job.completed_at)

      assert.deepEqual(
        res.body.job.timeline.map((s) => [s.step, s.at !== null]),
        [['posted', true], ['assigned', true], ['accepted', true], ['submitted', true], ['completed', true]],
      )
    })

    it('cancels an open job', async () => {
      const id = await jobAt('open')
      const res = await post(`/jobs/${id}/cancel`, 'amina')
      assert.equal(res.status, 200)
      assert.equal(res.body.job.status, 'cancelled')
      assert.ok(res.body.job.cancelled_at)
      assert.equal(res.body.job.timeline.at(-1).step, 'cancelled')
    })

    it('cancels an assigned job and keeps the worker on it', async () => {
      const id = await jobAt('assigned')
      const res = await post(`/jobs/${id}/cancel`, 'amina')
      assert.equal(res.body.job.status, 'cancelled')
      assert.equal(res.body.job.worker_id, ID.peter)
    })
  })

  describe('reputation recompute (#49)', () => {
    it('recomputes both parties once a job is completed', async () => {
      await jobAt('completed')
      assert.deepEqual(recomputed, [{ client_id: ID.amina, worker_id: ID.peter, status: 'completed' }])
    })

    it('recomputes the parties of a cancelled job, with no worker if it was open', async () => {
      await post(`/jobs/${await jobAt('open')}/cancel`, 'amina')
      await post(`/jobs/${await jobAt('assigned')}/cancel`, 'amina')
      assert.deepEqual(recomputed, [
        { client_id: ID.amina, worker_id: null, status: 'cancelled' },
        { client_id: ID.amina, worker_id: ID.peter, status: 'cancelled' },
      ])
    })

    it('does not recompute for assign, accept or submit', async () => {
      await jobAt('submitted')
      assert.deepEqual(recomputed, [])
    })

    it('does not recompute when the status change is refused', async () => {
      const id = await jobAt('in_progress')
      assert.equal((await post(`/jobs/${id}/complete`, 'amina')).status, 409)
      assert.deepEqual(recomputed, [])
    })
  })

  describe('illegal transitions get 409', () => {
    const cases = [
      ['assign', 'assigned', 'amina', { worker_id: ID.esther }, 'invalid_transition'],
      ['assign', 'in_progress', 'amina', { worker_id: ID.esther }, 'invalid_transition'],
      ['accept', 'in_progress', 'peter', undefined, 'invalid_transition'],
      ['submit', 'assigned', 'peter', undefined, 'invalid_transition'],
      ['submit', 'submitted', 'peter', undefined, 'already_submitted'],
      ['submit', 'completed', 'peter', undefined, 'invalid_transition'],
      ['complete', 'assigned', 'amina', undefined, 'invalid_transition'],
      ['complete', 'in_progress', 'amina', undefined, 'not_submitted'],
      ['complete', 'completed', 'amina', undefined, 'invalid_transition'],
      ['cancel', 'in_progress', 'amina', undefined, 'invalid_transition'],
      ['cancel', 'completed', 'amina', undefined, 'invalid_transition'],
    ]
    for (const [action, status, who, body, code] of cases) {
      it(`${action} on a ${status.replace('_', ' ')} job: ${code}`, async () => {
        const id = await jobAt(status)
        const res = await post(`/jobs/${id}/${action}`, who, body)
        assert.equal(res.status, 409)
        assert.equal(res.body.error.code, code)
      })
    }

    it('cancel on a cancelled job', async () => {
      const id = await jobAt('open')
      await post(`/jobs/${id}/cancel`, 'amina')
      const res = await post(`/jobs/${id}/cancel`, 'amina')
      assert.equal(res.status, 409)
      assert.equal(res.body.error.code, 'invalid_transition')
    })

    it('a job that moved on between the read and the write', async () => {
      const id = await jobAt('in_progress')
      const realTransition = db.jobs.transition
      db.jobs.transition = async (jobId, args) => {
        db.rows.find((j) => j.id === jobId).submitted_at = new Date().toISOString()
        return realTransition(jobId, args)
      }
      const res = await post(`/jobs/${id}/submit`, 'peter')
      assert.equal(res.status, 409)
      assert.equal(res.body.error.code, 'job_changed')
    })
  })

  describe('who may act', () => {
    it('a worker cannot assign, complete or cancel', async () => {
      const id = await jobAt('in_progress')
      for (const action of ['assign', 'complete', 'cancel']) {
        const res = await post(`/jobs/${id}/${action}`, 'peter', { worker_id: ID.peter })
        assert.equal(res.status, 403, action)
        assert.equal(res.body.error.code, 'wrong_role')
      }
    })

    it('a client cannot accept or submit', async () => {
      const id = await jobAt('assigned')
      for (const action of ['accept', 'submit']) {
        const res = await post(`/jobs/${id}/${action}`, 'amina')
        assert.equal(res.status, 403, action)
      }
    })

    it("another client gets 404 on someone else's job", async () => {
      const id = await jobAt('open')
      const res = await post(`/jobs/${id}/cancel`, 'daniel')
      assert.equal(res.status, 404)
    })

    it('a worker who is not assigned cannot accept', async () => {
      const id = await jobAt('assigned')
      const res = await post(`/jobs/${id}/accept`, 'esther')
      assert.equal(res.status, 404)
    })

    it('a worker cannot accept an open job nobody assigned to them', async () => {
      const id = await jobAt('open')
      const res = await post(`/jobs/${id}/accept`, 'peter')
      assert.equal(res.status, 403)
      assert.equal(res.body.error.code, 'not_your_job')
    })
  })

  describe('assign', () => {
    it('needs a worker_id', async () => {
      const id = await jobAt('open')
      const res = await post(`/jobs/${id}/assign`, 'amina', {})
      assert.equal(res.status, 400)
    })

    it('refuses a client account as the worker', async () => {
      const id = await jobAt('open')
      const res = await post(`/jobs/${id}/assign`, 'amina', { worker_id: ID.daniel })
      assert.equal(res.status, 400)
    })

    it('refuses a worker who is not available', async () => {
      const id = await jobAt('open')
      const res = await post(`/jobs/${id}/assign`, 'amina', { worker_id: ID.grace })
      assert.equal(res.status, 409)
      assert.equal(res.body.error.code, 'worker_unavailable')
    })
  })

  describe('reading jobs', () => {
    it('lists a client their own jobs, filtered', async () => {
      await createJob()
      await createJob({ ...KITCHEN, title: 'Paint the reception', category: 'painting' })
      await post('/jobs', 'daniel', { ...KITCHEN, title: "Daniel's job" })

      let res = await get('/jobs', 'amina')
      assert.equal(res.body.jobs.length, 2)
      res = await get('/jobs?category=painting', 'amina')
      assert.deepEqual(res.body.jobs.map((j) => j.title), ['Paint the reception'])
      res = await get('/jobs?q=KITCHEN', 'amina')
      assert.deepEqual(res.body.jobs.map((j) => j.title), ['Fix kitchen plumbing'])
    })

    it('lists a worker only the jobs assigned to them', async () => {
      await jobAt('in_progress')
      await jobAt('open')
      const res = await get('/jobs', 'peter')
      assert.equal(res.body.jobs.length, 1)
      assert.equal((await get('/jobs', 'esther')).body.jobs.length, 0)
    })

    it('rejects an unknown status filter', async () => {
      const res = await get('/jobs?status=finished', 'amina')
      assert.equal(res.status, 400)
    })

    it('shows workers every open job under /jobs/available', async () => {
      await jobAt('open')
      await jobAt('assigned')
      const res = await get('/jobs/available', 'esther')
      assert.equal(res.status, 200)
      assert.equal(res.body.jobs.length, 1)
      assert.equal((await get('/jobs/available', 'amina')).status, 403)
    })

    it('shows detail with names and the timeline to the parties', async () => {
      const id = await jobAt('assigned')
      for (const who of ['amina', 'peter']) {
        const res = await get(`/jobs/${id}`, who)
        assert.equal(res.status, 200)
        assert.equal(res.body.job.client.company_name, 'Wanjiru Interiors Ltd')
        assert.equal(res.body.job.timeline.length, 5)
        assert.equal(res.body.job.timeline[2].at, null)
      }
    })

    it('hides a job from anyone else, except an open job from workers', async () => {
      const assigned = await jobAt('assigned')
      assert.equal((await get(`/jobs/${assigned}`, 'esther')).status, 404)
      assert.equal((await get(`/jobs/${assigned}`, 'daniel')).status, 404)
      const open = await jobAt('open')
      assert.equal((await get(`/jobs/${open}`, 'esther')).status, 200)
      assert.equal((await get(`/jobs/${open}`, 'daniel')).status, 404)
      assert.equal((await get('/jobs/not-a-uuid', 'amina')).status, 404)
    })
  })
})
