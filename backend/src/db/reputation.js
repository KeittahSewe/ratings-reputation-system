// Reads from public.reputation_scores. Rows are written by the scoring code
// in a later issue; until a user's first review is classified there is none.

const COLUMNS = 'score, ratings_component, sentiment_component, history_component, last_updated'

export function createReputationRepo(supabase) {
  return {
    async findForUser(userId) {
      const { data, error } = await supabase
        .from('reputation_scores')
        .select(COLUMNS)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}
