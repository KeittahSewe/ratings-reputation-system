import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button.jsx'
import { apiFetch } from '../../lib/api.js'
import styles from './JobActions.module.css'

// Plain words for the API's 409 answers on a status change (backend README,
// Jobs). A move the job no longer allows usually means the other party acted
// first, so the panel reloads.
const CONFLICTS = {
  invalid_transition: 'This job has moved on since the page loaded, so it has been refreshed.',
  job_changed: 'Someone else changed this job at the same moment, so it has been refreshed.',
  already_submitted: 'The work has already been submitted.',
  not_submitted: 'The worker has not submitted the work yet.',
}

// What the viewer can do with a job, by role and status (plan 3.1):
//   client: cancel an open or assigned job; mark submitted work complete;
//           assign from Find workers (Figure 4.11)
//   worker: accept an assigned job; submit work in progress
//   both:   leave a review on a completed job they have not reviewed
// Cancel, Mark complete and Submit cannot be undone, so each asks first,
// in the page rather than in a browser dialog.
export function JobActions({ job, role, canReview, onChanged }) {
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)

  const options = []
  if (role === 'client') {
    if (job.status === 'open') options.push({ link: `/jobs/${job.id}/recommendations`, label: 'Find workers' })
    if (job.status === 'in_progress' && job.submitted_at) {
      options.push({
        action: 'complete',
        label: 'Mark complete',
        confirm: 'Mark this job complete? You can then review each other, and it counts towards both job histories. This cannot be undone.',
      })
    }
    if (job.status === 'open' || job.status === 'assigned') {
      options.push({
        action: 'cancel',
        label: 'Cancel job',
        danger: true,
        confirm:
          job.status === 'assigned'
            ? 'Cancel this job? A worker is already assigned, so the cancellation counts against your job history. This cannot be undone.'
            : 'Cancel this job? No worker is assigned yet, so it does not affect your score. This cannot be undone.',
      })
    }
  } else {
    if (job.status === 'assigned') options.push({ action: 'accept', label: 'Accept job' })
    if (job.status === 'in_progress' && !job.submitted_at) {
      options.push({
        action: 'submit',
        label: 'Submit work',
        confirm: 'Submit the work as finished? The client is then asked to mark the job complete.',
      })
    }
  }
  if (job.status === 'completed' && canReview) options.push({ link: `/jobs/${job.id}/review`, label: 'Leave review' })

  const waiting = waitingNote(job, role, canReview)
  if (options.length === 0 && !waiting && !message) return null

  async function run(option) {
    setBusy(true)
    setMessage(null)
    try {
      await apiFetch(`/jobs/${job.id}/${option.action}`, { method: 'POST' })
      setConfirming(null)
      onChanged()
    } catch (err) {
      setConfirming(null)
      setMessage(CONFLICTS[err.code] ?? err.message)
      if (err.code === 'invalid_transition' || err.code === 'job_changed') onChanged()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.actions}>
      {waiting && <p className={styles.waiting}>{waiting}</p>}
      {confirming ? (
        <div className={styles.confirm} role="alertdialog" aria-label={confirming.label}>
          <p>{confirming.confirm}</p>
          <div className={styles.row}>
            <Button variant={confirming.danger ? 'danger' : 'primary'} busy={busy} busyLabel="Saving" onClick={() => run(confirming)}>
              {confirming.danger ? 'Yes, cancel job' : `Yes, ${confirming.label.toLowerCase()}`}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={busy}>
              {confirming.danger ? 'Keep job' : 'Not yet'}
            </Button>
          </div>
        </div>
      ) : (
        options.length > 0 && (
          <div className={styles.row}>
            {options.map((option) =>
              option.link ? (
                <Link key={option.label} to={option.link} className={styles.linkButton}>
                  {option.label}
                </Link>
              ) : (
                <Button
                  key={option.action}
                  variant={option.danger ? 'secondary' : 'primary'}
                  busy={busy}
                  busyLabel="Saving"
                  onClick={() => (option.confirm ? setConfirming(option) : run(option))}
                >
                  {option.label}
                </Button>
              ),
            )}
          </div>
        )
      )}
      {message && (
        <p className={styles.message} role="alert">
          {message}
        </p>
      )}
    </div>
  )
}

// A line saying whose turn it is, so a party with no action knows why.
function waitingNote(job, role, canReview) {
  if (role === 'client') {
    if (job.status === 'assigned') return `Waiting for ${job.worker?.name ?? 'the worker'} to accept.`
    if (job.status === 'in_progress' && !job.submitted_at) return `${job.worker?.name ?? 'The worker'} is working on it. You can mark it complete once they submit.`
  } else {
    if (job.status === 'open') return 'This job is open. The client assigns a worker from the ranked recommendations.'
    if (job.status === 'in_progress' && job.submitted_at) return 'Work submitted. Waiting for the client to mark the job complete.'
  }
  if (job.status === 'completed' && canReview === false) return 'You have reviewed this job.'
  if (job.status === 'cancelled') return 'This job was cancelled.'
  return null
}
