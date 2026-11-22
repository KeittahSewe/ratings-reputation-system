import { Link } from 'react-router'
import { formatDate } from '../lib/format.js'
import { SentimentTag } from './SentimentTag.jsx'
import { StarRating } from './StarRating.jsx'
import styles from './ReviewCard.module.css'

// One review received, as on Figures 4.7 and 4.8: who wrote it and for which
// job, the stars, the classifier's tag, the text and the date. The reviewer's
// name opens their profile.
export function ReviewCard({ review }) {
  return (
    <article className={styles.review}>
      <header className={styles.head}>
        <div className={styles.who}>
          <Link to={`/users/${review.reviewer.id}`} className={styles.name}>
            {review.reviewer.name}
          </Link>
          <span className={styles.job}>{review.job.title}</span>
        </div>
        <StarRating value={review.rating} />
        <SentimentTag sentiment={review.sentiment} />
      </header>
      <p className={styles.text}>{review.review_text}</p>
      <p className={styles.date}>{formatDate(review.created_at)}</p>
    </article>
  )
}
