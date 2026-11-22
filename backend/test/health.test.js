import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { describe, it } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createInferenceClient, HEALTH_TIMEOUT_MS } from '../src/inference/client.js'
import { verifyToken } from './helpers.js'

const MODEL_VERSION = 'distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8'

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// A client whose fetch answers with one Response, or throws one Error.
function clientAnswering(answer, options = {}) {
  const calls = []
  const fetch = async (url, init) => {
    calls.push({ url, init })
    if (answer instanceof Error) throw answer
    return answer
  }
  return { inference: createInferenceClient({ url: 'http://localhost:8000', serviceKey: 'local-dev-key', fetch, ...options }), calls }
}

const timeoutError = () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' })

describe('inference client health() (#53)', () => {
  it('reports ok with the model version, from one GET /health with no service key', async () => {
    const { inference, calls } = clientAnswering(json(200, { status: 'ok', model_version: MODEL_VERSION }))
    assert.deepEqual(await inference.health(), { status: 'ok', model_version: MODEL_VERSION })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'http://localhost:8000/health')
    assert.equal(calls[0].init.method, 'GET')
    assert.equal(calls[0].init.headers, undefined)
    assert.ok(calls[0].init.signal instanceof AbortSignal)
  })

  it('keeps the limit well under the 5 seconds Render gives a health check', () => {
    assert.equal(HEALTH_TIMEOUT_MS, 2000)
  })

  it('reports timeout when the service does not answer in time', async () => {
    const { inference, calls } = clientAnswering(timeoutError())
    assert.deepEqual(await inference.health(), { status: 'timeout', model_version: null })
    assert.equal(calls.length, 1, 'no retry')
  })

  it('reports unreachable when the connection fails', async () => {
    const { inference } = clientAnswering(new TypeError('fetch failed'))
    assert.deepEqual(await inference.health(), { status: 'unreachable', model_version: null })
  })

  it('reports error for a non-2xx answer or another shape', async () => {
    for (const answer of [
      json(503, { status: 'starting' }),
      json(200, { status: 'ok' }),
      json(200, { status: 'loading', model_version: MODEL_VERSION }),
      new Response('<html>Service waking up</html>', { status: 200 }),
    ]) {
      const { inference } = clientAnswering(answer)
      assert.deepEqual(await inference.health(), { status: 'error', model_version: null })
    }
  })

  it('gives up after the limit on a real service that never answers', async () => {
    // A local server that accepts the request and never replies.
    const silent = createServer(() => {})
    await new Promise((resolve) => silent.listen(0, '127.0.0.1', resolve))
    try {
      const inference = createInferenceClient({
        url: `http://127.0.0.1:${silent.address().port}`,
        serviceKey: 'local-dev-key',
        healthTimeoutMs: 100,
      })
      const started = Date.now()
      assert.deepEqual(await inference.health(), { status: 'timeout', model_version: null })
      assert.ok(Date.now() - started < 1000)
    } finally {
      silent.closeAllConnections()
      await new Promise((resolve) => silent.close(resolve))
    }
  })

  it('reports unreachable for a port nothing listens on', async () => {
    const closed = createServer()
    await new Promise((resolve) => closed.listen(0, '127.0.0.1', resolve))
    const port = closed.address().port
    await new Promise((resolve) => closed.close(resolve))
    const inference = createInferenceClient({ url: `http://127.0.0.1:${port}`, serviceKey: 'local-dev-key' })
    assert.deepEqual(await inference.health(), { status: 'unreachable', model_version: null })
  })
})

describe('GET /api/live and GET /api/health (#53)', () => {
  let state
  let healthCalls = 0
  const inference = {
    async health() {
      healthCalls += 1
      return state
    },
  }
  const app = createApp({ verifyToken, inference })

  it('/api/live answers 200 without a token and calls nothing', async () => {
    const res = await request(app).get('/api/live')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { status: 'ok' })
    assert.equal(healthCalls, 0)
  })

  it('/api/health reports the inference service and its model version', async () => {
    state = { status: 'ok', model_version: MODEL_VERSION }
    const res = await request(app).get('/api/health')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { status: 'ok', inference: { status: 'ok', model_version: MODEL_VERSION } })
    assert.equal(res.headers['cache-control'], 'no-store')
  })

  it('/api/health still answers 200 when the inference service is down or asleep', async () => {
    for (const status of ['timeout', 'unreachable', 'error']) {
      state = { status, model_version: null }
      const res = await request(app).get('/api/health')
      assert.equal(res.status, 200)
      assert.deepEqual(res.body, { status: 'ok', inference: { status, model_version: null } })
    }
  })

  it('/api/health needs no token and runs no classification retry', async () => {
    const retry = { called: 0, retryPending: async () => (retry.called += 1) }
    const withClassification = createApp({ verifyToken, inference, classification: retry })
    state = { status: 'ok', model_version: MODEL_VERSION }
    const res = await request(withClassification).get('/api/health')
    assert.equal(res.status, 200)
    assert.equal(retry.called, 0)
  })
})
