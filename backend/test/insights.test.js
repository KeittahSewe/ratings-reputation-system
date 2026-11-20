import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildInsights } from '../src/insights/build.js'
import { buildGuidance, GUIDANCE_NOTE } from '../src/insights/guidance.js'
import { LEXICON, lexiconFor } from '../src/insights/lexicon.js'
import { monthKey, monthName, periodMonths } from '../src/insights/months.js'
import { dominantLabel, percentages, reviewThemes, summariseThemes, themesInSentence } from '../src/insights/themes.js'
import { containsPhrase } from '../src/text/phrases.js'

const MODEL = 'distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8'
const worker = LEXICON.worker
const client = LEXICON.client
const s = (text, label) => ({ text, label, confidence: 0.9 })

describe('containsPhrase', () => {
  const cases = [
    ['He arrived on time', 'on time', true],
    ['ON TIME and tidy', 'on time', true],
    ['he has been late lately', 'late', true],
    ['he has been busy lately', 'late', false],
    ["He didn't reply for two days", "didn't reply", true],
    ['He didn’t reply', "didn't reply", true], // a curly apostrophe splits the same way
    ['Paid through M-Pesa', 'm-pesa', true],
    ['time on', 'on time', false],
    ['anything', '', false],
  ]
  for (const [text, phrase, expected] of cases) {
    it(`${expected ? 'finds' : 'does not find'} "${phrase}" in "${text}"`, () => {
      assert.equal(containsPhrase(text, phrase), expected)
    })
  }
})

describe('the lexicon', () => {
  it('has the six worker themes from plan C1 and four client themes from the labelling guideline', () => {
    assert.deepEqual(worker.map((t) => t.key), ['punctuality', 'tidiness', 'communication', 'quality', 'pricing', 'advance_notice'])
    assert.deepEqual(client.map((t) => t.key), ['payment', 'instructions', 'communication', 'scope'])
  })

  it('gives every theme a name, triggers and advice for both polarities', () => {
    for (const theme of [...worker, ...client]) {
      assert.ok(theme.name && theme.triggers.length > 0, theme.key)
      assert.ok(theme.advice.negative && theme.advice.positive, theme.key)
      assert.equal(theme.triggerWords.length, theme.triggers.length)
    }
  })

  it('refuses an unknown role', () => {
    assert.throws(() => lexiconFor('admin'), TypeError)
  })
})

describe('themesInSentence', () => {
  it('marks a theme on a whole-phrase trigger, ignoring capitals', () => {
    assert.deepEqual(themesInSentence('He ARRIVED on time.', worker), ['punctuality'])
    assert.deepEqual(themesInSentence('The quote was fair.', worker), ['pricing'])
  })

  it('does not mark a theme on part of a word', () => {
    assert.deepEqual(themesInSentence('He has been busy lately.', worker), [])
    assert.deepEqual(themesInSentence('A cleaner finish than expected.', worker), [])
  })

  it('lets one sentence mark two themes', () => {
    assert.deepEqual(themesInSentence('He rescheduled twice and arrived late.', worker), ['punctuality', 'advance_notice'])
  })

  it('has no negation list: "did not reply" and "replied" are both communication', () => {
    assert.deepEqual(themesInSentence('He did not reply to my messages.', worker), ['communication'])
    assert.deepEqual(themesInSentence('He replied within the hour.', worker), ['communication'])
  })

  it('uses the client lexicon for reviews of clients', () => {
    assert.deepEqual(themesInSentence('Paid the balance through M-Pesa the same day.', client), ['payment'])
    assert.deepEqual(themesInSentence('The instructions were unclear.', client), ['instructions'])
    assert.deepEqual(themesInSentence('She changed her mind halfway.', client), ['scope'])
    assert.deepEqual(themesInSentence('He arrived on time.', client), [])
  })
})

