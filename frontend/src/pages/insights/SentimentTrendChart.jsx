import { plural } from '../../lib/format.js'
import { columnLabel, columnNote, legendCounts, longMonth, trendCaption } from './insightsText.js'
import styles from './Insights.module.css'

const CLASSES = [
  { key: 'positive', label: 'Positive' },
  { key: 'neutral', label: 'Neutral' },
  { key: 'negative', label: 'Negative' },
]

// Drawing units. The SVG scales to the card's width; at 1440 wide one unit is
// about one pixel.
const WIDTH = 1088
const AXIS = 44
const TOP = 8
const PLOT = 220
const BOTTOM = 52
const HEIGHT = TOP + PLOT + BOTTOM
const GAP = 2
const MAX_COLUMN = 120
const TICKS = [0, 25, 50, 75, 100]

const y = (percent) => TOP + PLOT - (PLOT * percent) / 100

// The stacked column chart of Figure 4.12: one column per month, positive at
// the base, then neutral, then negative, each the share of that month's
// counted reviews. A month with no reviews is a gap labelled "No reviews",
// never a zero-height column. The current month is labelled "so far".
// Colour is never the only carrier: positive carries its percent inside, the
// negative percent sits under every column, the legend gives counts, every
// segment has a hover title, and a hidden table holds every number.
export function SentimentTrendChart({ months }) {
  const slot = (WIDTH - AXIS) / months.length
  const column = Math.min(MAX_COLUMN, slot * 0.72)
  const totals = legendCounts(months)

  return (
    <figure className={styles.chartFigure}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Sentiment share by month. The table that follows has the same numbers."
      >
        {TICKS.map((t) => (
          <g key={t}>
            <line className={t === 0 ? styles.axis : styles.grid} x1={AXIS} x2={WIDTH} y1={y(t)} y2={y(t)} />
            <text className={styles.tick} x={AXIS - 8} y={y(t) + 4} textAnchor="end">
              {t}%
            </text>
          </g>
        ))}
        <line className={styles.axis} x1={AXIS} x2={AXIS} y1={TOP} y2={TOP + PLOT} />

        {months.map((m, i) => {
          const center = AXIS + slot * i + slot / 2
          const left = center - column / 2
          return (
            <g key={m.month}>
              {m.percent && <Column month={m} left={left} width={column} />}
              <text className={styles.monthLabel} x={center} y={TOP + PLOT + 20} textAnchor="middle">
                {columnLabel(m)}
              </text>
              <text className={styles.monthNote} x={center} y={TOP + PLOT + 38} textAnchor="middle">
                {columnNote(m)}
              </text>
            </g>
          )
        })}
      </svg>

      <div className={styles.chartFoot}>
        <ul className={styles.legend}>
          {CLASSES.map(({ key, label }) => (
            <li key={key}>
              <span className={`${styles.swatch} ${styles[key]}`} aria-hidden="true" />
              {label} <span className={styles.legendCount}>{totals[key]}</span>
            </li>
          ))}
        </ul>
        <figcaption className={styles.chartCaption}>{trendCaption(months)}</figcaption>
      </div>

      <table className="visually-hidden">
        <caption>Counted reviews by month and sentiment class</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Reviews</th>
            {CLASSES.map(({ key, label }) => (
              <th key={key} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">
                {longMonth(m.month)}
                {m.partial ? ', so far' : ''}
              </th>
              <td>{m.total}</td>
              {CLASSES.map(({ key }) => (
                <td key={key}>{m.percent ? `${m.percent[key]} percent (${m.counts[key]})` : 'none'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// One month's column. Segments are stacked from the base and separated by a
// 2px gap in the card colour.
function Column({ month, left, width }) {
  let base = 0
  const segments = []
  for (const { key, label } of CLASSES) {
    const share = month.percent[key]
    if (share === 0) continue
    const bottom = y(base)
    const top = y(base + share)
    base += share
    segments.push({ key, label, share, top, height: bottom - top })
  }
  return (
    <g>
      {segments.map((s, i) => {
        // Every segment above the first gives up 2px at its base for the gap.
        const gap = i === 0 ? 0 : GAP
        const height = Math.max(s.height - gap, 1)
        return (
          <g key={s.key}>
            <rect className={styles[s.key]} x={left} y={s.top} width={width} height={height}>
              <title>
                {`${longMonth(month.month)}: ${s.label} ${s.share} percent, ${month.counts[s.key]} of ${plural(month.total, 'review')}`}
              </title>
            </rect>
            {s.key === 'positive' && height >= 24 && (
              <text className={styles.inside} x={left + width / 2} y={s.top + height / 2 + 4} textAnchor="middle">
                {s.share}%
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
