// Every query on public.reputation_scores. Rows are written only by
// src/reputation/recompute.js; a user has none until a review they received
// is both visible and classified.

import { PROVISIONAL_BELOW } from '../reputation/score.js'

const COLUMNS = [
  'score, ratings_component, sentiment_component, history_component, review_count',
  'positive_count, neutral_count, negative_count, last_updated',
].join(', ')

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
    // null for a row written before #84 and not recomputed since
    // (npm run recompute:all fills them).
    sentiment_counts:
      row.positive_count === null
        ? null
        : { positive: row.positive_count, neutral: row.neutral_count, negative: row.negative_count },
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

    // The reputation rows of several users in one query, as a Map from user
    // id to the same object findForUser returns. Users with no row are left
    // out of the Map.
    async findForUsers(userIds) {
      const byUser = new Map()
      if (userIds.length === 0) return byUser
      const { data, error } = await supabase
        .from('reputation_scores')
        .select(`user_id, ${COLUMNS}`)
        .in('user_id', userIds)
      if (error) throw error
      for (const { user_id, ...row } of data) byUser.set(user_id, view(row))
      return byUser
    },

    // Every user who has a reputation row, for npm run recompute:all.
    async listUserIds() {
      const { data, error } = await supabase.from('reputation_scores').select('user_id')
      if (error) throw error
      return data.map((row) => row.user_id)
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
            positive_count: result.sentiment_counts.positive,
            neutral_count: result.sentiment_counts.neutral,
            negative_count: result.sentiment_counts.negative,
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
