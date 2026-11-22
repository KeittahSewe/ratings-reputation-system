import { useApi } from '../lib/useApi.js'
import { API_BASE_URL } from '../lib/api.js'
import styles from './StatusPage.module.css'

// Public page, /status: the phase 7a deployment check (#76), kept for demo
// day. It calls the API's public /health route, which also reports the
// inference service, so it shows that VITE_API_BASE_URL was set at build time,
// that the API allows this origin, and whether both services are awake.
function StatusLine({ label, status, detail }) {
  return (
    <li className={styles.statusLine}>
      <span className={styles.statusLabel}>{label}</span>
      <span className={styles.statusValue}>{status}</span>
      {detail && <span className={styles.statusDetail}>{detail}</span>}
    </li>
  )
}

export function StatusPage() {
  const health = useApi(API_BASE_URL ? '/health' : null)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Ratings and Reputation System</h1>
      <p className={styles.subtitle}>Service status</p>

      <section className={styles.card} aria-live="polite">
        <h2 className={styles.sectionHeading}>Deployment check</h2>
        {!API_BASE_URL && (
          <ul className={styles.statusList}>
            <StatusLine label="API" status="not set" detail="VITE_API_BASE_URL is not set for this build." />
          </ul>
        )}
        {health.status === 'loading' && (
          <p className={styles.helper}>Checking the API. After a quiet spell the free servers take up to a minute to wake.</p>
        )}
        {health.status === 'error' && (
          <ul className={styles.statusList}>
            <StatusLine label="API" status="not reachable" detail={health.error.message} />
          </ul>
        )}
        {health.status === 'ready' && (
          <ul className={styles.statusList}>
            <StatusLine label="API" status={health.data.status} />
            <StatusLine
              label="Inference"
              status={health.data.inference?.status ?? 'unknown'}
              detail={health.data.inference?.model_version ?? 'It may be waking. Check again in a minute.'}
            />
          </ul>
        )}
        <p className={styles.helper}>API base URL: {API_BASE_URL ?? 'not set'}</p>
        <button type="button" className={styles.button} onClick={health.reload} disabled={health.status === 'loading'}>
          Check again
        </button>
      </section>
    </main>
  )
}
