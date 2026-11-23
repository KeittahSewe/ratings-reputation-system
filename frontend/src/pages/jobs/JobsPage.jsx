import { useState } from 'react'
import { useAuth } from '../../auth/useAuth.js'
import { Button } from '../../components/Button.jsx'
import { Card } from '../../components/Card.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { ErrorState } from '../../components/ErrorState.jsx'
import { LoadingState } from '../../components/LoadingState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { useApi } from '../../lib/useApi.js'
import { JobActions } from './JobActions.jsx'
import { JobDetailPanel } from './JobDetail.jsx'
import { JobFilters } from './JobFilters.jsx'
import { JobsTable } from './JobsTable.jsx'
import { PostJobPanel } from './PostJobPanel.jsx'
import { useJobFilters } from './useJobFilters.js'
import styles from './Jobs.module.css'

// The table's action column. A link when the action is a page of its own,
// otherwise it opens the detail panel, where the status changes live.
function clientAction(job) {
  if (job.can_review) return { label: 'Leave review', to: `/jobs/${job.id}/review` }
  if (job.status === 'open') return { label: 'Find workers', to: `/jobs/${job.id}/recommendations` }
  return { label: 'View details' }
}

function workerAction(job) {
  if (job.can_review) return { label: 'Leave review', to: `/jobs/${job.id}/review` }
  return { label: 'View details' }
}

// My Jobs, Figure 4.9. A client sees the jobs they posted, a worker the jobs
// assigned to them, both newest first. The figure's "View applicants" is
// "Find workers": the API keeps no applications, and a client assigns a
// worker from the ranked recommendations (change log, 22 November).
export function JobsPage() {
  const { me } = useAuth()
  const isClient = me.user.role === 'client'
  const view = useJobFilters('/jobs')
  const list = useApi(view.apiPath, { keepPrevious: true })
  const [posting, setPosting] = useState(false)

  // can_review comes with the list row; a job opened from a link that the
  // current filters hide falls back to offering the review page, which says
  // if the review was already written.
  const canReviewFor = (job) => list.data?.jobs.find((row) => row.id === job.id)?.can_review ?? job.status === 'completed'

  function posted(job) {
    setPosting(false)
    view.showFresh(job.id)
    list.reload()
  }

  return (
    <>
      <PageTitle
        title="My Jobs"
        actions={isClient && !posting && <Button onClick={() => setPosting(true)}>Post a job</Button>}
      />
      {posting && <PostJobPanel onPosted={posted} onClose={() => setPosting(false)} />}
      <JobFilters filters={view.filters} onChange={view.setFilters} />
      <JobList
        list={list}
        view={view}
        party={isClient ? 'worker' : 'client'}
        actionFor={isClient ? clientAction : workerAction}
        emptyTitle={isClient ? 'You have not posted a job yet' : 'No jobs are assigned to you yet'}
        emptyText={
          isClient
            ? 'Jobs you post appear here with their status.'
            : 'Clients assign workers from a ranked list built from skills, reputation and past hires. Keeping your skills and availability up to date on your profile helps you rank.'
        }
      />
      {view.selectedId && (
        <JobDetailPanel
          key={view.selectedId}
          jobId={view.selectedId}
          viewerRole={me.user.role}
          onClose={view.close}
          actions={(job, reloadJob) => (
            <JobActions
              job={job}
              role={me.user.role}
              canReview={canReviewFor(job)}
              onChanged={() => {
                reloadJob()
                list.reload()
              }}
            />
          )}
        />
      )}
    </>
  )
}

// The table with its loading, error and empty states, shared with Available Jobs.
export function JobList({ list, view, party, actionFor, emptyTitle, emptyText }) {
  if (list.status === 'error') {
    return <ErrorState title="Jobs could not be loaded" error={list.error} onRetry={list.reload} />
  }
  if (!list.data) return <LoadingState label="Loading jobs" />
  const { jobs } = list.data
  return (
    <div className={styles.listArea} aria-busy={list.status === 'loading'}>
      {list.status === 'loading' && <p className={styles.updating}>Updating the list</p>}
      {jobs.length === 0 ? (
        <Card>
          <EmptyState title={view.filtered ? 'No jobs match these filters' : emptyTitle}>
            {view.filtered ? 'Clear a filter or change the search to see more.' : emptyText}
          </EmptyState>
        </Card>
      ) : (
        <JobsTable jobs={jobs} selectedId={view.selectedId} party={party} onSelect={view.select} actionFor={actionFor} />
      )}
    </div>
  )
}
