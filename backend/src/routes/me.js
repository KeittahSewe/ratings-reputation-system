import { Router } from 'express'
import { ApiError } from '../errors.js'

function invalid(message) {
  return new ApiError(400, 'validation_failed', message)
}

// Checks the bootstrap body. Email and auth id are not read from the body;
// they come from the verified token.
function parseBootstrap(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('Send a JSON body with name and role.')
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 1 || name.length > 100) {
    throw invalid('name must be between 1 and 100 characters.')
  }

  const { role } = body
  if (role !== 'client' && role !== 'worker') {
    throw invalid("role must be 'client' or 'worker'.")
  }

  let companyName = body.company_name ?? null
  if (typeof companyName === 'string') companyName = companyName.trim() || null
  if (companyName !== null) {
    if (typeof companyName !== 'string') throw invalid('company_name must be text.')
    if (companyName.length > 120) throw invalid('company_name must be 120 characters or fewer.')
    if (role !== 'client') throw invalid('company_name is for client accounts only.')
  }

  return { name, role, companyName }
}

export function meRouter({ users }) {
  const router = Router()

  // Creates the users row for a signed-in Supabase account. Safe to call
  // after every sign-in: if the row already exists it is returned unchanged,
  // and the body is ignored, so a role cannot be changed this way.
  router.post('/me/bootstrap', async (req, res) => {
    const input = parseBootstrap(req.body)
    const { authId, email } = req.auth

    const existing = await users.findByAuthId(authId)
    if (existing) {
      res.status(200).json({ user: existing })
      return
    }

    const created = await users.insert({
      auth_id: authId,
      email,
      name: input.name,
      role: input.role,
      company_name: input.companyName,
      // Workers start available; clients have no availability setting.
      availability: input.role === 'worker' ? true : null,
    })
    if (created) {
      res.status(201).json({ user: created })
      return
    }

    // Two bootstrap calls for the same account can race; the loser finds the
    // winner's row here.
    const raced = await users.findByAuthId(authId)
    if (raced) {
      res.status(200).json({ user: raced })
      return
    }
    throw new ApiError(409, 'email_in_use', 'Another account already uses this email address.')
  })

  return router
}
