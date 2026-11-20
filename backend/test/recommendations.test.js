import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { holdsSkill, matchScore, rankWorkers, skillMatch } from '../src/recommendations/match.js'
import { computeReputation, oneDecimal } from '../src/reputation/score.js'

// n reviews with the same rating and label.
const times = (n, rating, label) => Array.from({ length: n }, () => ({ rating, label }))

const skill = (skill_name, category) => ({ skill_name, category })

// Figure 4.11: Amina Wanjiru's open job "Rewire reception lighting".
const REWIRE = {
  title: 'Rewire reception lighting',
  category: 'electrical',
  required_skills: ['Electrical wiring', 'Lighting installation'],
}

// The four workers on Figure 4.11, built from raw reviews and jobs so the
// test runs them through the real reputation formula first. Star totals and
// label counts follow the sentiment percentages on each card.
const FIGURE_4_11 = {
  esther: {
    worker: { id: 'e0000000-0000-4000-8000-000000000003', name: 'Esther Njeri' },
    skills: [skill('Electrical wiring', 'electrical'), skill('Lighting installation', 'electrical')],
    // 58 reviews: 284 stars (4.90); 49 positive, 6 neutral, 3 negative (84 / 11 / 5 percent).
    reviews: [...times(49, 5, 'positive'), ...times(3, 5, 'neutral'), ...times(3, 4, 'neutral'), ...times(3, 4, 'negative')],
    completed: 58,
  },
  peter: {
    worker: { id: 'e0000000-0000-4000-8000-000000000002', name: 'Peter Mwangi' },
    skills: [
      skill('Residential plumbing', 'plumbing'),
      skill('Bathroom installation', 'plumbing'),
      skill('Pipe fitting and repair', 'plumbing'),
      skill('Basic electrical wiring', 'electrical'),
    ],
    // 41 reviews: 201 stars (4.90); 32 positive, 6 neutral, 3 negative (78 / 15 / 7 percent).
    reviews: [...times(28, 5, 'positive'), ...times(4, 4, 'positive'), ...times(6, 5, 'neutral'), ...times(3, 5, 'negative')],
    completed: 41,
  },
  samuel: {
    worker: { id: 'e0000000-0000-4000-8000-000000000004', name: 'Samuel Kariuki' },
    skills: [skill('Electrical wiring', 'electrical'), skill('Locksmithing', 'carpentry')],
    // 19 reviews: 79 stars (4.16); 13 positive, 4 neutral, 2 negative (68 / 21 / 11 percent).
    reviews: [...times(8, 5, 'positive'), ...times(5, 4, 'positive'), ...times(2, 4, 'neutral'), ...times(2, 3, 'neutral'), ...times(1, 3, 'negative'), ...times(1, 2, 'negative')],
    completed: 19,
  },
  grace: {
    worker: { id: 'e0000000-0000-4000-8000-000000000005', name: 'Grace Otieno' },
    skills: [skill('Painting', 'painting'), skill('Basic electrical', 'electrical')],
    // 23 reviews: 104 stars (4.52); 17 positive, 4 neutral, 2 negative (74 / 18 / 8 percent).
    reviews: [...times(14, 5, 'positive'), ...times(3, 4, 'positive'), ...times(4, 4, 'neutral'), ...times(1, 4, 'negative'), ...times(1, 2, 'negative')],
    completed: 23,
  },
}

// One worker's candidate entry: their stored reputation from the real formula.
function candidate({ worker, skills, reviews, completed }) {
  const r = computeReputation({ role: 'worker', reviews, completed })
  const reputation = r && { ...r, last_updated: '2026-11-19T00:00:00.000Z' }
  return { worker, skills, reputation, completed_jobs: completed }
}

const AMINA_HIRED = new Set([FIGURE_4_11.peter.worker.id])

describe('holdsSkill', () => {
  for (const [worker, required, expected] of [
    ['Electrical wiring', 'electrical wiring', true],
    ['Basic electrical wiring', 'Electrical wiring', true],
    ['ELECTRICAL WIRING', 'electrical wiring', true],
    ['Basic electrical', 'Electrical wiring', false],
    ['Electrical installation', 'Electrical wiring', false],
    ['Rewiring', 'wiring', false],
    ['Wiring, electrical', 'Electrical wiring', false],
    ['Pipe fitting and repair', 'pipe fitting', true],
    ['Electrical wiring', '  ', false],
  ]) {
    it(`${expected ? 'counts' : 'does not count'} "${worker}" for "${required}"`, () => {
      assert.equal(holdsSkill(worker, required), expected)
    })
  }
})

