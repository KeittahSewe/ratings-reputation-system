// Who may see a job: its client, its worker, and any worker while it is open
// (so the available jobs list can link to it). Anyone else gets the same 404
// as a missing job, so ids cannot be probed.
export function canSee(job, user) {
  return isParty(job, user) || (job.status === 'open' && user.role === 'worker')
}

// The two people a job is between. Only they review each other.
export function isParty(job, user) {
  return job.client_id === user.id || job.worker_id === user.id
}
