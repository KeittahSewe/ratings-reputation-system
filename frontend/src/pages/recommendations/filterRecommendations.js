import { oneDecimal } from '../../lib/format.js'

export const MIN_SCORE_OPTIONS = [
  { value: '3', label: '3.0 and above' },
  { value: '4', label: '4.0 and above' },
  { value: '4.5', label: '4.5 and above' },
]

export const SKILL_OPTIONS = [
  { value: 'some', label: 'Holds at least one required skill' },
  { value: 'all', label: 'Holds every required skill' },
]

// Narrows the engine's ranking in the browser. It never reorders: ranks stay
// the engine's, so a filtered list can show ranks 1, 3, 4. The score test
// uses the one-decimal score the card shows, so "4.5 and above" keeps a
// worker whose card says 4.5. skill_match is 0.5 for a category skill and
// none of the required ones, more than 0.5 once one is held, 1 when all are.
export function filterRecommendations(recs, { minScore, skill }) {
  return recs.filter((rec) => {
    if (minScore && (!rec.reputation || oneDecimal(rec.reputation.score) < Number(minScore))) return false
    if (skill === 'some' && !(rec.skill_match > 0.5)) return false
    if (skill === 'all' && rec.skill_match !== 1) return false
    return true
  })
}
