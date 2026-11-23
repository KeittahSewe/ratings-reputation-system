import { Link, Navigate } from 'react-router'
import { Card } from '../../components/Card.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { ErrorState } from '../../components/ErrorState.jsx'
import { LoadingState } from '../../components/LoadingState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { categoryLabel } from '../../lib/categories.js'
import { formatShortDate } from '../../lib/format.js'
import { useApi } from '../../lib/useApi.js'
import styles from './Recommendations.module.css'

// Find Workers in the sidebar. Workers are ranked for a job, so this asks
// which open job; with exactly one, it goes straight to its ranking.
export function FindWorkersPage() {
  const open = useApi('/jobs?status=open')

  if (open.status === 'error') {
    return (
      <>
        <PageTitle title="Find Workers" />
        <ErrorState title="Your open jobs could not be loaded" error={open.error} onRetry={open.reload} />
      </>
    )
  }
  if (open.status !== 'ready') return <LoadingState label="Loading your open jobs" />

  const { jobs } = open.data
  if (jobs.length === 1) return <Navigate to={`/jobs/${jobs[0].id}/recommendations`} replace />

  return (
    <>
      <PageTitle title="Find Workers" />
      <Card title="Which job are you hiring for?">
        {jobs.length === 0 ? (
          <EmptyState title="You have no open jobs" action={<Link to="/jobs">Go to My Jobs to post one</Link>}>
            Workers are ranked against a job&apos;s category and required skills, so post the job first.
          </EmptyState>
        ) : (
          <ul className={styles.jobList}>
            {jobs.map((job) => (
              <li key={job.id} className={styles.jobRow}>
                <div>
                  <strong>{job.title}</strong>{' '}
                  <span>
                    {categoryLabel(job.category)}, posted {formatShortDate(job.created_at)}
                  </span>
                </div>
                <Link to={`/jobs/${job.id}/recommendations`}>See ranked workers</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
