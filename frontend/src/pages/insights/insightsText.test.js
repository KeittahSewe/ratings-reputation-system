import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  columnLabel,
  columnNote,
  jobsNote,
  periodFromSearch,
  ratingNote,
  reputationNote,
  reviewsNote,
  themeBreakdown,
  trendCaption,
  trendTitle,
} from './insightsText.js'

const m = (month, percent, partial = false) => ({ month, partial, percent })

test('the period comes from the address, and anything else falls back to 6 months', () => {
  assert.equal(periodFromSearch('3m'), '3m')
  assert.equal(periodFromSearch(null), '6m')
  assert.equal(periodFromSearch('12m'), '6m')
})

test('the chart heading names its months, with both years across the new year', () => {
  assert.equal(trendTitle(['2026-03', '2026-04', '2026-08']), 'Sentiment trend, March to August 2026')
  assert.equal(trendTitle(['2025-12', '2026-01', '2026-02']), 'Sentiment trend, December 2025 to February 2026')
})

test('summary notes count what was added in the period and what is pending', () => {
  assert.equal(reviewsNote({ count: 41, at_period_start: 8, pending: 0 }, '6m'), '33 in the last 6 months')
  assert.equal(reviewsNote({ count: 14, at_period_start: 4, pending: 1 }, '3m'), '10 in the last 3 months, 1 waiting for classification')
  assert.equal(jobsNote({ count: 41, at_period_start: 8 }, '6m'), '33 in the last 6 months')
})

test('the rating note compares the shown one-decimal values', () => {
  assert.equal(ratingNote({ value: 4.88, at_period_start: 4.71 }, '6m'), 'Up from 4.7 six months ago')
  assert.equal(ratingNote({ value: 4.5, at_period_start: 4.75 }, '3m'), 'Down from 4.8 three months ago')
  assert.equal(ratingNote({ value: 4.66, at_period_start: 4.74 }, '6m'), 'Same as six months ago')
  assert.equal(ratingNote({ value: 4.5, at_period_start: null }, '6m'), 'No ratings before six months ago')
})

test('the reputation note lists the three components', () => {
  assert.equal(
    reputationNote({ ratings_component: 4.9, sentiment_component: 4.41, history_component: 5 }),
    'Ratings 4.9, sentiment 4.4, job history 5.0',
  )
})

test('the caption compares the first and last months with reviews', () => {
  const months = [m('2026-03', { negative: 10 }), m('2026-04', null), m('2026-08', { negative: 4 }, true)]
  assert.match(trendCaption(months), /Negative share has fallen from 10 percent in March to 4 percent in August\.$/)
  assert.equal(trendCaption([m('2026-03', { negative: 10 }), m('2026-04', null)]), "Each column shows the share of that month's reviews in each class.")
})

test('an empty month is a labelled gap and the current month says so far', () => {
  assert.equal(columnNote(m('2026-04', null)), 'No reviews')
  assert.equal(columnNote(m('2026-03', { negative: 10 })), '10% negative')
  assert.equal(columnLabel(m('2026-08', {}, true)), 'Aug, so far')
})

test('a theme lists its classes and the negative ones that still gave four or five stars', () => {
  const t = { counts: { positive: 2, neutral: 1, negative: 4 }, negative_with_4_or_5_stars: 2 }
  assert.equal(themeBreakdown(t), 'Positive in 2, neutral in 1, negative in 4. 2 of the 4 negative mentions still gave four or five stars')
  assert.equal(themeBreakdown({ counts: { positive: 6, neutral: 0, negative: 0 }, negative_with_4_or_5_stars: 0 }), 'Positive in 6')
})
