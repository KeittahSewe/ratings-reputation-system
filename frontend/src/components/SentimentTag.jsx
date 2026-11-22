import styles from './SentimentTag.module.css'

const LABELS = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative' }

// The classifier's label and confidence for one review, as on Figures 4.7
// and 4.8: "Positive 0.97". The word and the number carry the meaning; the
// fill repeats it. sentiment null means the review is still waiting for the
// classifier.
export function SentimentTag({ sentiment }) {
  if (!sentiment) {
    return <span className={`${styles.tag} ${styles.pending}`}>Sentiment pending</span>
  }
  const { label, confidence_score: confidence } = sentiment
  return (
    <span className={`${styles.tag} ${styles[label]}`}>
      {LABELS[label] ?? label} {Number(confidence).toFixed(2)}
      <span className="visually-hidden"> confidence</span>
    </span>
  )
}
