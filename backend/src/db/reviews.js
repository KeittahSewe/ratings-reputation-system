// Every query on public.reviews and public.sentiment_results.

const UNIQUE_VIOLATION = '23505'

// reviews has two foreign keys to users, so the reviewer join names its
// constraint. sentiment_results is one to one with reviews.
const RECEIVED = [
  'id, job_id, rating, review_text, created_at',
  'reviewer:users!reviews_reviewer_id_fkey(id, name, role)',
  'job:jobs!reviews_job_id_fkey(id, title)',
  'sentiment:sentiment_results(label, confidence_score)',
].join(', ')

const COLUMNS = 'id, job_id, reviewer_id, reviewee_id, rating, review_text, pending_classification, created_at'

// sentences stays out: it is read only by the insights endpoint, through
// listReceivedForInsights.
const WITH_SENTIMENT = `${COLUMNS}, sentiment:sentiment_results(label, confidence_score, model_version, analyzed_at)`

const SENTIMENT_COLUMNS = 'label, confidence_score, model_version, analyzed_at'

// What GET /api/me/insights needs from each review received: enough to
// decide visibility (job_id, created_at), the stars, and the sentiment with
// its per-sentence results. No review text and no reviewer: the dashboard
// shows counts, never quotes.
const FOR_INSIGHTS = 'id, job_id, rating, created_at, sentiment:sentiment_results(label, model_version, sentences)'

// A one-to-one join can come back as an object or a one-item array.
function oneToOne(value) {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

// numeric columns can arrive as strings; the API always sends numbers.
function sentimentView(row) {
  if (!row) return null
  return { ...row, confidence_score: Number(row.confidence_score) }
}

function withSentiment(row) {
  return { ...row, sentiment: sentimentView(oneToOne(row.sentiment)) }
}

export function createReviewsRepo(supabase) {
  return {
    // Every review the user has received, newest first, visible or not.
    async listReceived(userId) {
      const { data, error } = await supabase
        .from('reviews')
        .select(RECEIVED)
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data.map(withSentiment)
    },

    // Every review the user has received, visible or not, with sentences.
    // The caller filters by visibility before reading any of it.
    async listReceivedForInsights(userId) {
      const { data, error } = await supabase
        .from('reviews')
        .select(FOR_INSIGHTS)
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data.map((row) => ({ ...row, sentiment: oneToOne(row.sentiment) }))
    },

    // Of the given jobs, the ones this user has written a review for.
    async jobIdsReviewedBy(userId, jobIds) {
      if (jobIds.length === 0) return new Set()
      const { data, error } = await supabase
        .from('reviews')
        .select('job_id')
        .eq('reviewer_id', userId)
        .in('job_id', jobIds)
      if (error) throw error
      return new Set(data.map((r) => r.job_id))
    },

    // The reviews written on one job, at most two, each with its sentiment.
    async listForJob(jobId) {
      const { data, error } = await supabase.from('reviews').select(WITH_SENTIMENT).eq('job_id', jobId)
      if (error) throw error
      return data.map(withSentiment)
    },

    // Saves a new review, pending until its sentiment is stored. Returns the
    // row, or null if this reviewer has already reviewed this job.
    async insert(row) {
      const { data, error } = await supabase.from('reviews').insert(row).select(COLUMNS).single()
      if (error?.code === UNIQUE_VIOLATION) return null
      if (error) throw error
      return data
    },

    // Stores a classification and clears the review's pending flag. Safe to
    // repeat: if a sentiment row already exists (a retry racing the first
    // attempt, or a crash between the two writes), that row is kept and the
    // flag is still cleared. Returns the stored sentiment.
    async storeSentiment(reviewId, { label, confidence_score, model_version, sentences }) {
      let { data, error } = await supabase
        .from('sentiment_results')
        .insert({ review_id: reviewId, label, confidence_score, model_version, sentences })
        .select(SENTIMENT_COLUMNS)
        .single()
      if (error?.code === UNIQUE_VIOLATION) {
        ;({ data, error } = await supabase
          .from('sentiment_results')
          .select(SENTIMENT_COLUMNS)
          .eq('review_id', reviewId)
          .single())
      }
      if (error) throw error

      const cleared = await supabase.from('reviews').update({ pending_classification: false }).eq('id', reviewId)
      if (cleared.error) throw cleared.error
      return sentimentView(data)
    },

    // Up to limit user ids whose reputation is out of date because a review
    // they received passed its 14-day visibility mark after their last
    // recompute. The rule is the SQL function in migration 20261121090000.
    async listRevieweesDueForVisibility({ now, days, limit }) {
      const { data, error } = await supabase.rpc('reviewees_due_visibility_recompute', {
        p_now: now.toISOString(),
        p_days: days,
        p_limit: limit,
      })
      if (error) throw error
      return data.map((row) => row.user_id)
    },

    // Reviews still waiting for a classification, oldest first. before keeps
    // out reviews whose submit request may still be classifying them.
    async listPending({ before, limit }) {
      const { data, error } = await supabase
        .from('reviews')
        .select(COLUMNS)
        .eq('pending_classification', true)
        .lt('created_at', before.toISOString())
        .order('created_at', { ascending: true })
        .limit(limit)
      if (error) throw error
      return data
    },
  }
}
