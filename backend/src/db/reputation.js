// Every query on public.reputation_scores. Rows are written only by
// src/reputation/recompute.js; a user has none until a review they received
// is both visible and classified.

import { PROVISIONAL_BELOW } from '../reputation/score.js'

const COLUMNS = 'score, ratings_component, sentiment_component, history_component, review_count, last_updated'

// numeric columns can arrive as strings; the API always sends numbers.
// provisional is derived from review_count, so it can never disagree with it.
function view(row) {
  if (!row) return null
  return {
    score: Number(row.score),
    ratings_component: Number(row.ratings_component),
    sentiment_component: Number(row.sentiment_component),
    history_component: Number(row.history_component),
    review_count: row.review_count,
    provisional: row.review_count < PROVISIONAL_BELOW,
    last_updated: row.last_updated,
  }
}

export function createReputationRepo(supabase) {
  return {
    async findForUser(userId) {
      const { data, error } = await supabase
        .from('reputation_scores')
        .select(COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return view(data)
    },

    // result: the object from computeReputation(). One row per user, so a
    // recompute replaces the previous one.
    async save(userId, result, at = new Date()) {
      const { data, error } = await supabase
        .from('reputation_scores')
        .upsert(
          {
            user_id: userId,
            score: result.score,
            ratings_component: result.ratings_component,
            sentiment_component: result.sentiment_component,
            history_component: result.history_component,
            review_count: result.review_count,
            last_updated: at.toISOString(),
          },
          { onConflict: 'user_id' },
        )
        .select(COLUMNS)
        .single()
      if (error) throw error
      return view(data)
    },
  }
}
