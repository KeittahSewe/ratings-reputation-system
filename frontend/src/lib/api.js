// Every call to the Express API goes through apiFetch.
//
// - It sends the signed-in user's access token as a Bearer token.
// - It turns the API's error body, { error: { code, message } }, into an
//   ApiError carrying the status, code and message.
// - It refreshes the session once and retries when the API says the token
//   has expired.
// - It retries a GET once after a network failure. Other methods are not
//   retried, because the first request may have reached the server.
// - It allows 75 seconds a request. A sleeping Render service holds the
//   request while it wakes (24 s for the API, 33 s for the inference service,
//   measured on 22 November), so a shorter limit would fail a cold start.

import { supabase } from './supabase.js'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

const REQUEST_LIMIT_MS = 75_000
const NETWORK_RETRY_DELAY_MS = 2_000

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function currentToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })
}

async function send(path, { method, body, signal, token }) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`

  const timeout = AbortSignal.timeout(REQUEST_LIMIT_MS)
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      cache: 'no-store',
    })
  } catch (err) {
    // The caller cancelled, for example the user left the page: pass it on.
    if (signal?.aborted) throw err
    if (timeout.aborted) {
      throw new ApiError(0, 'timeout', 'The server did not answer within 75 seconds. It may still be waking up, so try again.')
    }
    throw new ApiError(0, 'network', 'Could not reach the server. Check your connection and try again.')
  }

  if (response.status === 204) return null
  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }
  if (!response.ok) {
    const error = payload?.error
    throw new ApiError(response.status, error?.code ?? 'http_error', error?.message ?? `The server answered ${response.status}.`)
  }
  return payload
}

export async function apiFetch(path, { method = 'GET', body, signal, auth = true } = {}) {
  const token = auth ? await currentToken() : null
  try {
    return await send(path, { method, body, signal, token })
  } catch (err) {
    if (!(err instanceof ApiError)) throw err
    if (err.code === 'network' && method === 'GET') {
      await wait(NETWORK_RETRY_DELAY_MS, signal)
      return send(path, { method, body, signal, token })
    }
    if (err.code === 'token_expired' && auth) {
      const { data, error } = await supabase.auth.refreshSession()
      if (error || !data.session) throw err
      return send(path, { method, body, signal, token: data.session.access_token })
    }
    throw err
  }
}

// Sent once when the app loads, without waiting for the answer. The API's
// /health also calls the inference service, so both Render services start
// waking while the user is still typing on the sign-in page.
export function wakeServices() {
  if (!API_BASE_URL) return
  fetch(`${API_BASE_URL}/health`, { cache: 'no-store' }).catch(() => {})
}