describe('reviewThemes', () => {
  it('counts a theme once per review however many sentences mention it', () => {
    const themes = reviewThemes([s('He arrived on time.', 'positive'), s('He was early the next day too.', 'positive')], worker)
    assert.deepEqual([...themes], [['punctuality', 'positive']])
  })

  it('takes the sentence label, so the model decides polarity', () => {
    assert.deepEqual([...reviewThemes([s('He did not reply to my messages.', 'negative')], worker)], [['communication', 'negative']])
    assert.deepEqual([...reviewThemes([s('He replied within the hour.', 'positive')], worker)], [['communication', 'positive']])
  })

  it('reads praise and complaint on the same theme as neutral', () => {
    const themes = reviewThemes([s('He arrived on time on Monday.', 'positive'), s('He arrived late on Tuesday.', 'negative')], worker)
    assert.equal(themes.get('punctuality'), 'neutral')
  })

  it('lets a positive or negative sentence outweigh a neutral one', () => {
    assert.equal(reviewThemes([s('He arrived at nine.', 'neutral'), s('Always on time.', 'positive')], worker).get('punctuality'), 'positive')
    assert.equal(reviewThemes([s('He arrived at nine.', 'neutral'), s('He was late.', 'negative')], worker).get('punctuality'), 'negative')
    assert.equal(reviewThemes([s('He arrived at nine.', 'neutral')], worker).get('punctuality'), 'neutral')
  })

  it('skips sentences that are malformed', () => {
    assert.equal(reviewThemes([{ text: 'on time' }, { label: 'positive' }, null], worker).size, 0)
    assert.equal(reviewThemes(undefined, worker).size, 0)
  })
})

describe('dominantLabel and percentages', () => {
  it('names the label with most reviews, or mixed when the top two are level', () => {
    assert.equal(dominantLabel({ positive: 5, neutral: 1, negative: 2 }), 'positive')
    assert.equal(dominantLabel({ positive: 2, neutral: 1, negative: 2 }), 'mixed')
    assert.equal(dominantLabel({ positive: 0, neutral: 0, negative: 0 }), null)
  })

  it('gives whole-number shares that add up to 100', () => {
    assert.deepEqual(percentages({ positive: 1, neutral: 1, negative: 1 }), { positive: 34, neutral: 33, negative: 33 })
    assert.deepEqual(percentages({ positive: 3, neutral: 1, negative: 2 }), { positive: 50, neutral: 17, negative: 33 })
    assert.deepEqual(percentages({ positive: 7, neutral: 0, negative: 0 }), { positive: 100, neutral: 0, negative: 0 })
  })

  it('gives null rather than zeros for an empty month', () => {
    assert.equal(percentages({ positive: 0, neutral: 0, negative: 0 }), null)
  })
})

