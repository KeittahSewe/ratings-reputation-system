import { Link } from 'react-router'
import { Card } from '../../components/Card.jsx'
import { ErrorState } from '../../components/ErrorState.jsx'
import { LoadingState } from '../../components/LoadingState.jsx'
import { StatusPill } from '../../components/StatusPill.jsx'
import { Tag } from '../../components/Tag.jsx'
import { useApi } from '../../lib/useApi.js'
import { LinkButton } from '../profile/LinkButton.jsx'
import { PartyCard } from './PartyCard.jsx'
import { StatusTimeline } from './StatusTimeline.jsx'
import styles from './Jobs.module.css'

// Loads one job and the other party's profile for the detail panel.
export function JobDetailPanel({ jobId, viewerRole, onClose, actions }) {
  // keepPrevious: after a status change the panel reloads in place rather
  // than flashing back to a spinner.
  const job = useApi(`/jobs/${jobId}`, { keepPrevious: true })
  const other = job.data ? (viewerRole === 'client' ? job.data.job.worker : job.data.job.client) : null
  const profile = useApi(other ? `/users/${other.id}` : null, { keepPrevious: true })

  if (!job.data && job.status === 'loading') {
    return (
      <Card title="Job details" aside={<LinkButton onClick={onClose}>Close details</LinkButton>}>
        <LoadingState label="Loading the job" />
      </Card>
    )
  }
  if (job.status === 'error') {
    return (
      <Card title="Job details" aside={<LinkButton onClick={onClose}>Close details</LinkButton>}>
        <ErrorState
          title={job.error.status === 404 ? 'This job is not available to you' : 'The job could not be loaded'}
          error={job.error.status === 404 ? null : job.error}
          onRetry={job.error.status === 404 ? undefined : job.reload}
        />
      </Card>
    )
  }
  return (
    <JobDetail
      job={job.data.job}
      viewerRole={viewerRole}
      partyProfile={profile.data}
      onClose={onClose}
      actions={actions?.(job.data.job, job.reload)}
    />
  )
}

// The expanded detail of Figure 4.9, drawn from props so the figure fixture
// can show it: description and required skills, the other party with their
// reputation, the status timeline, and the actions open to the viewer.
export function JobDetail({ job, viewerRole, partyProfile, onClose, actions }) {
  const isClient = viewerRole === 'client'
  return (
    <Card
      as="section"
      aria-label={`Details of ${job.title}`}
      title={job.title}
      action={<StatusPill status={job.status} />}
      aside={<LinkButton onClick={onClose}>Close details</LinkButton>}
    >
      <div className={styles.detailBody}>
        <div className={styles.detailMain}>
          <div>
            <span className={styles.detailLabel}>Description</span>
            <p className={styles.description}>{job.description}</p>
          </div>
          {job.required_skills?.length > 0 && (
            <div>
              <span className={styles.detailLabel}>Required skills</span>
              <div className={styles.skillTags}>
                {job.required_skills.map((skill) => (
                  <Tag key={skill} quiet>
                    {skill}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
        {isClient ? (
          <PartyCard
            label="Assigned worker"
            person={job.worker}
            profile={partyProfile}
            emptyText="No worker assigned yet."
            emptyAction={
              job.status === 'open' && (
                <Link to={`/jobs/${job.id}/recommendations`} className={styles.action}>
                  Find workers for this job
                </Link>
              )
            }
          />
        ) : (
          <PartyCard label="Client" person={job.client} profile={partyProfile} />
        )}
      </div>
      <StatusTimeline timeline={job.timeline} status={job.status} workerName={job.worker?.name} />
      {actions}
    </Card>
  )
}
