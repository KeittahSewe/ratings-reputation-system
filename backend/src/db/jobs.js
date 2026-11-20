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

    // The finished jobs behind a user's job history (H): completed and
    // cancelled jobs where the user is the worker or, for clients, the client.
    // completed_at is for the insights jobs card.
    async historyFor(userId, role) {
      const column = role === 'worker' ? 'worker_id' : 'client_id'
      const { data, error } = await supabase
        .from('jobs')
        .select('status, assigned_at, completed_at')
        .eq(column, userId)
        .in('status', ['completed', 'cancelled'])
      if (error) throw error
      return data
    },

    // How many jobs each of the given workers has completed, as a Map from
    // worker id to the count. Workers with none are left out of the Map.
    async completedCountsFor(workerIds) {
      const counts = new Map()
      if (workerIds.length === 0) return counts
      const { data, error } = await supabase
        .from('jobs')
        .select('worker_id')
        .eq('status', 'completed')
        .in('worker_id', workerIds)
      if (error) throw error
      for (const { worker_id } of data) counts.set(worker_id, (counts.get(worker_id) ?? 0) + 1)
      return counts
    },

    // The workers this client has completed at least one job with. A
    // cancelled job does not count as a hire.
    async workersHiredBy(clientId) {
      const { data, error } = await supabase
        .from('jobs')
        .select('worker_id')
        .eq('client_id', clientId)
        .eq('status', 'completed')
      if (error) throw error
      return new Set(data.map((j) => j.worker_id))
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
