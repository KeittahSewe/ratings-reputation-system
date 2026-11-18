import { createClient } from '@supabase/supabase-js'
import { createApp } from './app.js'
import { createTokenVerifier, remoteKeySet, supabaseIssuer } from './auth/tokens.js'
import { createJobsRepo } from './db/jobs.js'
import { createReputationRepo } from './db/reputation.js'
import { createReviewsRepo } from './db/reviews.js'
import { createSkillsRepo } from './db/skills.js'
import { createUsersRepo } from './db/users.js'
import { createReputationService } from './reputation/recompute.js'

const { SUPABASE_URL, SUPABASE_SECRET_KEY } = process.env
const port = process.env.PORT || 3000

// Refuse to start on missing or wrong keys, rather than failing on the first
// request. A publishable key here would make every query fail with
// "permission denied", which is hard to trace back to the cause.
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Startup failed: set SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example).')
  process.exit(1)
}
if (!SUPABASE_SECRET_KEY.startsWith('sb_secret_')) {
  console.error('Startup failed: SUPABASE_SECRET_KEY must be the secret key, starting sb_secret_.')
  process.exit(1)
}

// The secret key acts as service_role. Nothing about a user session is
// stored, because each request brings its own token.
const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const issuer = supabaseIssuer(SUPABASE_URL)
const repos = {
  users: createUsersRepo(supabase),
  skills: createSkillsRepo(supabase),
  reputation: createReputationRepo(supabase),
  reviews: createReviewsRepo(supabase),
  jobs: createJobsRepo(supabase),
}
const app = createApp({
  verifyToken: createTokenVerifier({ issuer, keySet: remoteKeySet(issuer) }),
  ...repos,
  scoring: createReputationService(repos),
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})
