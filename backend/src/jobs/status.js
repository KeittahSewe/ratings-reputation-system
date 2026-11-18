// Job status rules from plan 3.1. Each action names the status it moves a job
// from, the status it moves it to, and the one role allowed to do it.
//
//   open        --assign (client)-->   assigned
//   assigned    --accept (worker)-->   in_progress
//   in_progress --submit (worker)-->   in_progress, with submitted_at set
//   in_progress --complete (client)--> completed, only once submitted
//   open or assigned --cancel (client)--> cancelled
export const STATUSES = ['open', 'assigned', 'in_progress', 'completed', 'cancelled']

export const ACTIONS = {
  assign: { done: 'assigned', role: 'client', from: ['open'], to: 'assigned', stamp: 'assigned_at' },
  accept: { done: 'accepted', role: 'worker', from: ['assigned'], to: 'in_progress', stamp: 'accepted_at' },
  submit: { done: 'submitted', role: 'worker', from: ['in_progress'], to: 'in_progress', stamp: 'submitted_at' },
  complete: { done: 'completed', role: 'client', from: ['in_progress'], to: 'completed', stamp: 'completed_at' },
  cancel: { done: 'cancelled', role: 'client', from: ['open', 'assigned'], to: 'cancelled', stamp: 'cancelled_at' },
}

// The five steps on Figure 4.9, plus cancelled when it applies. A step not
// reached yet has at: null.
export function timeline(job) {
  const steps = [
    { step: 'posted', at: job.created_at },
    { step: 'assigned', at: job.assigned_at },
    { step: 'accepted', at: job.accepted_at },
    { step: 'submitted', at: job.submitted_at },
    { step: 'completed', at: job.completed_at },
  ]
  if (job.status === 'cancelled') steps.push({ step: 'cancelled', at: job.cancelled_at })
  return steps
}
