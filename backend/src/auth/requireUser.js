import { ApiError } from '../errors.js'

// Route middleware, used after authenticate. Loads the users row for the
// signed-in account and puts it on req.user. An account that has signed up
// but never called POST /api/me/bootstrap has no row yet.
export function requireUser(users) {
  return async function loadUser(req, res, next) {
    const user = await users.findByAuthId(req.auth.authId)
    if (!user) {
      throw new ApiError(403, 'not_bootstrapped', 'Call POST /api/me/bootstrap after signing in, then try again.')
    }
    req.user = user
    next()
  }
}

// Route middleware, used after requireUser. Lets only the given roles through.
export function requireRole(role) {
  return function checkRole(req, res, next) {
    if (req.user.role !== role) {
      throw new ApiError(403, 'wrong_role', `Only ${role} accounts can do this.`)
    }
    next()
  }
}