describe('skillMatch', () => {
  it("counts Peter's Basic electrical wiring for electrical wiring", () => {
    const m = skillMatch(REWIRE, FIGURE_4_11.peter.skills)
    assert.equal(m.value, 0.75)
    assert.deepEqual(m.held, [{ required: 'Electrical wiring', listed_as: 'Basic electrical wiring' }])
    assert.deepEqual(m.missing, ['Lighting installation'])
  })

  it('gives the category half only to a worker who holds none of the required skills', () => {
    assert.equal(skillMatch(REWIRE, FIGURE_4_11.grace.skills).value, 0.5)
  })

  it('gives nothing to a worker with no skill in the category', () => {
    const m = skillMatch(REWIRE, [skill('Painting', 'painting')])
    assert.equal(m.value, 0)
    assert.deepEqual(m.held, [])
  })

  it('ignores a matching skill listed under another category', () => {
    const m = skillMatch(REWIRE, [skill('Painting', 'painting'), skill('Lighting installation', 'carpentry')])
    assert.equal(m.value, 0)
  })

  it('gives the full term to a category skill when the job names no skills', () => {
    assert.equal(skillMatch({ category: 'electrical', required_skills: [] }, FIGURE_4_11.grace.skills).value, 1)
  })
})

describe('matchScore (plan 3.5)', () => {
  it('weights skill 50, reputation 40 and hired before 10 points', () => {
    const { raw, points } = matchScore({ skill: 1, reputationScore: 5, hiredBefore: true })
    assert.deepEqual(points, { skill: 50, reputation: 40, hired_before: 10 })
    assert.equal(raw, 100)
  })

  it('counts no reputation as 0', () => {
    assert.equal(matchScore({ skill: 1, reputationScore: undefined, hiredBefore: false }).raw, 50)
  })
})

describe('Figure 4.11, Rewire reception lighting', () => {
  const cards = rankWorkers(REWIRE, Object.values(FIGURE_4_11).map(candidate), AMINA_HIRED)
  const byName = Object.fromEntries(cards.map((c) => [c.worker.name.split(' ')[0], c]))

  it('ranks Esther, Peter, Samuel, Grace with matches 88, 85, 72 and 61', () => {
    assert.deepEqual(
      cards.map((c) => [c.rank, c.worker.name, c.match]),
      [
        [1, 'Esther Njeri', 88],
        [2, 'Peter Mwangi', 85],
        [3, 'Samuel Kariuki', 72],
        [4, 'Grace Otieno', 61],
      ],
    )
  })

  it('stores the reputations the cards show, under the 18 November job history rule', () => {
    assert.deepEqual(
      cards.map((c) => [c.reputation.score, oneDecimal(c.reputation.score)]),
      [
        [4.8, 4.8],
        [4.72, 4.7],
        [4.33, 4.3],
        [4.53, 4.5],
      ],
    )
    for (const c of cards) assert.equal(c.reputation.history_component, 5)
  })

  it('ranks Grace below Samuel despite her higher reputation, because skill relevance is weighted on its own', () => {
    assert.ok(byName.Grace.reputation.score > byName.Samuel.reputation.score)
    assert.ok(byName.Grace.rank > byName.Samuel.rank)
    assert.equal(byName.Grace.skill_match, 0.5)
    assert.equal(byName.Samuel.skill_match, 0.75)
  })

  it('splits each match into its three parts', () => {
    assert.deepEqual(byName.Peter.match_points, { skill: 37.5, reputation: 37.76, hired_before: 10 })
    assert.equal(byName.Peter.hired_before, true)
    assert.equal(byName.Esther.hired_before, false)
  })

  it('gives every card one explanation sentence per term', () => {
    for (const c of cards) {
      assert.equal(c.explanation.length, 3)
      for (const sentence of c.explanation) assert.ok(sentence.length > 0)
    }
  })

  it('writes the explanations from the terms', () => {
    assert.deepEqual(byName.Esther.explanation, [
      'Esther holds both skills this job needs: Electrical wiring and Lighting installation.',
      'Reputation score 4.8 from 58 reviews.',
      'You have not hired Esther before.',
    ])
    assert.deepEqual(byName.Peter.explanation, [
      'Peter holds 1 of the 2 skills this job needs: Electrical wiring (listed as Basic electrical wiring), not Lighting installation.',
      'Reputation score 4.7 from 41 reviews.',
      'You have hired this worker before.',
    ])
    assert.deepEqual(byName.Samuel.explanation, [
      'Samuel holds 1 of the 2 skills this job needs: Electrical wiring, not Lighting installation.',
      'Reputation score 4.3 from 19 reviews.',
      'You have not hired Samuel before.',
    ])
    assert.deepEqual(byName.Grace.explanation, [
      'Grace lists electrical skills (Basic electrical), but neither of the 2 skills this job needs.',
      'Reputation score 4.5 from 23 reviews.',
      'You have not hired Grace before.',
    ])
  })

  it("lists each card's skills in the job's category first", () => {
    assert.deepEqual(
      byName.Peter.skills.map((s) => s.skill_name),
      ['Basic electrical wiring', 'Bathroom installation', 'Pipe fitting and repair', 'Residential plumbing'],
    )
  })

  it('does not depend on the order the workers arrive in', () => {
    const reversed = rankWorkers(REWIRE, Object.values(FIGURE_4_11).map(candidate).reverse(), AMINA_HIRED)
    assert.deepEqual(
      reversed.map((c) => c.worker.name),
      cards.map((c) => c.worker.name),
    )
  })
})

