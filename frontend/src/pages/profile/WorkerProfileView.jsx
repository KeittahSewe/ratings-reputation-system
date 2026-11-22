import { ErrorState } from '../../components/ErrorState.jsx'
import { PageTitle } from '../../components/PageTitle.jsx'
import { ReputationCard } from '../../components/ReputationCard.jsx'
import { Tag } from '../../components/Tag.jsx'
import { Toggle } from '../../components/Toggle.jsx'
import { AccountDetailsCard } from './AccountDetailsCard.jsx'
import { ReviewsCard } from './ReviewsCard.jsx'
import { SkillsCard } from './SkillsCard.jsx'
import styles from './WorkerProfileView.module.css'

// Figure 4.8, drawn from props so the figure fixture can show it with the
// figure's sample data. With the edit handlers it is the worker's own
// profile; without them it is the read-only view another user gets (#86).
export function WorkerProfileView({
  user,
  skills,
  reputation,
  completedJobs,
  reviews,
  reviewCount,
  own = false,
  availabilityBusy = false,
  availabilityError,
  onToggleAvailability,
  onSaveDetails,
  onAddSkill,
  onRemoveSkill,
}) {
  const availability = own ? (
    <Toggle
      label="Availability"
      checked={Boolean(user.availability)}
      onChange={onToggleAvailability}
      onText="Available for work"
      offText="Not available"
      busy={availabilityBusy}
    />
  ) : (
    <span className={styles.availability}>{user.availability ? 'Available for work' : 'Not available'}</span>
  )

  return (
    <>
      <PageTitle title={user.name} tag={<Tag>Worker</Tag>} actions={availability} />
      {availabilityError && <ErrorState title="Availability was not changed" error={availabilityError} />}
      <AccountDetailsCard user={user} onSave={own ? onSaveDetails : undefined} />
      <SkillsCard skills={skills} onAdd={own ? onAddSkill : undefined} onRemove={own ? onRemoveSkill : undefined} />
      <ReputationCard reputation={reputation} completedJobs={completedJobs} role="worker" own={own} />
      <ReviewsCard reviews={reviews} total={reviewCount} own={own} />
    </>
  )
}
