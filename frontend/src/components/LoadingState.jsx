import { useEffect, useState } from 'react'
import styles from './LoadingState.module.css'

const WAKING_AFTER_SECONDS = 5

// Shown while a request is in flight. After 5 seconds it explains that the
// free Render services sleep after 15 idle minutes and counts the seconds,
// so a cold start reads as waiting rather than broken.
export function LoadingState({ label = 'Loading' }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      <p className={styles.label}>{label}</p>
      {seconds >= WAKING_AFTER_SECONDS && (
        <p className={styles.helper}>
          The server is waking up after a quiet spell, which can take up to a minute on free hosting. {seconds} s so far.
        </p>
      )}
    </div>
  )
}
