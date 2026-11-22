import { PageTitle } from '../../components/PageTitle.jsx'
import { ReputationCard } from '../../components/ReputationCard.jsx'
import { Tag } from '../../components/Tag.jsx'
import { AccountDetailsCard } from './AccountDetailsCard.jsx'
import { ReviewsCard } from './ReviewsCard.jsx'

// Figure 4.7, drawn from props like WorkerProfileView. A client's card shows
// the same three components and formula as a worker's (a client asking how
// their score works has the same claim on an answer), without the sentiment
// bar, which the figure gives to workers only. With onSaveDetails it is the
// client's own profile; without it, the read-only view others get.
export function ClientProfileView({ user, reputation, completedJobs, reviews, reviewCount, own = false, onSaveDetails }) {
  return (
    <>
      <PageTitle title={user.name} tag={<Tag>Client</Tag>} />
      <AccountDetailsCard user={user} onSave={own ? onSaveDetails : undefined} />
      <ReputationCard reputation={reputation} completedJobs={completedJobs} role="client" own={own} showDistribution={false} />
      <ReviewsCard reviews={reviews} total={reviewCount} own={own} />
    </>
  )
}
