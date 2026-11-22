import { useState } from 'react'
import { useAuth } from '../../auth/useAuth.js'
import { ErrorState } from '../../components/ErrorState.jsx'
import { LoadingState } from '../../components/LoadingState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { apiFetch } from '../../lib/api.js'
import { useApi } from '../../lib/useApi.js'
import { ClientProfileView } from './ClientProfileView.jsx'
import { WorkerProfileView } from './WorkerProfileView.jsx'

const byName = (a, b) => a.skill_name.localeCompare(b.skill_name)

// /profile, the signed-in user's own profile: Figure 4.8 for workers, 4.7 for
// clients. GET /api/me (held by AuthProvider) gives the editable parts:
// account details and skills. GET /api/users/:id gives what others see: the
// reputation with its counts, completed jobs and the reviews received.
export function ProfilePage() {
  const { me, setMe } = useAuth()
  const profile = useApi(`/users/${me.user.id}`)
  const [availabilityBusy, setAvailabilityBusy] = useState(false)
  const [availabilityError, setAvailabilityError] = useState(null)

  const updateUser = (user) => setMe((current) => ({ ...current, user: { ...current.user, ...user } }))

  async function toggleAvailability(next) {
    setAvailabilityBusy(true)
    setAvailabilityError(null)
    try {
      const { user } = await apiFetch('/me', { method: 'PATCH', body: { availability: next } })
      updateUser(user)
    } catch (err) {
      setAvailabilityError(err)
    } finally {
      setAvailabilityBusy(false)
    }
  }

  async function saveDetails(changes) {
    const { user } = await apiFetch('/me', { method: 'PATCH', body: changes })
    updateUser(user)
  }

  async function addSkill(fields) {
    const { skill } = await apiFetch('/me/skills', { method: 'POST', body: fields })
    setMe((current) => ({ ...current, skills: [...current.skills, skill].sort(byName) }))
  }

  async function removeSkill(skill) {
    await apiFetch(`/me/skills/${skill.id}`, { method: 'DELETE' })
    setMe((current) => ({ ...current, skills: current.skills.filter((s) => s.id !== skill.id) }))
  }

  if (profile.status === 'loading') {
    return (
      <>
        <PageTitle title={me.user.name} />
        <LoadingState label="Loading your profile" />
      </>
    )
  }
  if (profile.status === 'error') {
    return (
      <>
        <PageTitle title={me.user.name} />
        <ErrorState title="Your profile could not be loaded" error={profile.error} onRetry={profile.reload} />
      </>
    )
  }

  const { reputation, completed_jobs: completedJobs, reviews, review_count: reviewCount } = profile.data
  if (me.user.role === 'client') {
    return (
      <ClientProfileView
        user={me.user}
        reputation={reputation}
        completedJobs={completedJobs}
        reviews={reviews}
        reviewCount={reviewCount}
        own
        onSaveDetails={saveDetails}
      />
    )
  }
  return (
    <WorkerProfileView
      user={me.user}
      skills={me.skills}
      reputation={reputation}
      completedJobs={completedJobs}
      reviews={reviews}
      reviewCount={reviewCount}
      own
      availabilityBusy={availabilityBusy}
      availabilityError={availabilityError}
      onToggleAvailability={toggleAvailability}
      onSaveDetails={saveDetails}
      onAddSkill={addSkill}
      onRemoveSkill={removeSkill}
    />
  )
}
