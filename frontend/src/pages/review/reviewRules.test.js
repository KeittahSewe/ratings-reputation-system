import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateReview } from './reviewRules.js'

test('a rating and a few words pass', () => {
  assert.deepEqual(validateReview({ rating: 3, text: 'Good work, late start.' }), {})
})

test('no rating, and text with no letters or numbers, are refused', () => {
  const errors = validateReview({ rating: 0, text: '  !!! ...  ' })
  assert.deepEqual(Object.keys(errors).sort(), ['rating', 'text'])
})

test('the figure limit of 1000 characters', () => {
  assert.ok(validateReview({ rating: 5, text: 'a'.repeat(1001) }).text)
  assert.deepEqual(validateReview({ rating: 5, text: 'a'.repeat(1000) }), {})
})
