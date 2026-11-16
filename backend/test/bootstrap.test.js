import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { makeToken, verifyToken } from './helpers.js'

// An in-memory stand-in for db/users.js that records the rows inserted.
function fakeUsers({ raceWinner = null } = {}) {
  const rows = []
  return {
    rows,
    inserts: 0,
    async findByAuthId(authId) {
      const row = rows.find((r) => r.auth_id === authId) ?? (this.inserts > 0 ? raceWinner : null)
      if (!row) return null
      const { auth_id, ...visible } = row
      return visible
    },
    async insert(row) {
      this.inserts += 1
      if (raceWinner) return null
      const stored = { id: `user-${rows.length + 1}`, bio: null, created_at: '2026-11-16T18:00:00Z', ...row }
      rows.push(stored)
      const { auth_id, ...visible } = stored
      return visible
    },
  }
}

describe('POST /api/me/bootstrap', () => {
  let users
  let app
  let token

  beforeEach(async () => {
    users = fakeUsers()
    app = createApp({ verifyToken, users })
    token = await makeToken()
  })

  function bootstrap(body, bearer = token) {
    const req = request(app).post('/api/me/bootstrap')
    if (bearer) req.set('Authorization', `Bearer ${bearer}`)
    return req.send(body)
  }

  it('creates a worker row from the token and the body', async () => {
    const res = await bootstrap({ name: '  Peter Mwangi ', role: 'worker' })
    assert.equal(res.status, 201)
    assert.equal(users.rows.length, 1)
    assert.deepEqual(users.rows[0], {
      id: 'user-1',
      bio: null,
      created_at: '2026-11-16T18:00:00Z',
      auth_id: '6f1c2d3e-0000-4000-8000-000000000001',
      email: 'peter.mwangi@example.com',
      name: 'Peter Mwangi',
      role: 'worker',
      company_name: null,
      availability: true,
    })
    assert.equal(res.body.user.auth_id, undefined, 'auth_id is never returned')
  })

  it('creates a client row with a company and no availability', async () => {
    const res = await bootstrap({ name: 'Amina Wanjiru', role: 'client', company_name: 'Wanjiru Interiors Ltd' })
    assert.equal(res.status, 201)
    assert.equal(res.body.user.company_name, 'Wanjiru Interiors Ltd')
    assert.equal(res.body.user.availability, null)
  })

  it('ignores an email in the body and uses the one in the token', async () => {
    await bootstrap({ name: 'Peter Mwangi', role: 'worker', email: 'someone.else@example.com' })
    assert.equal(users.rows[0].email, 'peter.mwangi@example.com')
  })

  it('returns the existing row on a second call and does not change the role', async () => {
    await bootstrap({ name: 'Peter Mwangi', role: 'worker' })
    const res = await bootstrap({ name: 'Peter M', role: 'client' })
    assert.equal(res.status, 200)
    assert.equal(res.body.user.role, 'worker')
    assert.equal(res.body.user.name, 'Peter Mwangi')
    assert.equal(users.inserts, 1)
  })

  it('returns the other request\'s row when two first calls race', async () => {
    const winner = { id: 'user-9', name: 'Peter Mwangi', role: 'worker' }
    app = createApp({ verifyToken, users: fakeUsers({ raceWinner: winner }) })
    const res = await bootstrap({ name: 'Peter Mwangi', role: 'worker' })
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.user, winner)
  })

  for (const [label, body] of [
    ['no body', undefined],
    ['a blank name', { name: '   ', role: 'worker' }],
    ['a name over 100 characters', { name: 'x'.repeat(101), role: 'worker' }],
    ['an unknown role', { name: 'Peter Mwangi', role: 'admin' }],
    ['a company name on a worker', { name: 'Peter Mwangi', role: 'worker', company_name: 'Mwangi Plumbing' }],
    ['a company name that is not text', { name: 'Amina Wanjiru', role: 'client', company_name: 7 }],
  ]) {
    it(`rejects ${label} with 400`, async () => {
      const res = await bootstrap(body)
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, 'validation_failed')
      assert.equal(users.inserts, 0)
    })
  }

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/me/bootstrap')
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json')
      .send('{"name": "Peter"')
    assert.equal(res.status, 400)
    assert.equal(res.body.error.code, 'invalid_json')
  })

  it('rejects a request with no token before reading the body', async () => {
    const res = await bootstrap({ name: 'Peter Mwangi', role: 'worker' }, null)
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'missing_token')
    assert.equal(users.inserts, 0)
  })

  it('rejects a header that is not a Bearer token', async () => {
    const res = await request(app).post('/api/me/bootstrap').set('Authorization', `Basic ${token}`).send({})
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'missing_token')
  })

  it('rejects an expired token', async () => {
    const res = await bootstrap({ name: 'Peter Mwangi', role: 'worker' }, await makeToken({ expiresIn: '-1m' }))
    assert.equal(res.status, 401)
    assert.equal(res.body.error.code, 'token_expired')
  })
})

describe('routes around authentication', () => {
  const app = createApp({ verifyToken, users: fakeUsers() })

  it('serves /api/health without a token', async () => {
    const res = await request(app).get('/api/health')
    assert.equal(res.status, 200)
  })

  it('answers an unknown /api route with 401 when there is no token', async () => {
    const res = await request(app).get('/api/nothing-here')
    assert.equal(res.status, 401)
  })

  it('answers an unknown /api route with 404 when the token is valid', async () => {
    const res = await request(app).get('/api/nothing-here').set('Authorization', `Bearer ${await makeToken()}`)
    assert.equal(res.status, 404)
    assert.equal(res.body.error.code, 'not_found')
  })
})
