import { Navigate, useParams } from 'react-router'
import { useAuth } from '../../auth/useAuth.js'
import { ErrorState } from '../../components/ErrorState.jsx'
import { LoadingState } from '../../components/LoadingState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { useApi } from '../../lib/useApi.js'
import { ClientProfileView } from './ClientProfileView.jsx'
import { WorkerProfileView } from './WorkerProfileView.jsx'

// /users/:id, another user's profile, read only: no email, no Edit, no
// toggle, no skill editing. Reached from review cards, job rows and
// recommendation cards. Opening your own id goes to /profile.
export function UserProfilePage() {
  const { id } = useParams()
  const { me } = useAuth()
  const own = id === me.user.id
  const profile = useApi(own ? null : `/users/${id}`)

  if (own) return <Navigate to="/profile" replace />
  if (profile.status === 'loading') {
    return (
      <>
        <PageTitle title="Profile" />
        <LoadingState label="Loading the profile" />
      </>
    )
  }
  if (profile.status === 'error') {
    const missing = profile.error.status === 404
    return (
      <>
        <PageTitle title="Profile" />
        <ErrorState
          title={missing ? 'There is no user at this address' : 'The profile could not be loaded'}
          error={missing ? null : profile.error}
          onRetry={missing ? undefined : profile.reload}
        />
      </>
    )
  }

  const { user, skills, reputation, completed_jobs: completedJobs, reviews, review_count: reviewCount } = profile.data
  const shared = { user, reputation, completedJobs, reviews, reviewCount }
  return user.role === 'worker' ? <WorkerProfileView {...shared} skills={skills} /> : <ClientProfileView {...shared} />
}
