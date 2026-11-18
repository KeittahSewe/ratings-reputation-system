// The reputation score from plan 3.4, with the job history rule from the
// change log of 18 November. Every function here is pure, so the worked
// examples in the plan can be checked by unit tests without a database.
//
//   score = 0.4 R + 0.4 S + 0.2 H, every part on a 0 to 5 scale
//   R  mean star rating of the reviews counted
//   S  mean of the sentiment labels mapped positive 5, neutral 3, negative 1,
//      with one neutral review added while fewer than three reviews count
//   H  worker: 5 x min(1, completed / 10)
//      client: 5 x max(0, 1 - 2 x cancelled / (completed + cancelled)) x min(1, completed / 10),
//      where cancelled counts only jobs the client cancelled after assigning a worker

export const WEIGHTS = { ratings: 0.4, sentiment: 0.4, history: 0.2 }
export const SENTIMENT_VALUES = { positive: 5, neutral: 3, negative: 1 }

// Below this many counted reviews the score is Provisional and S carries the
// neutral prior, so one glowing review cannot produce a perfect 5.0.
export const PROVISIONAL_BELOW = 3
const PRIOR = SENTIMENT_VALUES.neutral

// Completed jobs needed for full history credit.
export const FULL_HISTORY_JOBS = 10

// Rounds half up. Multiplying first can leave 4.725 as 472.49999999999994,
// so the product is cut to 12 significant digits before rounding.
function roundTo(value, places) {
  const factor = 10 ** places
  return Math.round(Number((value * factor).toPrecision(12))) / factor
}

// Stored values have two decimals.
export const twoDecimals = (value) => roundTo(value, 2)

// Screens show one decimal of the stored value.
export const oneDecimal = (value) => roundTo(value, 1)

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function checkCount(value, name) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a whole number of 0 or more.`)
}

export function ratingsComponent(ratings) {
  if (ratings.length === 0) throw new TypeError('ratingsComponent needs at least one rating.')
  for (const r of ratings) {
    if (!Number.isInteger(r) || r < 1 || r > 5) throw new TypeError(`A rating must be 1 to 5, not ${r}.`)
  }
  return mean(ratings)
}

export function sentimentComponent(labels) {
  if (labels.length === 0) throw new TypeError('sentimentComponent needs at least one label.')
  const values = labels.map((label) => {
    if (!(label in SENTIMENT_VALUES)) throw new TypeError(`Unknown sentiment label: ${label}.`)
    return SENTIMENT_VALUES[label]
  })
  if (values.length < PROVISIONAL_BELOW) values.push(PRIOR)
  return mean(values)
}

// cancelled is ignored for workers: they cannot cancel, and a client's
// cancellation is not the worker's fault.
export function historyComponent({ role, completed, cancelled = 0 }) {
  checkCount(completed, 'completed')
  checkCount(cancelled, 'cancelled')
  const volume = Math.min(1, completed / FULL_HISTORY_JOBS)
  if (role === 'worker') return 5 * volume
  if (role !== 'client') throw new TypeError(`role must be 'client' or 'worker', not ${role}.`)
  const closed = completed + cancelled
  const reliability = closed === 0 ? 0 : Math.max(0, 1 - (2 * cancelled) / closed)
  return 5 * reliability * volume
}

// Turns a user's jobs into the two counts H needs. jobs: rows with status and
// assigned_at, where the user is the worker (role worker) or the client.
// A client's cancellation counts only if a worker had been assigned;
// cancelling an open job costs nothing.
export function historyCounts(role, jobs) {
  const completed = jobs.filter((j) => j.status === 'completed').length
  const cancelled =
    role === 'client' ? jobs.filter((j) => j.status === 'cancelled' && j.assigned_at !== null).length : 0
  return { completed, cancelled }
}

// reviews: [{ rating, label }], the reviews that count (visible and
// classified). Returns null when none count, because R and S do not exist
// yet; the user then has no reputation row.
//
// The score is built from the components after they are rounded to two
// decimals, so anyone can reproduce the stored score from the stored
// breakdown, which is the point of showing it (literature gap 1).
export function computeReputation({ role, reviews, completed, cancelled = 0 }) {
  if (reviews.length === 0) return null
  const ratings = twoDecimals(ratingsComponent(reviews.map((r) => r.rating)))
  const sentiment = twoDecimals(sentimentComponent(reviews.map((r) => r.label)))
  const history = twoDecimals(historyComponent({ role, completed, cancelled }))
  const score = twoDecimals(WEIGHTS.ratings * ratings + WEIGHTS.sentiment * sentiment + WEIGHTS.history * history)
  return {
    score,
    ratings_component: ratings,
    sentiment_component: sentiment,
    history_component: history,
    review_count: reviews.length,
    provisional: reviews.length < PROVISIONAL_BELOW,
  }
}
