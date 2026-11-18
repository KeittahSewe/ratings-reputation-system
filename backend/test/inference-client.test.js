import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createInferenceClient, InferenceError } from '../src/inference/client.js'

const MODEL_VERSION = 'distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8'

// A /classify body as the service sends it with sentences: true.
const ANSWER = {
  label: 'positive',
  confidence: 0.9312,
  probabilities: { negative: 0.02, neutral: 0.0488, positive: 0.9312 },
  model_version: MODEL_VERSION,
  sentences: [
    { text: 'peter was punctual and professional.', label: 'positive', confidence: 0.91 },
    { text: 'i would hire him again.', label: 'positive', confidence: 0.95 },
  ],
  latency_ms: 41,
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// A fetch that answers from a list, one entry per call. An entry is a
// Response, an Error to throw, or a function given the request.
function scriptedFetch(script) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) })
    const next = script[Math.min(calls.length - 1, script.length - 1)]
    if (typeof next === 'function') return next(url, init)
    if (next instanceof Error) throw next
    return next.clone()
  }
  return { fetch, calls }
}

function client(script, options = {}) {
  const { fetch, calls } = scriptedFetch(script)
  const waits = []
  const inference = createInferenceClient({
    url: 'http://localhost:8000',
    serviceKey: 'local-dev-key',
    fetch,
    sleep: async (ms) => waits.push(ms),
    ...options,
  })
  return { inference, calls, waits }
}

describe('inference client (plan 3.6)', () => {
  it('posts the text with sentences: true and the service key', async () => {
    const { inference, calls } = client([json(200, ANSWER)])
    await inference.classify('Peter was punctual and professional. I would hire him again.')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'http://localhost:8000/classify')
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.headers['x-service-key'], 'local-dev-key')
    assert.deepEqual(calls[0].body, {
      text: 'Peter was punctual and professional. I would hire him again.',
      sentences: true,
    })
  })

  it('returns only the fields that are stored', async () => {
    const { inference } = client([json(200, ANSWER)])
    const result = await inference.classify('Great work.')
    assert.deepEqual(result, {
      label: 'positive',
      confidence: 0.9312,
      model_version: MODEL_VERSION,
      sentences: ANSWER.sentences,
    })
  })

  it('tries three times in all, waiting a little longer each time', async () => {
    const { inference, calls, waits } = client([new TypeError('fetch failed')])
    await assert.rejects(inference.classify('Great work.'), (err) => {
      assert.ok(err instanceof InferenceError)
      assert.equal(err.retryable, true)
      assert.equal(err.scope, 'service')
      assert.match(err.message, /unreachable/)
      return true
    })
    assert.equal(calls.length, 3)
    assert.deepEqual(waits, [500, 1000])
  })

  it('succeeds on the third attempt', async () => {
    const { inference, calls } = client([new TypeError('fetch failed'), json(503, {}), json(200, ANSWER)])
    const result = await inference.classify('Great work.')
    assert.equal(result.label, 'positive')
    assert.equal(calls.length, 3)
  })

  it('gives up on an attempt after the timeout', async () => {
    // Never answers; only the abort signal ends the wait. AbortSignal.timeout
    // does not keep Node running on its own, so a plain timer does it here,
    // as the listening server does in real use.
    const hang = (url, init) =>
      new Promise((resolve, reject) => {
        const keepAlive = setTimeout(() => {}, 1000)
        init.signal.addEventListener('abort', () => {
          clearTimeout(keepAlive)
          reject(init.signal.reason)
        })
      })
    const { inference, calls } = client([hang], { timeoutMs: 20, retries: 0 })
    await assert.rejects(inference.classify('Great work.'), (err) => {
      assert.equal(err.retryable, true)
      assert.match(err.message, /within 20 ms/)
      return true
    })
    assert.equal(calls.length, 1)
  })

  it('retries a 5xx', async () => {
    const { inference, calls } = client([json(500, { error: { code: 'internal_error' } })])
    await assert.rejects(inference.classify('Great work.'), (err) => err.retryable && err.status === 500)
    assert.equal(calls.length, 3)
  })

  it('does not retry a 422, and marks it as a problem with this text only', async () => {
    const { inference, calls } = client([json(422, { error: { code: 'invalid_request' } })])
    await assert.rejects(inference.classify('<b></b>'), (err) => {
      assert.equal(err.retryable, false)
      assert.equal(err.scope, 'review')
      assert.equal(err.status, 422)
      return true
    })
    assert.equal(calls.length, 1)
  })

  it('does not retry a 401, which blocks every review until the key is fixed', async () => {
    const { inference, calls } = client([json(401, { error: { code: 'unauthorized' } })])
    await assert.rejects(inference.classify('Great work.'), (err) => !err.retryable && err.scope === 'service')
    assert.equal(calls.length, 1)
  })

  it('refuses an answer in the wrong shape', async () => {
    for (const bad of [
      { ...ANSWER, label: 'mixed' },
      { ...ANSWER, confidence: 1.4 },
      { ...ANSWER, model_version: '' },
      { ...ANSWER, sentences: undefined },
      { ...ANSWER, sentences: [{ text: 'ok', label: 'positive' }] },
    ]) {
      const { inference, calls } = client([json(200, bad)])
      await assert.rejects(inference.classify('Great work.'), (err) => !err.retryable && /unexpected shape/.test(err.message))
      assert.equal(calls.length, 1)
    }
  })

  it('makes a single attempt when asked to', async () => {
    const { inference, calls } = client([new TypeError('fetch failed')])
    await assert.rejects(inference.classify('Great work.', { attempts: 1 }))
    assert.equal(calls.length, 1)
  })
})
