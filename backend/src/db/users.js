// Every query against public.users goes through here, so routes and tests
// never touch the Supabase client directly.

// auth_id stays on the server; the API never returns it.
const COLUMNS = 'id, name, email, role, company_name, bio, availability, created_at'

// What other users may see: no email.
const PUBLIC_COLUMNS = 'id, name, role, company_name, bio, availability, created_at'

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

    async findPublicById(id) {
      const { data, error } = await supabase.from('users').select(PUBLIC_COLUMNS).eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },

    // Workers taking jobs at the moment: the recommendation engine's
    // candidates for any open job.
    async listAvailableWorkers() {
      const { data, error } = await supabase
        .from('users')
        .select(PUBLIC_COLUMNS)
        .eq('role', 'worker')
        .eq('availability', true)
        .order('name')
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

    // Applies the given column values to one user and returns the updated row.
    async update(id, fields) {
      const { data, error } = await supabase.from('users').update(fields).eq('id', id).select(COLUMNS).single()
      if (error) throw error
      return data
    },
  }
}
