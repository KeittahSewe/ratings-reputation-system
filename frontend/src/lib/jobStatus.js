// Job statuses as the API names them (plan 3.1) and as the screens show them.
export const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label ?? value

// The timeline steps of GET /api/jobs/:id, with the words each shows.
export const STEP_LABELS = {
  posted: 'Posted',
  assigned: 'Assigned',
  accepted: 'In progress',
  submitted: 'Work submitted',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
