import { formatShortDate } from '../../lib/format.js'
import { STEP_LABELS } from '../../lib/jobStatus.js'
import styles from './StatusTimeline.module.css'

// The status timeline of Figure 4.9, from the timeline the API sends with a
// job: posted, assigned, accepted, submitted and completed, plus cancelled
// when the job was cancelled. A step is reached when it has a date. As on the
// figure, the latest reached step of an unfinished job is marked "(current)",
// and the steps after it are hollow and say what is still to happen. Every
// step says its state in words, so the dots are not the only cue.
export function StatusTimeline({ timeline, status, workerName }) {
  const finished = status === 'completed' || status === 'cancelled'
  const steps = timeline.filter((step) => step.step !== 'cancelled' || step.at)
  // A cancelled job drops the steps it never reached.
  const shown = status === 'cancelled' ? steps.filter((step) => step.at) : steps
  const reached = shown.map((step) => Boolean(step.at))
  const currentIndex = finished ? -1 : reached.lastIndexOf(true)

  return (
    <div className={styles.timeline}>
      <p className={styles.heading}>Status timeline</p>
      <ol className={styles.steps}>
        {shown.map((step, index) => {
          const current = index === currentIndex
          const state = step.step === 'cancelled' ? styles.cancelled : reached[index] ? styles.done : styles.pending
          // The line to the next step is filled once that step is reached.
          const line = reached[index + 1] ? styles.lineDone : ''
          return (
            <li key={step.step} className={`${styles.step} ${state} ${line}`} aria-current={current ? 'step' : undefined}>
              <span className={styles.marker} aria-hidden="true" />
              <span className={styles.label}>
                {STEP_LABELS[step.step]}
                {current && ' (current)'}
              </span>
              <span className={styles.detail}>{stepDetail(step, workerName)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

const NOT_YET = {
  assigned: 'No worker assigned yet',
  accepted: 'Not yet accepted',
  submitted: 'Not yet submitted',
  completed: 'Not yet marked complete',
}

function stepDetail(step, workerName) {
  if (!step.at) return NOT_YET[step.step] ?? 'Not yet'
  const date = formatShortDate(step.at)
  if (step.step === 'assigned' && workerName) return `${date}, to ${workerName}`
  if (step.step === 'accepted') return `Started ${date}`
  return date
}
