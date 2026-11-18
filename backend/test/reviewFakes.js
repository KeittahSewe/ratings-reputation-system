// In-memory stand-ins for the reviews repository and the inference client,
// shared by reviews.test.js and classification.test.js. Not a test file
// itself: npm test runs only *.test.js.
import { randomUUID } from 'node:crypto'
import { InferenceError } from '../src/inference/client.js'

export const MODEL_VERSION = 'distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8'

// Keeps the rules of src/db/reviews.js: one review per reviewer per job,
// one sentiment row per review, and storeSentiment safe to repeat.
export function fakeReviewsRepo({ now = () => new Date() } = {}) {
  const rows = []
  const sentiments = new Map()
  const view = (r) => ({ ...r, sentiment: sentiments.has(r.id) ? publicSentiment(sentiments.get(r.id)) : null })
  const publicSentiment = ({ label, confidence_score, model_version, analyzed_at }) => ({
    label,
    confidence_score,
    model_version,
    analyzed_at,
  })

  return {
    rows,
    sentiments,
    // Puts a review straight in, as if saved earlier. created_at can be set.
    seed(row) {
      const review = { id: randomUUID(), pending_classification: true, created_at: now().toISOString(), ...row }
      rows.push(review)
      return review
    },
    async insert(row) {
      if (rows.some((r) => r.job_id === row.job_id && r.reviewer_id === row.reviewer_id)) return null
      const review = { id: randomUUID(), pending_classification: true, created_at: now().toISOString(), ...row }
      rows.push(review)
      return { ...review }
    },
    async listForJob(jobId) {
      return rows.filter((r) => r.job_id === jobId).map(view)
    },
    async listReceived(userId) {
      return rows.filter((r) => r.reviewee_id === userId).map(view)
    },
    async jobIdsReviewedBy(userId, jobIds) {
      return new Set(rows.filter((r) => r.reviewer_id === userId && jobIds.includes(r.job_id)).map((r) => r.job_id))
    },
    async storeSentiment(reviewId, fields) {
      if (!sentiments.has(reviewId)) {
        sentiments.set(reviewId, { review_id: reviewId, ...fields, analyzed_at: now().toISOString() })
      }
      rows.find((r) => r.id === reviewId).pending_classification = false
      return publicSentiment(sentiments.get(reviewId))
    },
    async listPending({ before, limit }) {
      return rows
        .filter((r) => r.pending_classification && new Date(r.created_at) < before)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, limit)
        .map((r) => ({ ...r }))
    },
  }
}

// An inference client whose state the test switches. up: answers with the
// label set for that text (positive by default). down: fails every call as
// unreachable. Records each call with the attempts it was allowed.
export function fakeInference() {
  const calls = []
  const state = { mode: 'up', labels: new Map(), refuse: new Set() }
  return {
    calls,
    state,
    async classify(text, { attempts = 3 } = {}) {
      calls.push({ text, attempts })
      if (state.refuse.has(text)) {
        throw new InferenceError('Inference service answered 422', { retryable: false, scope: 'review', status: 422 })
      }
      if (state.mode === 'down') throw new InferenceError('Inference service unreachable: fetch failed', { retryable: true })
      const label = state.labels.get(text) ?? 'positive'
      return {
        label,
        confidence: 0.9,
        model_version: MODEL_VERSION,
        sentences: [{ text: text.toLowerCase(), label, confidence: 0.9 }],
      }
    },
  }
}

// Records recompute calls in order.
export function fakeScoring() {
  const recomputed = []
  return {
    recomputed,
    async recompute(userId) {
      recomputed.push(userId)
      return null
    },
  }
}

// A logger that keeps lines instead of printing them.
export function quietLogger() {
  const lines = []
  const keep = (level) => (...args) => lines.push({ level, text: args.map(String).join(' ') })
  return { lines, info: keep('info'), warn: keep('warn'), error: keep('error') }
}
