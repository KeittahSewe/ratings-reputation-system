// Every query against public.jobs.

const COLUMNS = [
  'id, client_id, worker_id, title, description, category, required_skills, status',
  'created_at, assigned_at, accepted_at, submitted_at, completed_at, cancelled_at',
].join(', ')

// jobs has two foreign keys to users, so each join names its constraint.
const DETAIL = [
  COLUMNS,
  'client:users!jobs_client_id_fkey(id, name, company_name)',
  'worker:users!jobs_worker_id_fkey(id, name)',
].join(', ')

// A search term goes inside an ILIKE pattern, where % and _ are wildcards.
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (c) => '\\' + c)
}

function applyFilters(query, { status, category, q }) {
  if (status) query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (q) query = query.ilike('title', `%${escapeLike(q)}%`)
  return query.order('created_at', { ascending: false })
}

export function createJobsRepo(supabase) {
  return {
    async insert(row) {
      const { data, error } = await supabase.from('jobs').insert(row).select(COLUMNS).single()
      if (error) throw error
      return data
    },

    // One job with the client's and worker's names, or null.
    async findById(id) {
      const { data, error } = await supabase.from('jobs').select(DETAIL).eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },

    // filters: { status, category, q }, all optional.
    async listForClient(clientId, filters) {
      const { data, error } = await applyFilters(supabase.from('jobs').select(COLUMNS).eq('client_id', clientId), filters)
      if (error) throw error
      return data
    },

    async listForWorker(workerId, filters) {
      const { data, error } = await applyFilters(supabase.from('jobs').select(COLUMNS).eq('worker_id', workerId), filters)
      if (error) throw error
      return data
    },

    async listOpen(filters) {
      const { data, error } = await applyFilters(supabase.from('jobs').select(COLUMNS), { ...filters, status: 'open' })
      if (error) throw error
      return data
    },

    // Applies fields to the job only if it is still in the status the caller
    // read, and for a submit only if it has not been submitted. Two requests
    // racing on the same job cannot both succeed. Returns the updated row, or
    // null if the job had moved on.
    async transition(id, { from, fields, unsubmitted = false }) {
      let query = supabase.from('jobs').update(fields).eq('id', id).eq('status', from)
      if (unsubmitted) query = query.is('submitted_at', null)
      const { data, error } = await query.select(COLUMNS)
      if (error) throw error
      return data[0] ?? null
    },
  }
}
