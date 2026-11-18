// Every query against public.skills.

const COLUMNS = 'id, skill_name, category'

const UNIQUE_VIOLATION = '23505'

export function createSkillsRepo(supabase) {
  return {
    async listForUser(userId) {
      const { data, error } = await supabase
        .from('skills')
        .select(COLUMNS)
        .eq('user_id', userId)
        .order('skill_name')
      if (error) throw error
      return data
    },

    // Returns the new row, or null if this worker already lists the skill.
    async insert(row) {
      const { data, error } = await supabase.from('skills').insert(row).select(COLUMNS).single()
      if (error?.code === UNIQUE_VIOLATION) return null
      if (error) throw error
      return data
    },

    // Deletes the skill only if it belongs to this user. Returns whether a
    // row was deleted.
    async deleteForUser(id, userId) {
      const { data, error } = await supabase
        .from('skills')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
        .select('id')
      if (error) throw error
      return data.length > 0
    },
  }
}
