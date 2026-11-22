// Calls the FastAPI inference service (plan 3.6). Every review is sent with
// sentences: true, so the per-sentence results for the insights theme lexicon
// are stored in the same write as the label (change log, 16 November).

export const LABELS = ['positive', 'neutral', 'negative']

// An error from a classify call. retryable is true when the service may answer
// later: it could not be reached, timed out, or answered with a 5xx or 429.
// It is false when the same request would fail again (a 4xx), or the answer
// had the wrong shape. scope is 'service' when no review can be classified
// right now, and 'review' when only this text is the problem.
export class InferenceError extends Error {
  constructor(message, { retryable, scope = 'service', status = null } = {}) {
    super(message)
    this.name = 'InferenceError'
    this.retryable = retryable
    this.scope = scope
    this.status = status
  }
}

const sleepFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isProbability(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
}

// Keeps only the fields that are stored, after checking each one. A service
// that answers in another shape is treated as a failure, so nothing half-valid
// reaches sentiment_results.
function parseResult(body) {
  const ok =
    body &&
    LABELS.includes(body.label) &&
    isProbability(body.confidence) &&
    typeof body.model_version === 'string' &&
    body.model_version.length > 0 &&
    Array.isArray(body.sentences) &&
    body.sentences.every(
      (s) => s && typeof s.text === 'string' && LABELS.includes(s.label) && isProbability(s.confidence),
    )
  if (!ok) throw new InferenceError('The inference service answered in an unexpected shape.', { retryable: false })
  return {
    label: body.label,
    confidence: body.confidence,
    model_version: body.model_version,
    sentences: body.sentences.map(({ text, label, confidence }) => ({ text, label, confidence })),
  }
}

// The limit for GET /health, kept well under the 5 seconds a health check
// gets on Render, so /api/health always answers in time (decision of
// 21 November). A sleeping service on Render's free tier shows as timeout.
export const HEALTH_TIMEOUT_MS = 2000

// url: base URL of the service, such as http://localhost:8000
// serviceKey: the shared X-Service-Key value
// timeoutMs: limit for each attempt. retries: attempts after the first one.
// healthTimeoutMs: limit for the single /health attempt.
// fetch and sleep can be replaced in tests.
export function createInferenceClient({
  url,
  serviceKey,
  timeoutMs = 5000,
  retries = 2,
  retryDelayMs = 500,
  healthTimeoutMs = HEALTH_TIMEOUT_MS,
  fetch = globalThis.fetch,
  sleep = sleepFor,
}) {
  const endpoint = new URL('/classify', url).toString()
  const healthEndpoint = new URL('/health', url).toString()

  async function attempt(text) {
    let response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-service-key': serviceKey },
        body: JSON.stringify({ text, sentences: true }),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (err) {
      const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
      throw new InferenceError(
        timedOut ? `No answer from the inference service within ${timeoutMs} ms.` : `Inference service unreachable: ${err?.message ?? err}`,
        { retryable: true },
      )
    }

    if (response.ok) {
      let body
      try {
        body = await response.json()
      } catch {
        throw new InferenceError('The inference service answered with a body that is not JSON.', { retryable: false })
      }
      return parseResult(body)
    }

    const detail = await response.text().catch(() => '')
    const message = `Inference service answered ${response.status}: ${detail.slice(0, 300)}`
    if (response.status >= 500 || response.status === 429) {
      throw new InferenceError(message, { retryable: true, status: response.status })
    }
    // 422: this text cannot be classified, whatever the service's state.
    // Any other 4xx (401 is a wrong key) blocks every review until fixed.
    throw new InferenceError(message, {
      retryable: false,
      scope: response.status === 422 ? 'review' : 'service',
      status: response.status,
    })
  }

  return {
    // One GET /health attempt, no retry and no service key (the route is
    // open). Never throws. Resolves to { status, model_version }, where
    // status is one of:
    //   ok           the service answered { status: "ok", model_version }
    //   timeout      no answer within healthTimeoutMs: asleep, waking or stuck
    //   unreachable  the connection failed, as for a stopped local service
    //   error        it answered, but with a non-2xx status or another shape
    // model_version is null unless status is ok. No error text is passed on,
    // because /api/health is public.
    async health() {
      const down = (status) => ({ status, model_version: null })
      let response
      try {
        response = await fetch(healthEndpoint, { method: 'GET', signal: AbortSignal.timeout(healthTimeoutMs) })
      } catch (err) {
        const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError'
        return down(timedOut ? 'timeout' : 'unreachable')
      }
      if (!response.ok) return down('error')
      try {
        const body = await response.json()
        if (body?.status === 'ok' && typeof body.model_version === 'string' && body.model_version.length > 0) {
          return { status: 'ok', model_version: body.model_version }
        }
      } catch (err) {
        // A body cut off by the timeout counts as a timeout, not a bad answer.
        if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return down('timeout')
      }
      return down('error')
    },

    // Resolves to { label, confidence, model_version, sentences }, or throws
    // the last InferenceError once every attempt has failed. attempts can be
    // lowered for background retries, which try again on the next tick anyway.
    async classify(text, { attempts = retries + 1 } = {}) {
      let lastError
      for (let i = 0; i < attempts; i++) {
        if (i > 0) await sleep(retryDelayMs * i)
        try {
          return await attempt(text)
        } catch (err) {
          lastError = err
          if (!err.retryable) break
        }
      }
      throw lastError
    },
  }
}
