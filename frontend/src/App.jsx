import { useCallback, useEffect, useState } from 'react'
import styles from './App.module.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL

// Deployment check for phase 7a (#76). The page calls the API's public
// /health route, so the deployed site shows that VITE_API_BASE_URL was set at
// build time and that the API allows this origin. Phase 4 replaces this page.
const NOT_SET = { state: 'error', message: 'VITE_API_BASE_URL is not set for this build.' }

function useApiHealth() {
  const [health, setHealth] = useState(API_BASE_URL ? { state: 'loading' } : NOT_SET)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!API_BASE_URL) return undefined
    const controller = new AbortController()
    fetch(`${API_BASE_URL}/health`, { signal: controller.signal, cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`The API answered ${response.status}.`)
        return response.json()
      })
      .then((body) => setHealth({ state: 'ok', body }))
      .catch((err) => {
        if (err.name !== 'AbortError') setHealth({ state: 'error', message: err.message })
      })
    return () => controller.abort()
  }, [attempt])

  const checkAgain = useCallback(() => {
    if (!API_BASE_URL) return
    setHealth({ state: 'loading' })
    setAttempt((n) => n + 1)
  }, [])
  return { health, checkAgain }
}

function StatusLine({ label, status, detail }) {
  return (
    <li className={styles.statusLine}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusValue}>{status}</span>
      {detail && <span className={styles.statusDetail}>{detail}</span>}
    </li>
  )
}

function App() {
  const { health, checkAgain } = useApiHealth()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Ratings and Reputation System</h1>
      <p className={styles.subtitle}>Frontend scaffold</p>

      <section className={styles.card} aria-live="polite">
        <h2 className={styles.sectionHeading}>Deployment check</h2>
        {health.state === 'loading' && (
          <p className={styles.helper}>
            Checking the API. After a quiet spell the free servers take up to a minute to wake.
          </p>
        )}
        {health.state === 'error' && (
          <ul className={styles.statusList}>
            <StatusLine label="API" status="not reachable" detail={health.message} />
          </ul>
        )}
        {health.state === 'ok' && (
          <ul className={styles.statusList}>
            <StatusLine label="API" status={health.body.status} />
            <StatusLine
              label="Inference"
              status={health.body.inference?.status ?? 'unknown'}
              detail={health.body.inference?.model_version ?? 'It may be waking. Check again in a minute.'}
            />
          </ul>
        )}
        <p className={styles.helper}>API base URL: {API_BASE_URL ?? 'not set'}</p>
        <button type="button" className={styles.button} onClick={checkAgain} disabled={health.state === 'loading'}>
          Check again
        </button>
      </section>
    </main>
  )
}

export default App