describe('periodMonths', () => {
  it('gives the current Nairobi month and the five before it for 6m', () => {
    const months = periodMonths('6m', new Date('2026-11-20T19:10:00Z'))
    assert.deepEqual(months.map((m) => m.month), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    assert.deepEqual(months.map((m) => m.partial), [false, false, false, false, false, true])
    assert.equal(months[0].start.toISOString(), '2026-05-31T21:00:00.000Z') // midnight 1 June in Nairobi
    assert.equal(months[5].end.toISOString(), '2026-11-30T21:00:00.000Z')
  })

  it('crosses a year for 3m in January', () => {
    assert.deepEqual(periodMonths('3m', new Date('2027-01-05T08:00:00Z')).map((m) => m.month), ['2026-11', '2026-12', '2027-01'])
  })

  it('uses Nairobi time, not UTC, at the month boundary', () => {
    assert.equal(monthKey('2026-05-31T20:59:59Z'), '2026-05')
    assert.equal(monthKey('2026-05-31T21:00:00Z'), '2026-06')
    // 23:30 UTC on 31 October is already 1 November in Nairobi.
    assert.deepEqual(periodMonths('3m', new Date('2026-10-31T23:30:00Z')).map((m) => m.month), ['2026-09', '2026-10', '2026-11'])
  })

  it('refuses any other period', () => {
    assert.throws(() => periodMonths('1y'), TypeError)
    assert.throws(() => periodMonths('toString'), TypeError)
  })

  it('names months in full', () => {
    assert.equal(monthName('2026-03'), 'March 2026')
  })
})

// Figure 4.12's themes, built from 41 raw reviews of Peter Mwangi between
// March and August 2026, the figure's period. The figure's chart cannot be
// built from 41 reviews (its shares need at least 204), so only the themes
// and the guidance are reproduced here.
//
//   index    0-5 March, 6-12 April, 13-19 May, 20-26 June, 27-33 July, 34-40 August
//   labels   negative 0, 1, 6; neutral 2, 7, 13, 20, 27, 34; the other 32 positive
//   ratings  four stars on 5, 12, 32, 33; five stars on the rest (201 / 41 = 4.90)
//   themes   punctuality 0-26, tidiness 10-28, communication 20-33,
//            advance notice 32-40 (negative sentences)
const FIGURE_NOW = new Date('2026-08-20T09:00:00Z')
const MONTH_STARTS = [0, 6, 13, 20, 27, 34]

function figureReviews() {
  const negative = new Set([0, 1, 6])
  const neutral = new Set([2, 7, 13, 20, 27, 34])
  const fourStars = new Set([5, 12, 32, 33])
  const reviews = []
  for (let i = 0; i < 41; i++) {
    const monthIndex = MONTH_STARTS.findLastIndex((start) => i >= start)
    const sentences = []
    if (i <= 26) sentences.push(s('He arrived on time.', 'positive'))
    if (i >= 10 && i <= 28) sentences.push(s('He left the site clean.', 'positive'))
    if (i >= 20 && i <= 33) sentences.push(s('He explained the problem before starting.', 'positive'))
    if (i >= 32) sentences.push(s('He rescheduled without telling me.', 'negative'))
    sentences.push(s('The job was fixing a kitchen sink.', 'neutral'))
    reviews.push({
      job_id: `job-${i}`,
      rating: fourStars.has(i) ? 4 : 5,
      created_at: `2026-${String(3 + monthIndex).padStart(2, '0')}-15T09:00:00Z`,
      sentiment: {
        label: negative.has(i) ? 'negative' : neutral.has(i) ? 'neutral' : 'positive',
        model_version: MODEL,
        sentences,
      },
    })
  }
  return reviews
}

function figureInsights() {
  const received = figureReviews()
  return buildInsights({
    role: 'worker',
    period: '6m',
    now: FIGURE_NOW,
    received,
    answeredJobIds: new Set(received.map((r) => r.job_id)),
    history: received.map((r) => ({ status: 'completed', completed_at: r.created_at })),
    reputation: null,
  })
}

describe('buildInsights, Figure 4.12', () => {
  it('returns the four themes with counts out of 41 reviews', () => {
    const { themes } = figureInsights()
    assert.deepEqual(
      themes.map((t) => [t.key, t.reviews, t.of, t.sentiment]),
      [
        ['punctuality', 27, 41, 'positive'],
        ['tidiness', 19, 41, 'positive'],
        ['communication', 14, 41, 'positive'],
        ['advance_notice', 9, 41, 'negative'],
      ],
    )
  })

  it('sends each theme its counts by label, the four- and five-star negatives and a trend by month', () => {
    const notice = figureInsights().themes.find((t) => t.key === 'advance_notice')
    assert.deepEqual(notice.counts, { positive: 0, neutral: 0, negative: 9 })
    // An average of 4.90 over 41 reviews leaves room for only four reviews
    // under five stars, so all nine still gave four or five.
    assert.equal(notice.negative_with_4_or_5_stars, 9)
    assert.deepEqual(notice.by_month, [0, 0, 0, 0, 2, 7])
    assert.equal(notice.name, 'Advance notice of delays')

    const punctuality = figureInsights().themes.find((t) => t.key === 'punctuality')
    assert.deepEqual(punctuality.by_month, [6, 7, 7, 7, 0, 0])
  })

  it('fills the guidance from those counts', () => {
    const { guidance, guidance_note } = figureInsights()
    assert.deepEqual(guidance, [
      {
        kind: 'theme_negative',
        theme: 'advance_notice',
        title: 'Tell clients about a delay as soon as you know about it.',
        detail: 'Advance notice of delays comes up negative in 9 of your 41 reviews. All 9 of those reviews still gave you four or five stars.',
      },
      {
        kind: 'theme_positive',
        theme: 'punctuality',
        title: 'Mention punctuality in your profile bio, because a client reading your profile sees only your score.',
        detail: 'Punctuality and arriving on time is your strongest theme, positive in 27 of your 41 reviews.',
      },
      {
        kind: 'trend',
        theme: null,
        title: 'Keep doing what you have been doing.',
        detail: 'Your negative share went from 33 percent in March 2026 to 0 percent in August 2026.',
      },
    ])
    assert.equal(guidance_note, GUIDANCE_NOTE)
  })

  it('builds the monthly composition with counts and shares', () => {
    const { sentiment_by_month: months, period } = figureInsights()
    assert.deepEqual(period, {
      key: '6m',
      time_zone: 'Africa/Nairobi',
      from: '2026-02-28T21:00:00.000Z',
      months: ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'],
    })
    assert.deepEqual(months[0], {
      month: '2026-03',
      partial: false,
      total: 6,
      counts: { positive: 3, neutral: 1, negative: 2 },
      percent: { positive: 50, neutral: 17, negative: 33 },
    })
    assert.equal(months[5].partial, true)
    assert.deepEqual(months.map((m) => m.total), [6, 7, 7, 7, 7, 7])
  })

  it('fills the summary cards', () => {
    const { summary, model_versions } = figureInsights()
    assert.deepEqual(summary.reviews, { count: 41, at_period_start: 0, pending: 0 })
    assert.deepEqual(summary.average_rating, { value: 4.9, at_period_start: null })
    assert.deepEqual(summary.jobs_completed, { count: 41, at_period_start: 0 })
    assert.deepEqual(model_versions, [MODEL])
  })
})

// Peter received four reviews. Only two count.
describe('buildInsights, which reviews count', () => {
  const now = new Date('2026-11-20T19:00:00Z')
  const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
  const received = [
    // The pair is complete: visible.
    { job_id: 'answered', rating: 5, created_at: daysAgo(3), sentiment: { label: 'positive', model_version: MODEL, sentences: [s('He arrived on time.', 'positive')] } },
    // Peter has not reviewed back and only 2 days have passed: hidden.
    { job_id: 'hidden', rating: 1, created_at: daysAgo(2), sentiment: { label: 'negative', model_version: 'hidden-model', sentences: [s('He rescheduled without telling me.', 'negative'), s('He arrived late.', 'negative')] } },
    // Not answered, but 15 days old: visible.
    { job_id: 'old', rating: 4, created_at: daysAgo(15), sentiment: { label: 'neutral', model_version: MODEL, sentences: [s('He arrived at nine.', 'neutral')] } },
    // Visible but not classified yet: pending.
    { job_id: 'pending', rating: 3, created_at: daysAgo(1), sentiment: null },
  ]
  const result = () =>
    buildInsights({
      role: 'worker',
      period: '6m',
      now,
      received,
      answeredJobIds: new Set(['answered', 'pending']),
      history: [],
      reputation: null,
    })

  it('leaves a hidden review out of every count, column and theme', () => {
    const insights = result()
    assert.deepEqual(insights.summary.reviews, { count: 2, at_period_start: 0, pending: 1 })
    assert.equal(insights.summary.average_rating.value, 4.5)
    assert.deepEqual(insights.sentiment_by_month.at(-1).counts, { positive: 1, neutral: 1, negative: 0 })
    assert.deepEqual(insights.themes.map((t) => [t.key, t.reviews, t.of, t.sentiment, t.counts.negative]), [['punctuality', 2, 2, 'mixed', 0]])
    assert.deepEqual(insights.model_versions, [MODEL])
    assert.doesNotMatch(JSON.stringify(insights), /rescheduled|hidden-model|advance_notice/)
  })

  it('never sends review or sentence text', () => {
    assert.doesNotMatch(JSON.stringify(result()), /arrived/)
  })
})

describe('buildInsights, the period', () => {
  it('counts older reviews in the cards but not in the chart or themes', () => {
    const now = new Date('2026-11-20T19:00:00Z')
    const insights = buildInsights({
      role: 'worker',
      period: '3m',
      now,
      received: [
        { job_id: 'a', rating: 3, created_at: '2026-08-31T20:00:00Z', sentiment: { label: 'negative', model_version: MODEL, sentences: [s('He was late.', 'negative')] } },
        { job_id: 'b', rating: 5, created_at: '2026-08-31T21:30:00Z', sentiment: { label: 'positive', model_version: MODEL, sentences: [s('He was early.', 'positive')] } },
      ],
      answeredJobIds: new Set(['a', 'b']),
      history: [
        { status: 'completed', completed_at: '2026-08-30T10:00:00Z' },
        { status: 'completed', completed_at: '2026-10-02T10:00:00Z' },
        { status: 'cancelled', completed_at: null },
      ],
      reputation: { score: 4.2 },
    })
    // 20:00 UTC on 31 August is still August in Nairobi; 21:30 UTC is 1 September.
    assert.deepEqual(insights.period.months, ['2026-09', '2026-10', '2026-11'])
    assert.deepEqual(insights.summary.reviews, { count: 2, at_period_start: 1, pending: 0 })
    assert.deepEqual(insights.summary.average_rating, { value: 4, at_period_start: 3 })
    assert.deepEqual(insights.summary.jobs_completed, { count: 2, at_period_start: 1 })
    assert.deepEqual(insights.summary.reputation, { score: 4.2 })
    assert.deepEqual(insights.sentiment_by_month.map((m) => m.total), [1, 0, 0])
    assert.deepEqual(insights.themes.map((t) => [t.key, t.of, t.sentiment, t.by_month]), [['punctuality', 1, 'positive', [1, 0, 0]]])
  })
})

describe('buildInsights, empty and client', () => {
  it('gives a worker with no reviews an empty dashboard rather than an error', () => {
    const insights = buildInsights({ role: 'worker', period: '6m', now: new Date('2026-11-20T19:00:00Z'), received: [], answeredJobIds: new Set(), history: [], reputation: null })
    assert.deepEqual(insights.summary.reviews, { count: 0, at_period_start: 0, pending: 0 })
    assert.deepEqual(insights.summary.average_rating, { value: null, at_period_start: null })
    assert.ok(insights.sentiment_by_month.every((m) => m.total === 0 && m.percent === null))
    assert.deepEqual(insights.themes, [])
    assert.deepEqual(insights.guidance, [])
    assert.deepEqual(insights.model_versions, [])
  })

  it('uses the client lexicon for a client', () => {
    const insights = buildInsights({
      role: 'client',
      period: '6m',
      now: new Date('2026-11-20T19:00:00Z'),
      received: [{ job_id: 'k', rating: 4, created_at: '2026-11-18T20:00:00Z', sentiment: { label: 'positive', model_version: MODEL, sentences: [s('Paid on time through M-Pesa.', 'positive')] } }],
      answeredJobIds: new Set(['k']),
      history: [],
      reputation: null,
    })
    assert.equal(insights.role, 'client')
    assert.deepEqual(insights.themes.map((t) => [t.key, t.name]), [['payment', 'Paying as agreed']])
  })
})

describe('buildGuidance thresholds', () => {
  const months = ['2026-10', '2026-11']
  const review = (sentences, rating = 5) => ({ rating, month: '2026-11', sentences })
  const late = s('He arrived late.', 'negative')
  const onTime = s('He arrived on time.', 'positive')
  const emptyMonths = months.map((month) => ({ month, total: 0, percent: null }))

  it('needs three negative mentions before a theme gets advice', () => {
    const two = summariseThemes([review([late]), review([late])], worker, months)
    assert.deepEqual(buildGuidance(two, emptyMonths, worker), [])
    const three = summariseThemes([review([late], 2), review([late], 1), review([late], 4)], worker, months)
    const [item] = buildGuidance(three, emptyMonths, worker)
    assert.equal(item.kind, 'theme_negative')
    assert.equal(item.detail, 'Punctuality and arriving on time comes up negative in 3 of your 3 reviews. 1 of those 3 still gave you four or five stars.')
  })

  it('leaves out the star sentence when no negative review gave four or five stars', () => {
    const themes = summariseThemes([review([late], 2), review([late], 1), review([late], 3)], worker, months)
    assert.equal(buildGuidance(themes, emptyMonths, worker)[0].detail, 'Punctuality and arriving on time comes up negative in 3 of your 3 reviews.')
  })

  it('gives no advice for a mixed theme', () => {
    const themes = summariseThemes([review([late]), review([late]), review([late]), review([onTime]), review([onTime]), review([onTime])], worker, months)
    assert.equal(themes[0].sentiment, 'mixed')
    assert.deepEqual(buildGuidance(themes, emptyMonths, worker), [])
  })

  it('needs two months with at least three reviews each for a trend', () => {
    const oneMonth = [
      { month: '2026-10', total: 2, percent: { positive: 50, neutral: 0, negative: 50 } },
      { month: '2026-11', total: 4, percent: { positive: 100, neutral: 0, negative: 0 } },
    ]
    assert.deepEqual(buildGuidance([], oneMonth, worker), [])
    const twoMonths = [
      { month: '2026-10', total: 3, percent: { positive: 67, neutral: 0, negative: 33 } },
      { month: '2026-11', total: 4, percent: { positive: 25, neutral: 0, negative: 75 } },
    ]
    assert.deepEqual(buildGuidance([], twoMonths, worker), [
      {
        kind: 'trend',
        theme: null,
        title: 'Look back at your November 2026 reviews for what changed.',
        detail: 'Your negative share went from 33 percent in October 2026 to 75 percent in November 2026.',
      },
    ])
  })

  it('stops at three items, negative themes first', () => {
    const many = summariseThemes(
      [0, 1, 2, 3].map(() => review([late, s('Left a mess.', 'negative'), s('Overcharged me.', 'negative'), s('Never replied.', 'negative')])),
      worker,
      months,
    )
    const items = buildGuidance(many, emptyMonths, worker)
    assert.equal(items.length, 3)
    assert.ok(items.every((i) => i.kind === 'theme_negative'))
  })
})
