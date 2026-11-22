import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { ALLOWED_HEADERS, ALLOWED_METHODS, CorsConfigError, parseOrigins, PREFLIGHT_MAX_AGE_S } from '../src/cors.js'
import { verifyToken } from './helpers.js'

const VERCEL = 'https://ratings-reputation-system.vercel.app'
const LOCAL = 'http://localhost:5173'
const OTHER = 'https://evil.example.com'

describe('parseOrigins (#73)', () => {
  it('reads one origin', () => {
    assert.deepEqual(parseOrigins(VERCEL), [VERCEL])
  })

  it('reads a comma-separated list and ignores spaces and empty entries', () => {
    assert.deepEqual(parseOrigins(` ${VERCEL} , ${LOCAL} ,`), [VERCEL, LOCAL])
  })

  it('refuses an unset or empty value', () => {
    for (const value of [undefined, '', ' , ']) {
      assert.throws(() => parseOrigins(value), CorsConfigError)
    }
  })

  it('refuses a trailing slash and names the origin to use instead', () => {
    assert.throws(() => parseOrigins(`${VERCEL}/`), (err) => err instanceof CorsConfigError && err.message.endsWith(`Use ${VERCEL}`))
  })

  it('refuses a path and capital letters, which a browser never sends', () => {
    assert.throws(() => parseOrigins(`${VERCEL}/app`), CorsConfigError)
    assert.throws(() => parseOrigins('https://Ratings-Reputation-System.vercel.app'), CorsConfigError)
  })

  it('refuses text that is not an http or https URL', () => {
    assert.throws(() => parseOrigins('ratings-reputation-system.vercel.app'), CorsConfigError)
    assert.throws(() => parseOrigins('*'), CorsConfigError)
    assert.throws(() => parseOrigins('file:///C:/app'), CorsConfigError)
  })
})

describe('CORS middleware (#73)', () => {
  // The routes behind the token check need no data access here, because a
  // request without a token stops at the check.
  const app = createApp({ verifyToken, corsOrigins: [VERCEL, LOCAL] })

  it('lets an allowed origin read a public route', async () => {
    const res = await request(app).get('/api/live').set('Origin', VERCEL)
    assert.equal(res.status, 200)
    assert.equal(res.headers['access-control-allow-origin'], VERCEL)
    assert.match(res.headers.vary, /Origin/)
    assert.equal(res.headers['access-control-allow-credentials'], undefined)
  })

  it('names the requesting origin, not the whole list', async () => {
    const res = await request(app).get('/api/live').set('Origin', LOCAL)
    assert.equal(res.headers['access-control-allow-origin'], LOCAL)
  })

  it('sends no allow header to another origin, but still answers', async () => {
    const res = await request(app).get('/api/live').set('Origin', OTHER)
    assert.equal(res.status, 200)
    assert.equal(res.headers['access-control-allow-origin'], undefined)
    assert.match(res.headers.vary, /Origin/)
  })

  it('sends no allow header when there is no Origin, as for Render health checks', async () => {
    const res = await request(app).get('/api/live')
    assert.equal(res.status, 200)
    assert.equal(res.headers['access-control-allow-origin'], undefined)
  })

  it('answers a preflight to a route behind the token check with 204, not 401', async () => {
    const res = await request(app)
      .options('/api/me')
      .set('Origin', VERCEL)
      .set('Access-Control-Request-Method', 'PATCH')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
    assert.equal(res.status, 204)
    assert.equal(res.headers['access-control-allow-origin'], VERCEL)
    assert.equal(res.headers['access-control-allow-methods'], ALLOWED_METHODS)
    assert.equal(res.headers['access-control-allow-headers'], ALLOWED_HEADERS)
    assert.equal(res.headers['access-control-max-age'], String(PREFLIGHT_MAX_AGE_S))
  })

  it('gives another origin a preflight answer without the allow headers, so its browser blocks the call', async () => {
    const res = await request(app)
      .options('/api/me')
      .set('Origin', OTHER)
      .set('Access-Control-Request-Method', 'GET')
    assert.equal(res.status, 204)
    assert.equal(res.headers['access-control-allow-origin'], undefined)
    assert.equal(res.headers['access-control-allow-methods'], undefined)
  })

  it('puts the allow header on a 401, so the frontend can read the error', async () => {
    const res = await request(app).get('/api/me').set('Origin', VERCEL)
    assert.equal(res.status, 401)
    assert.equal(res.headers['access-control-allow-origin'], VERCEL)
  })

  it('puts the allow header on a 400 for bad JSON', async () => {
    const res = await request(app)
      .post('/api/me/bootstrap')
      .set('Origin', VERCEL)
      .set('Content-Type', 'application/json')
      .send('{not json')
    assert.equal(res.status, 400)
    assert.equal(res.headers['access-control-allow-origin'], VERCEL)
  })

  it('allows no origin when the app is built without a list', async () => {
    const bare = createApp({ verifyToken })
    const res = await request(bare).get('/api/live').set('Origin', VERCEL)
    assert.equal(res.headers['access-control-allow-origin'], undefined)
  })
})
