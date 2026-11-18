import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { beforeEach, describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { makeToken, verifyToken } from './helpers.js'

const PETER = { sub: 'a0000000-0000-4000-8000-000000000001', email: 'peter.mwangi@example.com' }
const AMINA = { sub: 'a0000000-0000-4000-8000-000000000002', email: 'amina.wanjiru@example.com' }
const NEWCOMER = { sub: 'a0000000-0000-4000-8000-000000000003', email: 'new@example.com' }

// In-memory stand-ins for the three repositories in src/db, sharing one store.
function fakeDb() {
  const users = [
    { id: 'u-peter', auth_id: PETER.sub, email: PETER.email, name: 'Peter Mwangi', role: 'worker', company_name: null, bio: null, availability: true, created_at: '2026-11-16T19:49:34Z' },
    { id: 'u-amina', auth_id: AMINA.sub, email: AMINA.email, name: 'Amina Wanjiru', role: 'client', company_name: 'Wanjiru Interiors Ltd', bio: null, availability: null, created_at: '2026-11-16T19:50:00Z' },
  ]
  const skills = []
  const scores = { 'u-amina': { score: 4.7, ratings_component: 4.7, sentiment_component: 4.5, history_component: 5, last_updated: '2026-11-16T20:00:00Z' } }
  const hide = ({ auth_id, ...rest }) => rest
  const skillView = ({ user_id, ...rest }) => rest

  return {
    skillsStore: skills,
    users: {
      async findByAuthId(authId) {
        const row = users.find((u) => u.auth_id === authId)
        return row ? hide(row) : null
      },
      async insert() {
        throw new Error('not used here')
      },
      async update(id, fields) {
        const row = users.find((u) => u.id === id)
        Object.assign(row, fields)
        return hide(row)
      },
    },
    skills: {
      async listForUser(userId) {
        return skills
          .filter((s) => s.user_id === userId)
          .map(skillView)
          .sort((a, b) => a.skill_name.localeCompare(b.skill_name))
      },
      async insert(row) {
        if (skills.some((s) => s.user_id === row.user_id && s.skill_name === row.skill_name)) return null
        const stored = { id: randomUUID(), ...row }
        skills.push(stored)
        return skillView(stored)
      },
      async deleteForUser(id, userId) {
        const i = skills.findIndex((s) => s.id === id && s.user_id === userId)
        if (i === -1) return false
        skills.splice(i, 1)
        return true
      },
    },
    reputation: {
      async findForUser(userId) {
        return scores[userId] ?? null
      },
    },
  }
}

describe('profile and skills', () => {
  let db
  let app
  let tokens

  beforeEach(async () => {
    db = fakeDb()
    app = createApp({ verifyToken, ...db })
    tokens = {
      peter: await makeToken({ claims: PETER }),
      amina: await makeToken({ claims: AMINA }),
      newcomer: await makeToken({ claims: NEWCOMER }),
    }
  })

  const as = (who) => ({ Authorization: `Bearer ${tokens[who]}` })

  describe('GET /api/me', () => {
    it('returns a worker with skills and no reputation yet', async () => {
      await request(app).post('/api/me/skills').set(as('peter')).send({ skill_name: 'Pipe fitting and repair', category: 'plumbing' })
      const res = await request(app).get('/api/me').set(as('peter'))
      assert.equal(res.status, 200)
      assert.equal(res.body.user.name, 'Peter Mwangi')
      assert.equal(res.body.user.auth_id, undefined)
      assert.deepEqual(res.body.skills.map((s) => s.skill_name), ['Pipe fitting and repair'])
      assert.equal(res.body.reputation, null)
    })

    it('returns a client with the reputation breakdown and no skills', async () => {
      const res = await request(app).get('/api/me').set(as('amina'))
      assert.equal(res.status, 200)
      assert.deepEqual(res.body.skills, [])
      assert.deepEqual(Object.keys(res.body.reputation), [
        'score', 'ratings_component', 'sentiment_component', 'history_component', 'last_updated',
      ])
    })

    it('tells an account without a users row to bootstrap first', async () => {
      const res = await request(app).get('/api/me').set(as('newcomer'))
      assert.equal(res.status, 403)
      assert.equal(res.body.error.code, 'not_bootstrapped')
    })
  })

  describe('PATCH /api/me', () => {
    it('lets a worker change name, bio and availability', async () => {
      const res = await request(app)
        .patch('/api/me')
        .set(as('peter'))
        .send({ name: ' Peter Mwangi ', bio: 'Licensed plumber, Nairobi and Kiambu.', availability: false })
      assert.equal(res.status, 200)
      assert.equal(res.body.user.name, 'Peter Mwangi')
      assert.equal(res.body.user.bio, 'Licensed plumber, Nairobi and Kiambu.')
      assert.equal(res.body.user.availability, false)
    })

    it('clears the bio when it is sent blank', async () => {
      await request(app).patch('/api/me').set(as('peter')).send({ bio: 'Something' })
      const res = await request(app).patch('/api/me').set(as('peter')).send({ bio: '   ' })
      assert.equal(res.body.user.bio, null)
    })

    it('lets a client change the company name', async () => {
      const res = await request(app).patch('/api/me').set(as('amina')).send({ company_name: 'Wanjiru Interiors' })
      assert.equal(res.status, 200)
      assert.equal(res.body.user.company_name, 'Wanjiru Interiors')
    })

    for (const [label, who, body] of [
      ['an empty body', 'peter', {}],
      ['a role change', 'peter', { role: 'client' }],
      ['an email change', 'peter', { email: 'x@example.com' }],
      ['availability on a client', 'amina', { availability: true }],
      ['availability that is not true or false', 'peter', { availability: 'yes' }],
      ['a company name on a worker', 'peter', { company_name: 'Mwangi Plumbing' }],
      ['a blank name', 'peter', { name: '  ' }],
      ['a bio over 1000 characters', 'peter', { bio: 'x'.repeat(1001) }],
    ]) {
      it(`rejects ${label} with 400 and changes nothing`, async () => {
        const res = await request(app).patch('/api/me').set(as(who)).send(body)
        assert.equal(res.status, 400)
        assert.equal(res.body.error.code, 'validation_failed')
        const after = await request(app).get('/api/me').set(as(who))
        assert.equal(after.body.user.role, who === 'peter' ? 'worker' : 'client')
        assert.equal(after.body.user.bio, null)
      })
    }
  })

  describe('/api/me/skills', () => {
    const add = (body, who = 'peter') => request(app).post('/api/me/skills').set(as(who)).send(body)

    it('adds, lists and removes a skill', async () => {
      const added = await add({ skill_name: '  Residential   plumbing ', category: 'plumbing' })
      assert.equal(added.status, 201)
      assert.equal(added.body.skill.skill_name, 'Residential plumbing')
      await add({ skill_name: 'Basic electrical wiring', category: 'electrical' })

      const listed = await request(app).get('/api/me/skills').set(as('peter'))
      assert.deepEqual(listed.body.skills.map((s) => s.skill_name), ['Basic electrical wiring', 'Residential plumbing'])

      const removed = await request(app).delete(`/api/me/skills/${added.body.skill.id}`).set(as('peter'))
      assert.equal(removed.status, 204)
      assert.equal(db.skillsStore.length, 1)
    })

    it('rejects a repeat that differs only in capitals', async () => {
      await add({ skill_name: 'Pipe fitting', category: 'plumbing' })
      const res = await add({ skill_name: 'pipe FITTING', category: 'plumbing' })
      assert.equal(res.status, 409)
      assert.equal(res.body.error.code, 'skill_exists')
      assert.equal(db.skillsStore.length, 1)
    })

    it('returns 409 when the database reports a duplicate', async () => {
      db.skills.listForUser = async () => []
      await add({ skill_name: 'Pipe fitting', category: 'plumbing' })
      const res = await add({ skill_name: 'Pipe fitting', category: 'plumbing' })
      assert.equal(res.status, 409)
    })

    for (const [label, body] of [
      ['a missing name', { category: 'plumbing' }],
      ['a name over 60 characters', { skill_name: 'x'.repeat(61), category: 'plumbing' }],
      ['an unknown category', { skill_name: 'Roofing', category: 'roofing' }],
    ]) {
      it(`rejects ${label} with 400`, async () => {
        const res = await add(body)
        assert.equal(res.status, 400)
        assert.equal(res.body.error.code, 'validation_failed')
      })
    }

    it('keeps clients out of every skills route', async () => {
      const responses = [
        await request(app).get('/api/me/skills').set(as('amina')),
        await add({ skill_name: 'Interior design', category: 'painting' }, 'amina'),
        await request(app).delete(`/api/me/skills/${randomUUID()}`).set(as('amina')),
      ]
      for (const res of responses) {
        assert.equal(res.status, 403)
        assert.equal(res.body.error.code, 'wrong_role')
      }
    })

    it('answers 404 for another worker\'s skill, a missing one and a malformed id', async () => {
      db.skillsStore.push({ id: randomUUID(), user_id: 'u-someone-else', skill_name: 'Painting', category: 'painting' })
      for (const id of [db.skillsStore[0].id, randomUUID(), 'not-a-uuid']) {
        const res = await request(app).delete(`/api/me/skills/${id}`).set(as('peter'))
        assert.equal(res.status, 404)
      }
      assert.equal(db.skillsStore.length, 1)
    })
  })
})
