import styles from './StarRating.module.css'

const STAR = 'M7 0.8l1.82 3.9 4.28.52-3.16 2.93.84 4.23L7 10.27 3.22 12.38l.84-4.23L.9 5.22l4.28-.52z'

// Five drawn stars and the number beside them, as on the review cards of
// Figures 4.7 and 4.8. The number carries the value for greyscale print and
// screen readers; the stars are decoration. An input mode comes with #88.
export function StarRating({ value }) {
  const rounded = Math.round(value)
  return (
    <span className={styles.rating}>
      <span className={styles.stars} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <svg key={n} viewBox="0 0 14 14" width="14" height="14" className={n <= rounded ? styles.filled : styles.empty}>
            <path d={STAR} />
          </svg>
        ))}
      </span>
      <span className={styles.value}>
        <span className="visually-hidden">Rated </span>
        {Number(value).toFixed(1)}
        <span className="visually-hidden"> out of 5</span>
      </span>
    </span>
  )
}
