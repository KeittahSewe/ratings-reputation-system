import styles from './EmptyState.module.css'

// What a section shows when it has nothing to list, in words, with an
// optional next step.
export function EmptyState({ title, children, action }) {
  return (
    <div className={styles.empty}>
      <p className={styles.title}>{title}</p>
      {children && <p className={styles.text}>{children}</p>}
      {action}
    </div>
  )
}
