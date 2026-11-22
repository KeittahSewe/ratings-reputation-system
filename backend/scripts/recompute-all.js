// Recomputes the reputation of every user who has a reputation row, with
// the same code the API runs (src/reputation/recompute.js).
//
// Used once after migration 20261122200000 to fill the sentiment counts on
// existing rows (#84), and by the phase 6 seeding script after it loads data.
// Run from the backend folder: npm run recompute:all
// It reads SUPABASE_URL and SUPABASE_SECRET_KEY from backend/.env.

import { createClient } from '@supabase/supabase-js'
import { createJobsRepo } from '../src/db/jobs.js'
import { createReputationRepo } from '../src/db/reputation.js'
import { createReviewsRepo } from '../src/db/reviews.js'
import { createUsersRepo } from '../src/db/users.js'
import { createReputationService } from '../src/reputation/recompute.js'

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY?.startsWith('sb_secret_')) {
  console.error('Set SUPABASE_URL and SUPABASE_SECRET_KEY (the sb_secret_ key) in backend/.env.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const repos = {
  users: createUsersRepo(supabase),
  reviews: createReviewsRepo(supabase),
  jobs: createJobsRepo(supabase),
  reputation: createReputationRepo(supabase),
}
const scoring = createReputationService(repos)

const ids = await repos.reputation.listUserIds()
console.log(`Recomputing ${ids.length} users.`)
let failed = 0
for (const id of ids) {
  try {
    const row = await scoring.recompute(id)
    const counts = row?.sentiment_counts
    const shown = counts ? `${counts.positive} positive, ${counts.neutral} neutral, ${counts.negative} negative` : 'no counted reviews'
    console.log(`${id}  score ${row?.score ?? '-'}  from ${row?.review_count ?? 0} reviews  (${shown})`)
  } catch (err) {
    failed += 1
    console.error(`${id}  failed: ${err.message}`)
  }
}
console.log(failed === 0 ? 'Done.' : `Done with ${failed} failure(s).`)
process.exit(failed === 0 ? 0 : 1)
