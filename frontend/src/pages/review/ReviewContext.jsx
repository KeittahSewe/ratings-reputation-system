import { formatDate } from '../../lib/format.js'
import styles from './Review.module.css'

const ROLE = { client: 'Client', worker: 'Worker' }

// The context header of Figure 4.10: the job, who is being reviewed and when
// the job was completed.
export function ReviewContext({ title, reviewee, revieweeRole, completedAt }) {
  return (
    <div className={styles.context}>
      <div className={styles.contextItem}>
        <span className={styles.contextLabel}>Job</span>
        <span className={styles.contextValue}>{title}</span>
      </div>
      <div className={styles.contextItem}>
        <span className={styles.contextLabel}>You are reviewing</span>
        <span className={styles.contextValue}>
          {reviewee}, {ROLE[revieweeRole]}
        </span>
      </div>
      {completedAt && (
        <div className={styles.contextItem}>
          <span className={styles.contextLabel}>Job completed</span>
          <span className={styles.contextValue}>{formatDate(completedAt)}</span>
        </div>
      )}
    </div>
  )
}
