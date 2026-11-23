import { Link } from 'react-router'
import { formatScore, plural } from '../../lib/format.js'
import styles from './Jobs.module.css'

// The box on the right of the job detail (Figure 4.9): the other party on the
// job with their reputation broken down, because a score is never shown
// without its components (gap 1). profile is GET /api/users/:id, or null
// while it loads.
export function PartyCard({ label, person, profile, emptyText, emptyAction }) {
  if (!person) {
    return (
      <aside className={styles.party}>
        <span className={styles.partyLabel}>{label}</span>
        <p className={styles.partyEmpty}>{emptyText}</p>
        {emptyAction}
      </aside>
    )
  }
  const reputation = profile?.reputation
  return (
    <aside className={styles.party}>
      <span className={styles.partyLabel}>{label}</span>
      <span className={styles.partyName}>{person.name}</span>
      {person.company_name && <span className={styles.partyCompany}>{person.company_name}</span>}
      {profile && reputation && (
        <>
          <div className={styles.partyScore}>
            <strong>{formatScore(reputation.score)} / 5.0</strong>
            <span>reputation score{reputation.provisional ? ', Provisional' : ''}</span>
          </div>
          <p className={styles.partyBreakdown}>
            Ratings {formatScore(reputation.ratings_component)}, sentiment {formatScore(reputation.sentiment_component)}, job
            history {formatScore(reputation.history_component)}. Based on {plural(reputation.review_count, 'review')} and{' '}
            {plural(profile.completed_jobs, 'completed job')}.
          </p>
        </>
      )}
      {profile && !reputation && <p className={styles.partyBreakdown}>No reputation score yet: no review of them counts so far.</p>}
      {!profile && <p className={styles.partyBreakdown}>Loading their reputation</p>}
      <Link to={`/users/${person.id}`} className={styles.action}>
        View full profile
      </Link>
    </aside>
  )
}
