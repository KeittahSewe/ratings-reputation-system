import express from 'express'
import { authenticate } from './auth/authenticate.js'
import { cors } from './cors.js'
import { ApiError } from './errors.js'
import { insightsRouter } from './routes/insights.js'
import { jobsRouter } from './routes/jobs.js'
import { meRouter } from './routes/me.js'
import { recommendationsRouter } from './routes/recommendations.js'
import { reviewsRouter } from './routes/reviews.js'
import { skillsRouter } from './routes/skills.js'
import { usersRouter } from './routes/users.js'

// Builds the Express app without starting a server, so tests can pass in a
// fake token check and fake data access.
//   verifyToken: async (token) => ({ authId, email }), throws ApiError if bad
//   users, skills, reputation, reviews, jobs: the repositories from db/
//   scoring: the reputation service from reputation/recompute.js
//   classification: the service from reviews/classification.js
//   inference: the client from inference/client.js, for /api/health
//   corsOrigins: frontend origins from parseOrigins() in cors.js; none if left out
export function createApp({ verifyToken, users, skills, reputation, reviews, jobs, scoring, classification, inference, corsOrigins = [] }) {
  const app = express()
  // First, so preflights are answered before the token check and every
  // response, errors included, carries the header the browser needs to read it.
  app.use(cors(corsOrigins))
  app.use(express.json({ limit: '100kb' }))

  // Public: no token needed.

  // Liveness for Render's health check, which arrives every few seconds and
  // restarts the instance after repeated failures. It calls nothing, so a
  // sleeping inference service or a paused database cannot restart a healthy
  // API, and the checks do not keep the inference service awake.
  app.get('/api/live', (req, res) => {
    res.status(200).json({ status: 'ok' })
  })

  // Status for people and the frontend (plan 3.3, #53). Always 200 while the
  // API itself runs: status is the API's own, and inference says whether the
  // inference service answered its /health and which model it serves.
  app.get('/api/health', async (req, res) => {
    res.set('Cache-Control', 'no-store')
    res.status(200).json({ status: 'ok', inference: await inference.health() })
  })

  // Every /api route below this line needs a valid Supabase access token.
  app.use('/api', authenticate(verifyToken))
  app.use('/api', meRouter({ users, skills, reputation }))
  app.use('/api', skillsRouter({ users, skills }))
  app.use('/api', usersRouter({ users, skills, reputation, reviews, jobs }))
  app.use('/api', jobsRouter({ users, jobs, reviews, scoring }))
  app.use('/api', reviewsRouter({ users, jobs, reviews, scoring, classification }))
  app.use('/api', recommendationsRouter({ users, jobs, skills, reputation }))
  app.use('/api', insightsRouter({ users, reviews, jobs, reputation }))

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
