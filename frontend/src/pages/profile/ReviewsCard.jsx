import { Card } from '../../components/Card.jsx'
import { EmptyState } from '../../components/EmptyState.jsx'
import { ReviewCard } from '../../components/ReviewCard.jsx'
import styles from './Profile.module.css'

// Reviews received, as on Figures 4.7 and 4.8. The API sends the 10 newest
// visible reviews and the count of all visible ones; a review the user cannot
// see yet is in neither.
export function ReviewsCard({ reviews, total, own }) {
  return (
    <Card title={`Reviews received (${total})`}>
      {reviews.length === 0 ? (
        <EmptyState title="No reviews yet">
          {own
            ? 'A review shows here once you have reviewed the other party back, or 14 days after it was written.'
            : 'Reviews show here once both parties can see them.'}
        </EmptyState>
      ) : (
        <div className={styles.reviewList}>
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {total > reviews.length && (
            <p className={styles.helper}>
              Showing the {reviews.length} newest of {total} reviews.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
