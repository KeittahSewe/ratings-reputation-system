import { Button } from './Button.jsx'
import styles from './ErrorState.module.css'

// A failed load, in words, with a way to try again.
export function ErrorState({ title = 'Something went wrong', error, onRetry }) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.title}>{title}</p>
      {error?.message && <p className={styles.message}>{error.message}</p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
