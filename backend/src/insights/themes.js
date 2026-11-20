// Theme counting for the insights dashboard (plan C1; rules confirmed
// 20 November). Pure functions: no database, no clock.
//
// A theme counts once per review, however many of the review's sentences
// mention it. That review's sentiment for the theme comes from the sentences
// that mention it:
//   a positive and a negative sentence both mention it  -> neutral
//     (praise and complaint cancel, as in rule 4 of the labelling guideline)
//   otherwise any positive or negative sentence           -> that label
//   only neutral sentences                                -> neutral
//
// Across reviews, a theme's sentiment is the label with the most reviews, or
// 'mixed' when the top two are level.

import { hasWords, words } from '../text/phrases.js'

export const LABELS = ['positive', 'neutral', 'negative']

// The keys of the themes one sentence mentions.
export function themesInSentence(text, lexicon) {
  const have = words(text)
  return lexicon.filter((theme) => theme.triggerWords.some((need) => hasWords(have, need))).map((t) => t.key)
}

function combine(labels) {
  const hasPositive = labels.includes('positive')
  const hasNegative = labels.includes('negative')
  if (hasPositive && hasNegative) return 'neutral'
  if (hasPositive) return 'positive'
  if (hasNegative) return 'negative'
  return 'neutral'
}

// sentences: [{ text, label }] as stored in sentiment_results.sentences.
// Returns a Map from theme key to this review's label for that theme.
export function reviewThemes(sentences, lexicon) {
  const labelsByTheme = new Map()
  for (const sentence of sentences ?? []) {
    if (typeof sentence?.text !== 'string' || !LABELS.includes(sentence.label)) continue
    for (const key of themesInSentence(sentence.text, lexicon)) {
      if (!labelsByTheme.has(key)) labelsByTheme.set(key, [])
      labelsByTheme.get(key).push(sentence.label)
    }
  }
  const result = new Map()
  for (const [key, labels] of labelsByTheme) result.set(key, combine(labels))
  return result
}

export function dominantLabel(counts) {
  const ranked = LABELS.map((label) => [label, counts[label]]).sort((a, b) => b[1] - a[1])
  if (ranked[0][1] === 0) return null
  return ranked[0][1] === ranked[1][1] ? 'mixed' : ranked[0][0]
}

function emptyCounts() {
  return { positive: 0, neutral: 0, negative: 0 }
}

// Whole-number shares that add up to 100, by largest remainder. Ties on the
// remainder go to positive, then neutral, then negative. null when there is
// nothing to share, so a chart draws a gap rather than an empty column.
export function percentages(counts) {
  const total = LABELS.reduce((sum, label) => sum + counts[label], 0)
  if (total === 0) return null
  const exact = LABELS.map((label) => (100 * counts[label]) / total)
  const result = Object.fromEntries(LABELS.map((label, i) => [label, Math.floor(exact[i])]))
  let left = 100 - LABELS.reduce((sum, label) => sum + result[label], 0)
  const order = LABELS.map((label, i) => [label, exact[i] - Math.floor(exact[i]), i]).sort(
    (a, b) => b[1] - a[1] || a[2] - b[2],
  )
  for (const [label] of order) {
    if (left === 0) break
    result[label] += 1
    left -= 1
  }
  return result
}

// reviews: the counted reviews in the period, each { rating, month, sentences }.
// months: the period's month keys, oldest first.
// Returns one entry per theme mentioned at least once, most mentioned first,
// with lexicon order breaking ties.
export function summariseThemes(reviews, lexicon, months) {
  const entries = new Map(
    lexicon.map((theme) => [
      theme.key,
      {
        key: theme.key,
        name: theme.name,
        reviews: 0,
        of: reviews.length,
        sentiment: null,
        counts: emptyCounts(),
        negative_with_4_or_5_stars: 0,
        by_month: months.map(() => 0),
      },
    ]),
  )

  for (const review of reviews) {
    const monthIndex = months.indexOf(review.month)
    for (const [key, label] of reviewThemes(review.sentences, lexicon)) {
      const entry = entries.get(key)
      entry.reviews += 1
      entry.counts[label] += 1
      if (label === 'negative' && review.rating >= 4) entry.negative_with_4_or_5_stars += 1
      if (monthIndex >= 0) entry.by_month[monthIndex] += 1
    }
  }

  const order = lexicon.map((t) => t.key)
  return [...entries.values()]
    .filter((entry) => entry.reviews > 0)
    .map((entry) => ({ ...entry, sentiment: dominantLabel(entry.counts) }))
    .sort((a, b) => b.reviews - a.reviews || order.indexOf(a.key) - order.indexOf(b.key))
}
