// Builds the GET /api/me/insights response (plan 3.3 and C1, Figure 4.12)
// from rows already read from the database. Pure: the route passes in the
// rows and the time, so tests need no database and no clock.
//
// Which reviews count (confirmed 20 November): the same set as the reputation
// score, reviews the user received that are visible and classified. A hidden
// review is dropped before any of its sentences are read, so no count, chart
// column or theme can give it away. Visible reviews still waiting for a
// classification are left out and reported as pending.
//
// Scope: the period sets the chart, the themes and the guidance. The summary
// cards are all-time, each with its value at the start of the period, for
// lines such as "Up from 4.7 six months ago". The reputation card is the
// stored score, which has no period.

import { twoDecimals } from '../reputation/score.js'
import { isVisible } from '../reviews/visibility.js'
import { buildGuidance, GUIDANCE_NOTE } from './guidance.js'
import { lexiconFor } from './lexicon.js'
import { monthKey, periodMonths, TIME_ZONE } from './months.js'
import { LABELS, percentages, summariseThemes } from './themes.js'

function meanRating(reviews) {
  if (reviews.length === 0) return null
  return twoDecimals(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length)
}

//   role             'client' or 'worker'
//   period           '3m' or '6m'
//   now              the time of the request
//   received         every review the user received:
//                    [{ job_id, rating, created_at, sentiment: { label, model_version, sentences } or null }]
//   answeredJobIds   the jobs the user has reviewed in return (for visibility)
//   history          the user's finished jobs: [{ status, completed_at }]
//   reputation       the stored reputation row, or null
export function buildInsights({ role, period, now, received, answeredJobIds, history, reputation }) {
  const lexicon = lexiconFor(role)
  const months = periodMonths(period, now)
  const periodStart = months[0].start
  const before = (at) => new Date(at).getTime() < periodStart.getTime()

  const visible = received.filter((r) => isVisible(r, answeredJobIds, now))
  const counted = visible.filter((r) => r.sentiment)
  const pending = visible.length - counted.length
  const countedBefore = counted.filter((r) => before(r.created_at))
  const completed = history.filter((j) => j.status === 'completed' && j.completed_at)

  const inPeriod = counted
    .filter((r) => !before(r.created_at))
    .map((r) => ({
      rating: r.rating,
      label: r.sentiment.label,
      model_version: r.sentiment.model_version,
      sentences: r.sentiment.sentences ?? [],
      month: monthKey(r.created_at),
    }))

  const sentimentByMonth = months.map(({ month, partial }) => {
    const counts = { positive: 0, neutral: 0, negative: 0 }
    for (const r of inPeriod) if (r.month === month && LABELS.includes(r.label)) counts[r.label] += 1
    const total = LABELS.reduce((sum, label) => sum + counts[label], 0)
    return { month, partial, total, counts, percent: percentages(counts) }
  })

  const monthKeys = months.map((m) => m.month)
  const themes = summariseThemes(inPeriod, lexicon, monthKeys)

  return {
    role,
    period: { key: period, time_zone: TIME_ZONE, from: periodStart.toISOString(), months: monthKeys },
    summary: {
      reputation,
      reviews: { count: counted.length, at_period_start: countedBefore.length, pending },
      average_rating: { value: meanRating(counted), at_period_start: meanRating(countedBefore) },
      jobs_completed: {
        count: completed.length,
        at_period_start: completed.filter((j) => before(j.completed_at)).length,
      },
    },
    sentiment_by_month: sentimentByMonth,
    themes,
    guidance: buildGuidance(themes, sentimentByMonth, lexicon),
    guidance_note: GUIDANCE_NOTE,
    model_versions: [...new Set(inPeriod.map((r) => r.model_version))].sort(),
  }
}
