import express from 'express'
import { authenticate } from './auth/authenticate.js'
import { ApiError } from './errors.js'
import { meRouter } from './routes/me.js'
import { skillsRouter } from './routes/skills.js'
import { usersRouter } from './routes/users.js'

// Builds the Express app without starting a server, so tests can pass in a
// fake token check and fake data access.
//   verifyToken: async (token) => ({ authId, email }), throws ApiError if bad
//   users, skills, reputation, reviews: the repositories from db/
export function createApp({ verifyToken, users, skills, reputation, reviews }) {
  const app = express()
  app.use(express.json({ limit: '100kb' }))

  // Public: no token needed.
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  // Every /api route below this line needs a valid Supabase access token.
  app.use('/api', authenticate(verifyToken))
  app.use('/api', meRouter({ users, skills, reputation }))
  app.use('/api', skillsRouter({ users, skills }))
  app.use('/api', usersRouter({ users, skills, reputation, reviews }))

  // Any request that did not match a route above ends up here.
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'not_found',
        message: `No route for ${req.method} ${req.path}`,
      },
    })
  })

  // Express treats a middleware with four arguments as the error handler.
  // It keeps every error in the same JSON format instead of an HTML page.
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } })
      return
    }
    if (err.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'invalid_json', message: 'The request body is not valid JSON.' } })
      return
    }
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'body_too_large', message: 'The request body is too large.' } })
      return
    }
    console.error(err)
    res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Something went wrong on the server',
      },
    })
  })

  return app
}
