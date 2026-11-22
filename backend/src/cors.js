// Cross-origin access for the React app (plan 7a, #73). The browser loads the
// app from the Vercel domain and calls this API on Render, so a response to an
// allowed origin must carry Access-Control-Allow-Origin. Before any call that
// sends the Authorization header, the browser first sends a preflight OPTIONS
// request without it. This middleware answers preflights itself, ahead of the
// token check, which would otherwise refuse them with 401.
//
// Tokens travel in the Authorization header, never in cookies, so credentials
// are not allowed and Access-Control-Allow-Credentials is never sent.

export const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE'
export const ALLOWED_HEADERS = 'Authorization, Content-Type'

// How long a browser may reuse a preflight answer, in seconds.
export const PREFLIGHT_MAX_AGE_S = 600

export class CorsConfigError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CorsConfigError'
  }
}

// Reads CORS_ORIGIN: one or more exact origins separated by commas, such as
// "https://ratings-reputation-system.vercel.app,http://localhost:5173".
// A browser's Origin header is scheme, host and port only, in lower case, so
// an entry with a trailing slash, a path or capitals would never match. Such
// an entry stops the API at startup instead of failing silently in a browser.
export function parseOrigins(value) {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (entries.length === 0) {
    throw new CorsConfigError('CORS_ORIGIN is not set. List the frontend origins, separated by commas.')
  }
  for (const entry of entries) {
    let url
    try {
      url = new URL(entry)
    } catch {
      throw new CorsConfigError(`CORS_ORIGIN entry "${entry}" is not a URL.`)
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new CorsConfigError(`CORS_ORIGIN entry "${entry}" must start with http:// or https://.`)
    }
    const { origin } = url
    if (origin !== entry) {
      throw new CorsConfigError(`CORS_ORIGIN entry "${entry}" is not a bare origin. Use ${origin}`)
    }
  }
  return entries
}

// origins: the list from parseOrigins(). An empty list allows no origin.
export function cors(origins = []) {
  const allowed = new Set(origins)

  return (req, res, next) => {
    const origin = req.get('origin')
    const isAllowed = Boolean(origin) && allowed.has(origin)

    // The answer depends on the Origin header, so a cache must not hand one
    // origin's response to another.
    res.vary('Origin')
    if (isAllowed) res.set('Access-Control-Allow-Origin', origin)

    // A preflight is an OPTIONS request that names the method to come.
    if (req.method === 'OPTIONS' && req.get('access-control-request-method')) {
      if (isAllowed) {
        res.set({
          'Access-Control-Allow-Methods': ALLOWED_METHODS,
          'Access-Control-Allow-Headers': ALLOWED_HEADERS,
          'Access-Control-Max-Age': String(PREFLIGHT_MAX_AGE_S),
        })
      }
      // Without the allow headers above, the browser blocks the real request.
      res.status(204).end()
      return
    }
    next()
  }
}
