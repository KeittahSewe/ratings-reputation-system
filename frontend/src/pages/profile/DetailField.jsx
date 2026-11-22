import styles from './DetailField.module.css'

// A read-only value in the account details card, drawn as a quiet box like
// the figures' fields, with its label above.
export function DetailField({ label, children, multiline = false }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <div className={`${styles.value} ${multiline ? styles.multiline : ''}`}>{children || <span className={styles.empty}>Not set</span>}</div>
    </div>
  )
}
