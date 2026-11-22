import { useId } from 'react'
import styles from './Toggle.module.css'

// An on and off switch with its state written beside it, so it reads in
// greyscale: "Available for work" or "Not available" on the worker profile.
export function Toggle({ label, checked, onChange, onText, offText, busy = false }) {
  const labelId = useId()
  return (
    <div className={styles.toggle}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        className={`${styles.track} ${checked ? styles.on : ''}`}
        onClick={() => onChange(!checked)}
        disabled={busy}
      >
        <span className={styles.knob} />
      </button>
      <span className={checked ? styles.stateOn : styles.stateOff}>{checked ? onText : offText}</span>
    </div>
  )
}
