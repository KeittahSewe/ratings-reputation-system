import { Link } from 'react-router'
import { Card } from '../../components/Card.jsx'
import { SentimentTag } from '../../components/SentimentTag.jsx'
import { StarRating } from '../../components/StarRating.jsx'
import { formatDate } from '../../lib/format.js'
import styles from './Review.module.css'

// After submitting, or on a later visit: the review written, with the
// classifier's tag or "Sentiment pending", and where the other party's review
// stands (GET /api/jobs/:id/reviews: none, hidden until a date, or visible).
export function ReviewOutcome({ written, received, revieweeName, justSubmitted, jobId }) {
  return (
    <>
      <Card title={justSubmitted ? 'Review submitted' : 'Your review'}>
        <div className={styles.ownReview}>
          <div className={styles.ownHead}>
            <StarRating value={written.rating} />
            <SentimentTag sentiment={written.sentiment} />
            <span className={styles.muted}>{formatDate(written.created_at)}</span>
          </div>
          <p className={styles.reviewText}>{written.review_text}</p>
          {written.sentiment ? (
            <p className={styles.muted}>
              DistilBERT classified your review as {written.sentiment.label}, with confidence{' '}
              {Number(written.sentiment.confidence_score).toFixed(2)}.
            </p>
          ) : (
            <p className={styles.muted}>
              The sentiment model could not be reached, so your review is saved and waiting. It is classified automatically,
              usually within a few minutes, and counts from then on.
            </p>
          )}
        </div>
      </Card>
      <Card title={`${revieweeName}'s review of you`}>
        <ReceivedReview received={received} name={revieweeName} />
      </Card>
      <p>
        <Link to={`/jobs?job=${jobId}`}>Back to the job</Link>
      </p>
    </>
  )
}

function ReceivedReview({ received, name }) {
  if (received.status === 'none') return <p className={styles.muted}>{name} has not reviewed you for this job yet.</p>
  if (received.status === 'hidden') {
    return (
      <p className={styles.muted}>
        {name} has reviewed you. It shows here once you have submitted yours, or on {formatDate(received.visible_at)}.
      </p>
    )
  }
  const review = received.review
  return (
    <div className={styles.ownReview}>
      <div className={styles.ownHead}>
        <StarRating value={review.rating} />
        <SentimentTag sentiment={review.sentiment} />
        <span className={styles.muted}>{formatDate(review.created_at)}</span>
      </div>
      <p className={styles.reviewText}>{review.review_text}</p>
    </div>
  )
}
