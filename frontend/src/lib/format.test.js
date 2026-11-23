import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDate, formatMonthYear, formatShortDate, formatScore, formatStored, percentages, plural } from './format.js'

test('scores show one decimal, rounded half up like the API', () => {
  assert.equal(formatScore(4.72), '4.7')
  assert.equal(formatScore(4), '4.0')
  assert.equal(formatScore(4.25), '4.3')
  assert.equal(formatScore(3.93), '3.9')
  assert.equal(formatStored(4.4), '4.40')
})

test("Peter's 32 / 6 / 3 gives the 78 / 15 / 7 of Figure 4.8", () => {
  assert.deepEqual(percentages({ positive: 32, neutral: 6, negative: 3 }), { positive: 78, neutral: 15, negative: 7 })
})

test('percentages always add up to 100, and nothing to divide gives null', () => {
  const p = percentages({ positive: 1, neutral: 1, negative: 1 })
  assert.equal(p.positive + p.neutral + p.negative, 100)
  assert.deepEqual(percentages({ positive: 2, neutral: 1, negative: 0 }), { positive: 67, neutral: 33, negative: 0 })
  assert.equal(percentages({ positive: 0, neutral: 0, negative: 0 }), null)
})

test('dates are written out in Nairobi time', () => {
  assert.equal(formatDate('2026-08-18T09:00:00Z'), '18 August 2026')
  // 22:30 UTC on 31 December is already 1 January in Nairobi.
  assert.equal(formatMonthYear('2024-12-31T22:30:00Z'), 'January 2025')
})

test('plural', () => {
  assert.equal(plural(1, 'review'), '1 review')
  assert.equal(plural(41, 'review'), '41 reviews')
})

test('short dates as in the job table, never Sept', () => {
  assert.equal(formatShortDate('2026-09-01T08:00:00Z'), '01 Sep 2026')
  assert.equal(formatShortDate('2026-08-11T22:30:00Z'), '12 Aug 2026')
})
