// Every query against public.users goes through here, so routes and tests
// never touch the Supabase client directly.

// auth_id stays on the server; the API never returns it.
const COLUMNS = 'id, name, email, role, company_name, bio, availability, created_at'

const UNIQUE_VIOLATION = '23505'

export function createUsersRepo(supabase) {
  return {
    async findByAuthId(authId) {
      const { data, error } = await supabase
        .from('users')
        .select(COLUMNS)
        .eq('auth_id', authId)
        .maybeSingle()
      if (error) throw error
      return data
    },

    // Returns the new row, or null if a row with this auth_id or email
    // already exists.
    async insert(row) {
      const { data, error } = await supabase.from('users').insert(row).select(COLUMNS).single()
      if (error?.code === UNIQUE_VIOLATION) return null
      if (error) throw error
      return data
    },
  }
}
