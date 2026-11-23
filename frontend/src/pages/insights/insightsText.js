// Wording for the insights dashboard (Figure 4.12), worked out from the
// GET /api/me/insights response. Pure functions, tested in insightsText.test.js.

import { formatScore, plural } from '../../lib/format.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const PERIOD_OPTIONS = [
  { value: '6m', label: 'Last 6 months' },
  { value: '3m', label: 'Last 3 months' },
]
export const DEFAULT_PERIOD = '6m'

// '6m' for anything the API would not accept, so a hand-typed URL still loads.
export function periodFromSearch(value) {
  return PERIOD_OPTIONS.some((o) => o.value === value) ? value : DEFAULT_PERIOD
}

const PERIOD_AGO = { '6m': 'six months ago', '3m': 'three months ago' }
const PERIOD_IN = { '6m': 'in the last 6 months', '3m': 'in the last 3 months' }

function parts(key) {
  const [year, month] = key.split('-').map(Number)
  return { year, month }
}

// 'Mar' for '2026-03'.
export function shortMonth(key) {
  return MONTHS[parts(key).month - 1].slice(0, 3)
}

// 'March 2026' for '2026-03'.
export function longMonth(key) {
  const { year, month } = parts(key)
  return `${MONTHS[month - 1]} ${year}`
}

// The chart heading: "Sentiment trend, March to August 2026", with both years
// when the period crosses the new year.
export function trendTitle(months) {
  const first = parts(months[0])
  const last = parts(months[months.length - 1])
  const from = first.year === last.year ? MONTHS[first.month - 1] : longMonth(months[0])
  return `Sentiment trend, ${from} to ${longMonth(months[months.length - 1])}`
}

// The note under the total reviews card.
export function reviewsNote(reviews, period) {
  const added = reviews.count - reviews.at_period_start
  let note = `${added} ${PERIOD_IN[period]}`
  if (reviews.pending > 0) note += `, ${reviews.pending} waiting for classification`
  return note
}

// The note under the average star rating card, compared on the shown
// one-decimal values so the words never disagree with the numbers.
export function ratingNote(average, period) {
  if (average.value === null) return 'No ratings counted yet'
  if (average.at_period_start === null) return `No ratings before ${PERIOD_AGO[period]}`
  const now = formatScore(average.value)
  const then = formatScore(average.at_period_start)
  if (now === then) return `Same as ${PERIOD_AGO[period]}`
  return `${Number(now) > Number(then) ? 'Up' : 'Down'} from ${then} ${PERIOD_AGO[period]}`
}

// The note under the jobs completed card.
export function jobsNote(jobs, period) {
  return `${jobs.count - jobs.at_period_start} ${PERIOD_IN[period]}`
}

// The note under the reputation card: the three components, as on Figure 4.12.
export function reputationNote(reputation) {
  if (!reputation) return 'Appears after your first counted review'
  const parts = [
    `Ratings ${formatScore(reputation.ratings_component)}`,
    `sentiment ${formatScore(reputation.sentiment_component)}`,
    `job history ${formatScore(reputation.history_component)}`,
  ]
  return parts.join(', ')
}

// The sentence beside the chart legend. The second sentence compares the
// first and last months that have any reviews, and is left out when fewer
// than two months do.
export function trendCaption(months) {
  const base = "Each column shows the share of that month's reviews in each class."
  const filled = months.filter((m) => m.percent)
  if (filled.length < 2) return base
  const first = filled[0]
  const last = filled[filled.length - 1]
  const from = first.percent.negative
  const to = last.percent.negative
  const where = `in ${MONTHS[parts(first.month).month - 1]}`
  const until = `in ${MONTHS[parts(last.month).month - 1]}`
  if (from === to) return `${base} Negative share was ${from} percent ${where} and ${until}.`
  const verb = to < from ? 'fallen' : 'risen'
  return `${base} Negative share has ${verb} from ${from} percent ${where} to ${to} percent ${until}.`
}

// The month label under a column: "Aug", or "Nov, so far" for the current month.
export function columnLabel(month) {
  return month.partial ? `${shortMonth(month.month)}, so far` : shortMonth(month.month)
}

// The line under the month label.
export function columnNote(month) {
  if (!month.percent) return 'No reviews'
  return `${month.percent.negative}% negative`
}

// The total count shown for each class in the legend.
export function legendCounts(months) {
  const totals = { positive: 0, neutral: 0, negative: 0 }
  for (const m of months) for (const key of Object.keys(totals)) totals[key] += m.counts[key]
  return totals
}

// "Mentioned in 27 of 41 reviews"
export function mentionsLine(theme) {
  return `Mentioned in ${theme.reviews} of ${plural(theme.of, 'review')}`
}

// "Positive in 20, neutral in 5, negative in 2", leaving out classes at zero,
// then how many negative mentions still came with four or five stars.
export function themeBreakdown(theme) {
  const bits = ['positive', 'neutral', 'negative']
    .filter((label) => theme.counts[label] > 0)
    .map((label) => `${label} in ${theme.counts[label]}`)
  let line = bits.join(', ')
  line = line.charAt(0).toUpperCase() + line.slice(1)
  const k = theme.negative_with_4_or_5_stars
  const n = theme.counts.negative
  if (k > 0 && n === 1) line += '. The negative mention still gave four or five stars'
  else if (k > 0) line += `. ${k} of the ${n} negative mentions still gave four or five stars`
  return line
}

export const THEME_LABELS = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative', mixed: 'Mixed' }
