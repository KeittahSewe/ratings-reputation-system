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

    // The skills of several users in one query, as a Map from user id to
    // their list. Users with no skills are left out of the Map.
    async listForUsers(userIds) {
      const byUser = new Map()
      if (userIds.length === 0) return byUser
      const { data, error } = await supabase
        .from('skills')
        .select(`user_id, ${COLUMNS}`)
        .in('user_id', userIds)
        .order('skill_name')
      if (error) throw error
      for (const { user_id, ...skill } of data) {
        if (!byUser.has(user_id)) byUser.set(user_id, [])
        byUser.get(user_id).push(skill)
      }
      return byUser
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
