// GET /api/me/insights responses for the Figure 4.12 fixtures, worked through
// the API's own rules (backend/src/insights) so they could have come from it.
// Figure 4.12 shows 41 of 41 reviews inside the period and "Up from 4.7",
// which cannot both hold: a rating six months ago needs reviews before the
// period. Here 8 of Peter's 41 reviews come before March, so the period holds
// 33, and the chart is drawn from whole counts.

import { percentages } from '../lib/format.js'

const MODEL = 'distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8'

function month(key, positive, neutral, negative, partial = false) {
  const counts = { positive, neutral, negative }
  return { month: key, partial, total: positive + neutral + negative, counts, percent: percentages(counts) }
}

function theme(key, name, of, [positive, neutral, negative], sentiment, negativeWith45, byMonth) {
  return {
    key,
    name,
    reviews: positive + neutral + negative,
    of,
    sentiment,
    counts: { positive, neutral, negative },
    negative_with_4_or_5_stars: negativeWith45,
    by_month: byMonth,
  }
}

const NOTE = 'Each suggestion comes from a theme or from your sentiment trend above. Nothing here affects your score.'

const PETER_MONTHS = [
  month('2026-03', 3, 1, 1),
  month('2026-04', 3, 1, 1),
  month('2026-05', 4, 1, 1),
  month('2026-06', 4, 1, 0),
  month('2026-07', 5, 1, 0),
  month('2026-08', 6, 0, 0, true),
]

export const PETER_INSIGHTS = {
  role: 'worker',
  period: {
    key: '6m',
    time_zone: 'Africa/Nairobi',
    from: '2026-02-28T21:00:00.000Z',
    months: PETER_MONTHS.map((m) => m.month),
  },
  summary: {
    reputation: {
      score: 4.72,
      ratings_component: 4.9,
      sentiment_component: 4.41,
      history_component: 5,
      review_count: 41,
      provisional: false,
      sentiment_counts: { positive: 32, neutral: 6, negative: 3 },
    },
    reviews: { count: 41, at_period_start: 8, pending: 0 },
    average_rating: { value: 4.88, at_period_start: 4.71 },
    jobs_completed: { count: 41, at_period_start: 8 },
  },
  sentiment_by_month: PETER_MONTHS,
  themes: [
    theme('punctuality', 'Punctuality and arriving on time', 33, [19, 1, 1], 'positive', 1, [3, 3, 3, 3, 4, 5]),
    theme('tidiness', 'Tidiness and clearing up afterwards', 33, [14, 1, 0], 'positive', 0, [2, 2, 3, 2, 3, 3]),
    theme('communication', 'Communication and explaining the work', 33, [10, 1, 0], 'positive', 0, [1, 2, 2, 2, 2, 2]),
    theme('advance_notice', 'Advance notice of delays', 33, [2, 1, 4], 'negative', 2, [2, 2, 1, 1, 1, 0]),
  ],
  guidance: [
    {
      kind: 'theme_negative',
      theme: 'advance_notice',
      title: 'Tell clients about a delay as soon as you know about it.',
      detail: 'Advance notice of delays comes up negative in 4 of your 33 reviews. 2 of those 4 still gave you four or five stars.',
    },
    {
      kind: 'theme_positive',
      theme: 'punctuality',
      title: 'Mention punctuality in your profile bio, because a client reading your profile sees only your score.',
      detail: 'Punctuality and arriving on time is your strongest theme, positive in 19 of your 33 reviews.',
    },
    {
      kind: 'trend',
      theme: null,
      title: 'Keep doing what you have been doing.',
      detail: 'Your negative share went from 20 percent in March 2026 to 0 percent in August 2026.',
    },
  ],
  guidance_note: NOTE,
  model_versions: [MODEL],
}

// Amina over 3 months: 10 of her 14 reviews in the period, one theme mixed
// and one negative.
const AMINA_MONTHS = [month('2026-06', 2, 1, 0), month('2026-07', 3, 0, 1), month('2026-08', 3, 0, 0, true)]

export const AMINA_INSIGHTS = {
  role: 'client',
  period: {
    key: '3m',
    time_zone: 'Africa/Nairobi',
    from: '2026-05-31T21:00:00.000Z',
    months: AMINA_MONTHS.map((m) => m.month),
  },
  summary: {
    reputation: {
      score: 4.56,
      ratings_component: 4.7,
      sentiment_component: 4.4,
      history_component: 4.6,
      review_count: 14,
      provisional: false,
      sentiment_counts: { positive: 11, neutral: 2, negative: 1 },
    },
    reviews: { count: 14, at_period_start: 4, pending: 1 },
    average_rating: { value: 4.7, at_period_start: 4.7 },
    jobs_completed: { count: 14, at_period_start: 4 },
  },
  sentiment_by_month: AMINA_MONTHS,
  themes: [
    theme('payment', 'Paying as agreed', 10, [6, 0, 0], 'positive', 0, [2, 2, 2]),
    theme('instructions', 'Clear instructions', 10, [4, 1, 0], 'positive', 0, [1, 2, 2]),
    theme('communication', 'Communication and being reachable', 10, [2, 0, 2], 'mixed', 1, [1, 2, 1]),
    theme('scope', 'Changing the job halfway', 10, [0, 0, 3], 'negative', 2, [1, 1, 1]),
  ],
  guidance: [
    {
      kind: 'theme_negative',
      theme: 'scope',
      title: 'Agree any extra work and its price with the worker before you ask for it.',
      detail: 'Changing the job halfway comes up negative in 3 of your 10 reviews. 2 of those 3 still gave you four or five stars.',
    },
    {
      kind: 'theme_positive',
      theme: 'payment',
      title: 'Keep paying on the day the work is done, because workers mention it.',
      detail: 'Paying as agreed is your strongest theme, positive in 6 of your 10 reviews.',
    },
  ],
  guidance_note: NOTE,
  model_versions: [MODEL],
}

// Esther: no review counted yet.
export const EMPTY_INSIGHTS = {
  role: 'worker',
  period: { key: '6m', time_zone: 'Africa/Nairobi', from: '2026-02-28T21:00:00.000Z', months: PETER_MONTHS.map((m) => m.month) },
  summary: {
    reputation: null,
    reviews: { count: 0, at_period_start: 0, pending: 0 },
    average_rating: { value: null, at_period_start: null },
    jobs_completed: { count: 0, at_period_start: 0 },
  },
  sentiment_by_month: PETER_MONTHS.map((m) => month(m.month, 0, 0, 0, m.partial)),
  themes: [],
  guidance: [],
  guidance_note: NOTE,
  model_versions: [],
}
