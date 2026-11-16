import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { createTokenVerifier } from '../src/auth/tokens.js'

export const ISSUER = 'https://test-project.supabase.co/auth/v1'

// A key pair standing in for the Supabase project's signing key. The public
// half goes into a local key set, so no test touches the network.
const projectKey = await generateKeyPair('ES256')
const publicJwk = { ...(await exportJWK(projectKey.publicKey)), kid: 'project-key', alg: 'ES256' }
export const keySet = createLocalJWKSet({ keys: [publicJwk] })
export const verifyToken = createTokenVerifier({ issuer: ISSUER, keySet })

// A different key that claims the project's key id, as a forger would.
const forgerKey = await generateKeyPair('ES256')

// Signs a token shaped like a Supabase access token. Any claim can be
// overridden, and the signing key and header swapped, to build bad tokens.
export async function makeToken({
  claims = {},
  key = projectKey.privateKey,
  header = { alg: 'ES256', kid: 'project-key' },
  expiresIn = '1h',
} = {}) {
  return new SignJWT({
    email: 'peter.mwangi@example.com',
    role: 'authenticated',
    is_anonymous: false,
    ...claims,
  })
    .setProtectedHeader(header)
    .setSubject(claims.sub ?? '6f1c2d3e-0000-4000-8000-000000000001')
    .setIssuer(claims.iss ?? ISSUER)
    .setAudience(claims.aud ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)
}

export const forgerPrivateKey = forgerKey.privateKey
