import { Router } from 'express'
import { requireUser } from '../auth/requireUser.js'
import { ApiError, validationError as invalid } from '../errors.js'
import { UUID } from '../ids.js'
import { canSee, isParty } from '../jobs/access.js'
import { isVisible, VISIBILITY_DAYS } from '../reviews/visibility.js'

// The longest review the inference service accepts, and the database CHECK.
export const MAX_REVIEW_CHARS = 5000

const DAY_MS = 24 * 60 * 60 * 1000

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// The inference service refuses text that is empty once HTML tags are
// stripped. Such a review would sit as pending for ever, so it is refused
// here, before anything is saved.
function hasWords(text) {
  return /[\p{L}\p{N}]/u.test(text.replace(/<[^>]+>/g, ' '))
}

function parseReview(body) {
  if (!isPlainObject(body)) throw invalid('Send a JSON body with rating and review_text.')
  const { rating } = body
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw invalid('rating must be a whole number from 1 to 5.')
  const text = typeof body.review_text === 'string' ? body.review_text.trim() : ''
  if (text.length < 1 || text.length > MAX_REVIEW_CHARS) {
    throw invalid(`review_text must be between 1 and ${MAX_REVIEW_CHARS} characters.`)
  }
  if (!hasWords(text)) throw invalid('review_text must contain at least one word.')
  return { rating, review_text: text }
}

// What the API returns for a review. The sentence results stay internal.
function reviewView(review) {
  const { id, job_id, reviewer_id, reviewee_id, rating, review_text, pending_classification, created_at } = review
  return {
    id,
    job_id,
    reviewer_id,
    reviewee_id,
    rating,
    review_text,
    pending_classification,
    created_at,
    sentiment: review.sentiment ?? null,
  }
}

// scoring: the reputation service. classification: the service in
// reviews/classification.js, which calls the inference service.
export function reviewsRouter({ users, jobs, reviews, scoring, classification }) {
  const router = Router()
  const signedIn = requireUser(users)

  // The job, if the caller is one of its two parties. A worker looking at an
  // open job they are not on gets 403; anyone who cannot see the job at all
  // gets the same 404 as a missing job.
  async function loadPartyJob(id, user) {
    const job = UUID.test(id) ? await jobs.findById(id) : null
    if (!job || !canSee(job, user)) throw new ApiError(404, 'not_found', 'No job with this id.')
    if (!isParty(job, user)) throw new ApiError(403, 'not_your_job', 'Only the client and worker on this job can see or write its reviews.')
    return job
  }

  router.post('/jobs/:id/reviews', signedIn, async (req, res) => {
    const job = await loadPartyJob(req.params.id, req.user)
    const fields = parseReview(req.body)
    if (job.status !== 'completed') {
      throw new ApiError(409, 'job_not_completed', 'A job can be reviewed only once it is completed.')
    }

    const revieweeId = req.user.id === job.client_id ? job.worker_id : job.client_id
    const review = await reviews.insert({ ...fields, job_id: job.id, reviewer_id: req.user.id, reviewee_id: revieweeId })
    if (!review) throw new ApiError(409, 'already_reviewed', 'You have already reviewed this job. A review cannot be changed.')

    // If the other party reviewed this job first, their review of the caller
    // has just become visible. It counts as soon as it is classified, so the
    // caller is recomputed now, whatever happens to this review's own
    // classification below.
    // The review is saved by now, so a failure here is logged, not sent back.
    try {
      const answered = await reviews.jobIdsReviewedBy(revieweeId, [job.id])
      if (answered.has(job.id)) await classification.recomputeQuietly(req.user.id)
    } catch (err) {
      console.error(`Pair check failed for review ${review.id}:`, err)
    }

    // Recomputes the reviewee when it succeeds. null means pending.
    const sentiment = await classification.classifyOnSubmit(review)
    const saved = sentiment ? { ...review, pending_classification: false, sentiment } : review
    res.status(201).json({ review: reviewView(saved) })
  })

  // Both sides of a job's reviews, from the caller's point of view.
  //   written:  the caller's own review, always shown to them, or null
  //   received: { status: 'none' } when the other party has not reviewed yet,
  //             { status: 'hidden', visible_at } until the caller reviews too
  //             or 14 days pass, then { status: 'visible', review }
  router.get('/jobs/:id/reviews', signedIn, async (req, res) => {
    const job = await loadPartyJob(req.params.id, req.user)
    const list = await reviews.listForJob(job.id)
    const mine = list.find((r) => r.reviewer_id === req.user.id) ?? null
    const theirs = list.find((r) => r.reviewee_id === req.user.id) ?? null

    let received = { status: 'none' }
    if (theirs) {
      const answered = mine ? new Set([job.id]) : new Set()
      received = isVisible(theirs, answered)
        ? { status: 'visible', review: reviewView(theirs) }
        : {
            status: 'hidden',
            visible_at: new Date(new Date(theirs.created_at).getTime() + VISIBILITY_DAYS * DAY_MS).toISOString(),
          }
    }

    res.status(200).json({
      job_id: job.id,
      can_review: job.status === 'completed' && !mine,
      written: mine ? reviewView(mine) : null,
      received,
    })
  })

  return router
}
