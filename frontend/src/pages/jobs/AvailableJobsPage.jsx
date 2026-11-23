import { useAuth } from '../../auth/useAuth.js'
import { PageTitle } from '../../components/PageTitle.jsx'
import { useApi } from '../../lib/useApi.js'
import { JobDetailPanel } from './JobDetail.jsx'
import { JobFilters } from './JobFilters.jsx'
import { JobList } from './JobsPage.jsx'
import { useJobFilters } from './useJobFilters.js'
import styles from './Jobs.module.css'

// Available Jobs, for workers: every open job, read only. There is nothing to
// apply for, because clients pick workers from the ranked recommendations,
// and the page says so (change log, 22 November). Not a figure of its own; it
// reuses the table and detail of Figure 4.9.
export function AvailableJobsPage() {
  const { me } = useAuth()
  const view = useJobFilters('/jobs/available')
  const list = useApi(view.apiPath, { keepPrevious: true })
  return (
    <>
      <PageTitle title="Available Jobs" />
      <p className={styles.intro}>
        Open jobs on the marketplace. There is nothing to apply for: clients choose workers from a ranked list built from
        skills, reputation and past hires, and each client can see why a worker ranked where they did. Keeping your skills
        and availability up to date on your profile is what puts you on that list.
      </p>
      <JobFilters filters={view.filters} onChange={view.setFilters} showStatus={false} />
      <JobList
        list={list}
        view={view}
        party="client"
        actionFor={() => ({ label: 'View details' })}
        emptyTitle="No open jobs right now"
        emptyText="New jobs appear here as clients post them."
      />
      {view.selectedId && <JobDetailPanel key={view.selectedId} jobId={view.selectedId} viewerRole={me.user.role} onClose={view.close} />}
    </>
  )
}
