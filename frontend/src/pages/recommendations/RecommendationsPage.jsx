import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Card } from '../../components/Card.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { ErrorState } from '../../components/ErrorState.jsx'
import { LoadingState } from '../../components/LoadingState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { SelectField } from '../../components/SelectField.jsx'
import { apiFetch } from '../../lib/api.js'
import { categoryLabel } from '../../lib/categories.js'
import { formatShortDate } from '../../lib/format.js'
import { useApi } from '../../lib/useApi.js'
import { filterRecommendations, MIN_SCORE_OPTIONS, SKILL_OPTIONS } from './filterRecommendations.js'
import { RecommendationCard } from './RecommendationCard.jsx'
import styles from './Recommendations.module.css'

// /jobs/:id/recommendations, Figure 4.11, for the client who owns an open job.
// The ranking is worked out by the API on every request and never stored.
// Of the figure's four filters, category is fixed by the job and the API only
// ranks available workers, so the two kept are minimum score and skill match.
// "Invite to job" is "Assign to job": the API assigns directly and the worker
// then accepts (change log, 22 November).
export function RecommendationsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ranking = useApi(`/jobs/${id}/recommendations`)
  const job = useApi(`/jobs/${id}`)
  const [filters, setFilters] = useState({ minScore: '', skill: '' })

  if (ranking.status === 'error') {
    const { code, status } = ranking.error
    return (
      <>
        <PageTitle title="Recommended workers" />
        {code === 'job_not_open' ? (
          <Card>
            <EmptyState title="This job is no longer open" action={<Link to={`/jobs?job=${id}`}>Back to the job</Link>}>
              Workers are ranked only for open jobs. Once a worker is assigned, the job is theirs to accept.
            </EmptyState>
          </Card>
        ) : (
          <ErrorState
            title={status === 404 ? 'This job is not one of yours' : 'The ranking could not be loaded'}
            error={status === 404 ? null : ranking.error}
            onRetry={status === 404 ? undefined : ranking.reload}
          />
        )}
      </>
    )
  }
  if (ranking.status !== 'ready') return <LoadingState label="Ranking workers" />

  const { job: rankedJob, total, recommendations, disclosure } = ranking.data
  const shown = filterRecommendations(recommendations, filters)
  const posted = job.data?.job?.created_at

  async function assign(rec) {
    await apiFetch(`/jobs/${id}/assign`, { method: 'POST', body: { worker_id: rec.worker.id } })
    navigate(`/jobs?job=${id}`)
  }

  return (
    <RecommendationsView
      job={rankedJob}
      posted={posted}
      total={total}
      shown={shown}
      filters={filters}
      onFilters={setFilters}
      disclosure={disclosure}
      onAssign={assign}
    />
  )
}

// Drawn from props so the figure fixture can show it.
export function RecommendationsView({ job, posted, total, shown, filters, onFilters, disclosure, onAssign }) {
  const set = (name) => (event) => onFilters({ ...filters, [name]: event.target.value })
  const hasRequired = job.required_skills.length > 0
  return (
    <>
      <PageTitle title="Recommended workers" />
      <p className={styles.context}>
        Ranked for your open job: {job.title} ({categoryLabel(job.category)}
        {posted ? `, posted ${formatShortDate(posted)}` : ''}). Showing {shown.length} of {total} available{' '}
        {total === 1 ? 'worker' : 'workers'}.
        <Link to="/find-workers">Choose another job</Link>
      </p>
      <div className={styles.filters} role="search">
        <SelectField
          label="Minimum reputation score"
          value={filters.minScore}
          onChange={set('minScore')}
          options={MIN_SCORE_OPTIONS}
          placeholder="Any score, including none yet"
        />
        {hasRequired && (
          <SelectField label="Skill match" value={filters.skill} onChange={set('skill')} options={SKILL_OPTIONS} placeholder="Any" />
        )}
      </div>
      {shown.length === 0 ? (
        <Card>
          <EmptyState title={total === 0 ? 'No workers are available right now' : 'No worker matches these filters'}>
            {total === 0
              ? 'Only workers whose availability is on are ranked. Check back later.'
              : 'Loosen a filter to see more of the ranking.'}
          </EmptyState>
        </Card>
      ) : (
        <div className={styles.list}>
          {shown.map((rec) => (
            <RecommendationCard key={rec.worker.id} rec={rec} jobTitle={job.title} onAssign={onAssign} />
          ))}
        </div>
      )}
      <p className={styles.disclosure}>{disclosure}</p>
    </>
  )
}
