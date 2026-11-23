import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/Button.jsx'
import { SentimentBar } from '../../components/SentimentBar.jsx'
import { AiTag, Tag } from '../../components/Tag.jsx'
import { formatScore, plural } from '../../lib/format.js'
import styles from './Recommendations.module.css'

const MAX_TAGS = 2

// One ranked worker, as on Figure 4.11: rank, skills, completed jobs, the
// reputation with its components, the sentiment bar, and the engine's
// reasons. The reasons strip is the screen's answer to literature gap 3:
// every card says in words why the worker ranked where they did, one
// sentence per term of the match score, with the score beside it.
// onAssign is absent in the figure fixture.
export function RecommendationCard({ rec, jobTitle, onAssign }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { worker, reputation } = rec
  const shownSkills = rec.skills.slice(0, MAX_TAGS)
  const more = rec.skills.length - shownSkills.length

  async function assign() {
    setBusy(true)
    setError(null)
    try {
      await onAssign(rec)
    } catch (err) {
      setError(err.code === 'worker_unavailable' ? `${worker.name} has just turned availability off.` : err.message)
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <article className={styles.card} aria-label={`Rank ${rec.rank}: ${worker.name}`}>
      <div className={styles.top}>
        <span className={styles.rank} aria-hidden="true">
          {rec.rank}
        </span>
        <div className={styles.who}>
          <h2 className={styles.name}>
            <span className="visually-hidden">Rank {rec.rank}, </span>
            {worker.name}
          </h2>
          <div className={styles.tags}>
            {shownSkills.map((skill) => (
              <Tag key={skill.id} quiet>
                {skill.skill_name}
              </Tag>
            ))}
            {more > 0 && <span className={styles.muted}>+{more} more</span>}
            <span className={styles.muted}>{plural(rec.completed_jobs, 'job')} completed</span>
          </div>
        </div>
        <div className={styles.reputation}>
          {reputation ? (
            <>
              <strong>
                {formatScore(reputation.score)} / 5.0 reputation score{reputation.provisional ? ', Provisional' : ''}
              </strong>
              <span>
                Ratings {formatScore(reputation.ratings_component)}, sentiment {formatScore(reputation.sentiment_component)},
                job history {formatScore(reputation.history_component)}
              </span>
            </>
          ) : (
            <>
              <strong>No reputation score yet</strong>
              <span>No reviews of this worker count so far</span>
            </>
          )}
        </div>
        <div className={styles.actions}>
          <Link to={`/users/${worker.id}`} className={styles.secondaryLink}>
            View profile
          </Link>
          {onAssign && !confirming && <Button onClick={() => setConfirming(true)}>Assign to job</Button>}
        </div>
      </div>

      {reputation?.sentiment_counts && <SentimentBar counts={reputation.sentiment_counts} inline />}

      <div className={styles.why}>
        <AiTag>Match {rec.match}</AiTag>
        <p>
          <span className={styles.whyLead}>Why this ranking:</span> {rec.explanation.join(' ')}
        </p>
      </div>

      {confirming && (
        <div className={styles.confirm} role="alertdialog" aria-label={`Assign ${worker.name}`}>
          <p>
            Assign {worker.name} to {jobTitle}? They are asked to accept it, and the job leaves the open list, so no one else
            can be assigned unless you cancel.
          </p>
          <div className={styles.confirmButtons}>
            <Button busy={busy} busyLabel="Assigning" onClick={assign}>
              Yes, assign {worker.name}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Not yet
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </article>
  )
}
