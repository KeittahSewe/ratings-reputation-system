import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSkills } from './skills.js'

test('splits on commas, tidies spaces, drops blanks and repeats', () => {
  assert.deepEqual(parseSkills(' Electrical  wiring, lighting installation,, ELECTRICAL WIRING '), [
    'Electrical wiring',
    'lighting installation',
  ])
  assert.deepEqual(parseSkills(''), [])
})