describe('cold start and ties', () => {
  const daniel = { id: 'e0000000-0000-4000-8000-000000000006', name: 'Daniel Kiprop' }
  const faith = { id: 'e0000000-0000-4000-8000-000000000007', name: 'Faith Chebet' }

  it('lists a worker with no reviews after every scored worker, even with a higher match', () => {
    const newcomer = { worker: daniel, skills: FIGURE_4_11.esther.skills, reputation: null, completed_jobs: 0 }
    const weak = candidate({ ...FIGURE_4_11.grace, worker: faith, skills: [skill('Painting', 'painting')] })
    const cards = rankWorkers(REWIRE, [newcomer, weak], AMINA_HIRED)
    assert.equal(cards[0].worker.name, 'Faith Chebet')
    assert.ok(cards[0].match < cards[1].match) // 36 against 50
    assert.equal(cards[1].reputation, null)
    assert.equal(cards[1].match, 50)
    assert.equal(
      cards[1].explanation[1],
      'No reviews yet, so reputation adds nothing and Daniel is listed after every worker with a score.',
    )
  })

  it('ranks a Provisional worker on their score and says it is Provisional', () => {
    // Peter's live numbers on 19 November: one review counted, score 3.30.
    const live = {
      worker: FIGURE_4_11.peter.worker,
      skills: FIGURE_4_11.peter.skills,
      reputation: { score: 3.3, review_count: 1, provisional: true },
      completed_jobs: 1,
    }
    const [card] = rankWorkers(REWIRE, [live], AMINA_HIRED)
    assert.equal(card.match, 74) // 37.5 + 26.4 + 10 = 73.9
    assert.equal(card.explanation[1], 'Reputation score 3.3, Provisional because it rests on 1 review.')
  })

  it('uses the stored two-decimal score, so two workers both shown as 4.4 still rank apart', () => {
    const a = { worker: daniel, skills: FIGURE_4_11.grace.skills, reputation: { score: 4.36, review_count: 9 }, completed_jobs: 9 }
    const b = { worker: faith, skills: FIGURE_4_11.grace.skills, reputation: { score: 4.44, review_count: 9 }, completed_jobs: 9 }
    const cards = rankWorkers(REWIRE, [a, b])
    assert.deepEqual(
      cards.map((c) => [c.worker.name, c.match]),
      [
        ['Faith Chebet', 61], // 25 + 35.52 = 60.52
        ['Daniel Kiprop', 60], // 25 + 34.88 = 59.88
      ],
    )
  })

  it('breaks an exact tie on completed jobs, then name', () => {
    const rep = { score: 4.5, review_count: 9 }
    const cards = rankWorkers(REWIRE, [
      { worker: faith, skills: [], reputation: rep, completed_jobs: 9 },
      { worker: daniel, skills: [], reputation: rep, completed_jobs: 9 },
      { worker: { id: 'e0000000-0000-4000-8000-000000000008', name: 'Joseph Njoroge' }, skills: [], reputation: rep, completed_jobs: 12 },
    ])
    assert.deepEqual(
      cards.map((c) => c.worker.name),
      ['Joseph Njoroge', 'Daniel Kiprop', 'Faith Chebet'],
    )
  })

  it('returns an empty list when no worker is available', () => {
    assert.deepEqual(rankWorkers(REWIRE, []), [])
  })
})
