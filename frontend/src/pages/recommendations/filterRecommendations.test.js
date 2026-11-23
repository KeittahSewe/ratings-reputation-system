import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterRecommendations } from './filterRecommendations.js'

const rec = (rank, score, skillMatch) => ({ rank, reputation: score === null ? null : { score }, skill_match: skillMatch })
// Figure 4.11 under the real formulas: Esther, Peter, Samuel, Grace, and a
// worker with no reviews.
const RECS = [rec(1, 4.8, 1), rec(2, 4.72, 0.75), rec(3, 4.33, 0.75), rec(4, 4.53, 0.5), rec(5, null, 1)]

test('no filter keeps everyone in engine order', () => {
  assert.deepEqual(filterRecommendations(RECS, { minScore: '', skill: '' }).map((r) => r.rank), [1, 2, 3, 4, 5])
})

test('minimum score uses the shown one-decimal score and drops the unscored', () => {
  assert.deepEqual(filterRecommendations(RECS, { minScore: '4.5', skill: '' }).map((r) => r.rank), [1, 2, 4])
})

test('skill match: at least one, then every required skill', () => {
  assert.deepEqual(filterRecommendations(RECS, { minScore: '', skill: 'some' }).map((r) => r.rank), [1, 2, 3, 5])
  assert.deepEqual(filterRecommendations(RECS, { minScore: '', skill: 'all' }).map((r) => r.rank), [1, 5])
})
