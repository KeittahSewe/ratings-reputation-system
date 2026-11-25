// Example ranking shown on the landing page: ranks 1 and 2 of Figure 4.11,
// with the same numbers as the Figure 4.11 fixture (src/dev/fixtures.jsx),
// which only exists in development. Peter has been hired by this client
// before and Esther has not, yet Esther ranks first on skill match, which is
// the point the landing page makes about how workers are chosen.
const skill = (id, skill_name, category) => ({ id, skill_name, category })
const rep = (score, ratings, sentiment, history, counts) => ({
  score,
  ratings_component: ratings,
  sentiment_component: sentiment,
  history_component: history,
  review_count: counts.positive + counts.neutral + counts.negative,
  provisional: false,
  sentiment_counts: counts,
})

export const EXAMPLE_JOB = 'Rewire reception lighting'

export const EXAMPLE_RECOMMENDATIONS = [
  {
    rank: 1,
    worker: { id: 'example-esther', name: 'Esther Njeri' },
    skills: [skill('e1', 'Electrical wiring', 'electrical'), skill('e2', 'Lighting installation', 'electrical')],
    completed_jobs: 58,
    reputation: rep(4.8, 4.9, 4.59, 5, { positive: 49, neutral: 6, negative: 3 }),
    match: 88,
    explanation: [
      'Esther holds both skills this job needs: Electrical wiring and Lighting installation.',
      'Reputation score 4.8 from 58 reviews.',
      'You have not hired Esther before.',
    ],
  },
  {
    rank: 2,
    worker: { id: 'example-peter', name: 'Peter Mwangi' },
    skills: [
      skill('p4', 'Basic electrical wiring', 'electrical'),
      skill('p2', 'Bathroom installation', 'plumbing'),
      skill('p3', 'Pipe fitting and repair', 'plumbing'),
      skill('p1', 'Residential plumbing', 'plumbing'),
    ],
    completed_jobs: 41,
    reputation: rep(4.72, 4.9, 4.41, 5, { positive: 32, neutral: 6, negative: 3 }),
    match: 85,
    explanation: [
      'Peter holds 1 of the 2 skills this job needs: Electrical wiring (listed as Basic electrical wiring), not Lighting installation.',
      'Reputation score 4.7 from 41 reviews.',
      'You have hired this worker before.',
    ],
  },
]

// The two weightings, as in backend/src/recommendations/match.js and
// backend/src/reputation/score.js.
export const MATCH_WEIGHTS = [
  { label: 'Skill match with the job', weight: 50 },
  { label: 'Reputation score', weight: 40 },
  { label: 'Hired by this client before', weight: 10 },
]

export const REPUTATION_WEIGHTS = [
  { label: 'Star ratings', weight: 40 },
  { label: 'Review sentiment, read by the model', weight: 40 },
  { label: 'Job history', weight: 20 },
]
