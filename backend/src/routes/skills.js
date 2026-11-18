import { Router } from 'express'
import { requireRole, requireUser } from '../auth/requireUser.js'
import { CATEGORIES } from '../categories.js'
import { ApiError, validationError as invalid } from '../errors.js'
import { UUID } from '../ids.js'

function parseSkill(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalid('Send a JSON body with skill_name and category.')
  }
  // Runs of spaces become one, so "pipe  fitting" and "pipe fitting" match.
  const skillName = typeof body.skill_name === 'string' ? body.skill_name.trim().replace(/\s+/g, ' ') : ''
  if (skillName.length < 1 || skillName.length > 60) {
    throw invalid('skill_name must be between 1 and 60 characters.')
  }
  if (!CATEGORIES.includes(body.category)) {
    throw invalid(`category must be one of: ${CATEGORIES.join(', ')}.`)
  }
  return { skillName, category: body.category }
}

// A worker's own skills. Clients have none, so every route is worker-only.
export function skillsRouter({ users, skills }) {
  const router = Router()
  const workerOnly = [requireUser(users), requireRole('worker')]

  router.get('/me/skills', workerOnly, async (req, res) => {
    res.status(200).json({ skills: await skills.listForUser(req.user.id) })
  })

  router.post('/me/skills', workerOnly, async (req, res) => {
    const { skillName, category } = parseSkill(req.body)

    // The database blocks exact repeats; this also blocks repeats that differ
    // only in capitals, which the recommendation engine would treat as one.
    const current = await skills.listForUser(req.user.id)
    const repeat = current.find((s) => s.skill_name.toLowerCase() === skillName.toLowerCase())
    const created = repeat
      ? null
      : await skills.insert({ user_id: req.user.id, skill_name: skillName, category })
    if (!created) {
      throw new ApiError(409, 'skill_exists', `"${repeat?.skill_name ?? skillName}" is already on your profile.`)
    }
    res.status(201).json({ skill: created })
  })

  router.delete('/me/skills/:id', workerOnly, async (req, res) => {
    // Another worker's skill gets the same 404 as a missing one, so ids
    // cannot be probed.
    const deleted = UUID.test(req.params.id) && (await skills.deleteForUser(req.params.id, req.user.id))
    if (!deleted) throw new ApiError(404, 'not_found', 'No skill with this id on your profile.')
    res.status(204).end()
  })

  return router
}
