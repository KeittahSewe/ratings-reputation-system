import { percentages, plural } from '../lib/format.js'
import styles from './SentimentBar.module.css'

const SEGMENTS = [
  { key: 'positive', label: 'Positive' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'negative', label: 'Negative' },
]

// The sentiment distribution of Figures 4.8 and 4.11: one stacked bar split
// three ways, with a legend that spells out the percent and the count of every
// class, so the bar never depends on colour (the dissertation prints in
// greyscale). Widths are proportions, so the bar fills whatever width it is
// given; segments are separated by a 2px gap in the surface colour.
// counts: { positive, neutral, negative }. compact drops the heading, for the
// 300px bars on recommendation cards.
export function SentimentBar({ counts, compact = false }) {
  const total = counts.positive + counts.neutral + counts.negative
  const percent = percentages(counts)
  if (!percent) return null
  return (
    <figure className={styles.figure}>
      {!compact && <figcaption className={styles.caption}>Sentiment distribution across {plural(total, 'review')}</figcaption>}
      <div className={`${styles.bar} ${compact ? styles.compact : ''}`} aria-hidden="true">
        {SEGMENTS.filter(({ key }) => counts[key] > 0).map(({ key, label }) => (
          <span
            key={key}
            className={`${styles.segment} ${styles[key]}`}
            style={{ flexGrow: counts[key] }}
            title={`${label}: ${percent[key]} percent (${plural(counts[key], 'review')})`}
          />
        ))}
      </div>
      <ul className={styles.legend}>
        {SEGMENTS.map(({ key, label }) => (
          <li key={key} className={styles.item}>
            <span className={`${styles.swatch} ${styles[key]}`} aria-hidden="true" />
            {label}
            <span>{percent[key]} percent</span>
            <span>({plural(counts[key], 'review')})</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
