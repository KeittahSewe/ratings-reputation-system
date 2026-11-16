import { createRemoteJWKSet, errors, jwtVerify } from 'jose'
import { ApiError } from '../errors.js'

// Supabase Auth signs every access token with the project's private key and
// publishes the matching public keys at <issuer>/.well-known/jwks.json. The
// issuer is the project URL followed by /auth/v1.
export function supabaseIssuer(supabaseUrl) {
  return new URL('/auth/v1', supabaseUrl).href
}

// jose downloads the public keys on first use, caches them, and downloads
// them again when a token names a key it has not seen, which is what happens
// after a key rotation.
export function remoteKeySet(issuer) {
  return createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
}

// Errors that mean the keys could not be fetched, not that the token is bad.
const KEY_SET_FAILURES = [errors.JWKSTimeout, errors.JWKSInvalid]

// Returns a function that checks one access token and returns who it belongs
// to. Checked: the signature against the project's public keys, the
// algorithm, the issuer, the audience and the expiry.
export function createTokenVerifier({ issuer, keySet }) {
  return async function verifyToken(token) {
    let payload
    try {
      ;({ payload } = await jwtVerify(token, keySet, {
        issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
      }))
    } catch (err) {
      const badToken =
        err instanceof errors.JOSEError &&
        !KEY_SET_FAILURES.some((Failure) => err instanceof Failure)
      if (!badToken) {
        console.error('Could not check an access token:', err)
        throw new ApiError(503, 'auth_unavailable', 'Sign-in could not be checked right now. Try again shortly.')
      }
      if (err instanceof errors.JWTExpired) {
        throw new ApiError(401, 'token_expired', 'The access token has expired. Sign in again.')
      }
      throw new ApiError(401, 'invalid_token', 'The access token is not valid for this project.')
    }

    // Anonymous Supabase users have no email and no account here.
    if (payload.is_anonymous === true || typeof payload.email !== 'string' || payload.email === '') {
      throw new ApiError(401, 'invalid_token', 'The access token does not belong to an email account.')
    }
    return { authId: payload.sub, email: payload.email }
  }
}
