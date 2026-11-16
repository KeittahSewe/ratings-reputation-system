import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTokenVerifier, supabaseIssuer } from '../src/auth/tokens.js'
import { forgerPrivateKey, ISSUER, keySet, makeToken, verifyToken } from './helpers.js'

// Awaits the promise and returns the status and code of the ApiError it throws.
async function errorCode(promise) {
  try {
    await promise
  } catch (err) {
    return `${err.status} ${err.code}`
  }
  return 'no error'
}

describe('supabaseIssuer', () => {
  it('appends /auth/v1 to the project URL', () => {
    assert.equal(supabaseIssuer('https://abc.supabase.co'), 'https://abc.supabase.co/auth/v1')
    assert.equal(supabaseIssuer('https://abc.supabase.co/'), 'https://abc.supabase.co/auth/v1')
  })
})

describe('verifyToken', () => {
  it('returns the auth id and email from a valid token', async () => {
    const auth = await verifyToken(await makeToken())
    assert.deepEqual(auth, {
      authId: '6f1c2d3e-0000-4000-8000-000000000001',
      email: 'peter.mwangi@example.com',
    })
  })

  it('rejects an expired token', async () => {
    const token = await makeToken({ expiresIn: '-1m' })
    assert.equal(await errorCode(verifyToken(token)), '401 token_expired')
  })

  it('rejects a token from another Supabase project', async () => {
    const token = await makeToken({ claims: { iss: 'https://other.supabase.co/auth/v1' } })
    assert.equal(await errorCode(verifyToken(token)), '401 invalid_token')
  })

  it('rejects a token not meant for signed-in users', async () => {
    const token = await makeToken({ claims: { aud: 'service_role' } })
    assert.equal(await errorCode(verifyToken(token)), '401 invalid_token')
  })

  it('rejects a token signed with a different key under the project key id', async () => {
    const token = await makeToken({ key: forgerPrivateKey })
    assert.equal(await errorCode(verifyToken(token)), '401 invalid_token')
  })

  it('rejects an HS256 token, so a leaked legacy JWT secret is useless here', async () => {
    const secret = new TextEncoder().encode('legacy-jwt-secret-that-is-long-enough-for-hs256')
    const token = await makeToken({ key: secret, header: { alg: 'HS256', kid: 'project-key' } })
    assert.equal(await errorCode(verifyToken(token)), '401 invalid_token')
  })

  it('rejects an unsigned token', async () => {
    const payload = (await makeToken()).split('.')[1]
    const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${payload}.`
    assert.equal(await errorCode(verifyToken(unsigned)), '401 invalid_token')
  })

  it('rejects text that is not a token', async () => {
    assert.equal(await errorCode(verifyToken('not-a-token')), '401 invalid_token')
  })

  it('rejects an anonymous Supabase user', async () => {
    const token = await makeToken({ claims: { is_anonymous: true, email: '' } })
    assert.equal(await errorCode(verifyToken(token)), '401 invalid_token')
  })

  it('reports 503, not 401, when the public keys cannot be fetched', async () => {
    const unreachable = async () => {
      throw new TypeError('fetch failed')
    }
    const verify = createTokenVerifier({ issuer: ISSUER, keySet: unreachable })
    const errorLog = console.error
    console.error = () => {}
    try {
      assert.equal(await errorCode(verify(await makeToken())), '503 auth_unavailable')
    } finally {
      console.error = errorLog
    }
  })
})
