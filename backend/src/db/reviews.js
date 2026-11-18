// Reads from public.reviews for profiles. Writing reviews comes in a later issue.

// reviews has two foreign keys to users, so the reviewer join names its
// constraint. sentiment_results is one to one with reviews.
const RECEIVED = [
  'id, job_id, rating, review_text, created_at',
  'reviewer:users!reviews_reviewer_id_fkey(id, name, role)',
  'job:jobs!reviews_job_id_fkey(id, title)',
  'sentiment:sentiment_results(label, confidence_score)',
].join(', ')

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
      // A one-to-one join can come back as an object or a one-item array.
      return data.map((r) => ({
        ...r,
        sentiment: (Array.isArray(r.sentiment) ? r.sentiment[0] : r.sentiment) ?? null,
      }))
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
  }
}
