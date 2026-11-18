import { Router } from 'express'
import { requireUser } from '../auth/requireUser.js'
import { ApiError, validationError as invalid } from '../errors.js'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Trims a name and checks its length; the database allows 1 to 100.
function parseName(value) {
  const name = typeof value === 'string' ? value.trim() : ''
  if (name.length < 1 || name.length > 100) throw invalid('name must be between 1 and 100 characters.')
  return name
}

// Optional text: null, a missing value or blank text all become null.
function parseOptionalText(value, field, max) {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw invalid(`${field} must be text.`)
  const text = value.trim()
  if (text.length > max) throw invalid(`${field} must be ${max} characters or fewer.`)
  return text || null
}

// Checks the bootstrap body. Email and auth id are not read from the body;
// they come from the verified token.
function parseBootstrap(body) {
  if (!isPlainObject(body)) throw invalid('Send a JSON body with name and role.')
  const name = parseName(body.name)
  const { role } = body
  if (role !== 'client' && role !== 'worker') throw invalid("role must be 'client' or 'worker'.")
  const companyName = parseOptionalText(body.company_name, 'company_name', 120)
  if (companyName !== null && role !== 'client') throw invalid('company_name is for client accounts only.')
  return { name, role, companyName }
}

// Fields a user may change about themselves. Email and role are fixed:
// email belongs to Supabase Auth, and role decides the whole account.
const EDITABLE = ['name', 'bio', 'availability', 'company_name']

// Checks a PATCH /me body against the user's role and returns the columns to update.
function parseProfileUpdate(body, role) {
  if (!isPlainObject(body)) throw invalid('Send a JSON body with the fields to change.')
  const keys = Object.keys(body)
  if (keys.length === 0) throw invalid(`Send at least one of: ${EDITABLE.join(', ')}.`)
  const fixed = keys.find((key) => !EDITABLE.includes(key))
  if (fixed) throw invalid(`${fixed} cannot be changed here. Editable fields: ${EDITABLE.join(', ')}.`)

  const fields = {}
  if ('name' in body) fields.name = parseName(body.name)
  if ('bio' in body) fields.bio = parseOptionalText(body.bio, 'bio', 1000)
  if ('availability' in body) {
    if (role !== 'worker') throw invalid('availability is for worker accounts only.')
    if (typeof body.availability !== 'boolean') throw invalid('availability must be true or false.')
    fields.availability = body.availability
  }
  if ('company_name' in body) {
    if (role !== 'client') throw invalid('company_name is for client accounts only.')
    fields.company_name = parseOptionalText(body.company_name, 'company_name', 120)
  }
  return fields
}

export function meRouter({ users, skills, reputation }) {
  const router = Router()
  const loadUser = requireUser(users)

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

  // The signed-in user's own profile. reputation is null until the user's
  // first review has been classified. skills is always empty for clients.
  router.get('/me', loadUser, async (req, res) => {
    const { user } = req
    const [ownSkills, score] = await Promise.all([
      user.role === 'worker' ? skills.listForUser(user.id) : [],
      reputation.findForUser(user.id),
    ])
    res.status(200).json({ user, skills: ownSkills, reputation: score })
  })

  // Changes name, bio, and availability (workers) or company_name (clients).
  router.patch('/me', loadUser, async (req, res) => {
    const fields = parseProfileUpdate(req.body, req.user.role)
    const user = await users.update(req.user.id, fields)
    res.status(200).json({ user })
  })

  return router
}
