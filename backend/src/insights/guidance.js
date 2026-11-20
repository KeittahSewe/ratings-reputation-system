// Suggested improvements for the insights dashboard (plan C1, rules
// confirmed 20 November). Every item is a fixed sentence from the lexicon or
// below, filled with counts. Nothing is generated.
//
// At most three items, in this order:
//   1. each theme whose sentiment is negative with at least 3 negative
//      mentions, most negative mentions first, saying how many of those
//      reviews still gave four or five stars;
//   2. the positive theme with the most positive mentions, if it has at least 3;
//   3. the change in negative share between the first and last months of the
//      period that each hold at least 3 reviews, if it changed.
// 3 is the same threshold as Provisional on the reputation score.

import { monthName } from './months.js'

export const MIN_MENTIONS = 3
export const MIN_MONTH_REVIEWS = 3
export const MAX_ITEMS = 3

export const GUIDANCE_NOTE =
  'Each suggestion comes from a theme or from your sentiment trend above. Nothing here affects your score.'

function reviewsWord(n) {
  return n === 1 ? 'review' : 'reviews'
}

function negativeItem(theme, advice) {
  const n = theme.counts.negative
  let detail = `${theme.name} comes up negative in ${n} of your ${theme.of} ${reviewsWord(theme.of)}.`
  const k = theme.negative_with_4_or_5_stars
  if (k === n) detail += ` All ${n} of those reviews still gave you four or five stars.`
  else if (k > 0) detail += ` ${k} of those ${n} still gave you four or five stars.`
  return { kind: 'theme_negative', theme: theme.key, title: advice, detail }
}

function positiveItem(theme, advice) {
  return {
    kind: 'theme_positive',
    theme: theme.key,
    title: advice,
    detail: `${theme.name} is your strongest theme, positive in ${theme.counts.positive} of your ${theme.of} ${reviewsWord(theme.of)}.`,
  }
}

// months: the period's months from buildInsights, each { month, total, percent }.
function trendItem(months) {
  const full = months.filter((m) => m.total >= MIN_MONTH_REVIEWS)
  if (full.length < 2) return null
  const first = full[0]
  const last = full[full.length - 1]
  const from = first.percent.negative
  const to = last.percent.negative
  if (from === to) return null
  const detail = `Your negative share went from ${from} percent in ${monthName(first.month)} to ${to} percent in ${monthName(last.month)}.`
  if (to < from) return { kind: 'trend', theme: null, title: 'Keep doing what you have been doing.', detail }
  return { kind: 'trend', theme: null, title: `Look back at your ${monthName(last.month)} reviews for what changed.`, detail }
}

// themes: from summariseThemes. lexicon: the caller's role lexicon, for the advice.
export function buildGuidance(themes, months, lexicon) {
  const advice = new Map(lexicon.map((t) => [t.key, t.advice]))
  const items = []

  const negatives = themes
    .filter((t) => t.sentiment === 'negative' && t.counts.negative >= MIN_MENTIONS)
    .sort((a, b) => b.counts.negative - a.counts.negative)
  for (const theme of negatives) items.push(negativeItem(theme, advice.get(theme.key).negative))

  const positives = themes
    .filter((t) => t.sentiment === 'positive' && t.counts.positive >= MIN_MENTIONS)
    .sort((a, b) => b.counts.positive - a.counts.positive)
  if (positives.length > 0) items.push(positiveItem(positives[0], advice.get(positives[0].key).positive))

  const trend = trendItem(months)
  if (trend) items.push(trend)

  return items.slice(0, MAX_ITEMS)
}
