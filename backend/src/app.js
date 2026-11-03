import express from 'express'

// Builds the Express app without starting a server, so tests can import it.
const app = express()

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' })
})

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
// It keeps unexpected errors in the same JSON format instead of an HTML page.
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on the server',
    },
  })
})

export default app
