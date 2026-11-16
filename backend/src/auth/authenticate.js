import { ApiError } from '../errors.js'

// Express middleware. Reads "Authorization: Bearer <token>", checks the token
// and puts { authId, email } on req.auth for the routes after it.
export function authenticate(verifyToken) {
  return async function authenticateRequest(req, res, next) {
    const [scheme, token, extra] = (req.get('authorization') ?? '').split(' ')
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra !== undefined) {
      throw new ApiError(401, 'missing_token', 'Send the Supabase access token as Authorization: Bearer <token>.')
    }
    req.auth = await verifyToken(token)
    next()
  }
}
