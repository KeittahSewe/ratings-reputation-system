import { createClient } from '@supabase/supabase-js'
import { createApp } from './app.js'
import { createTokenVerifier, remoteKeySet, supabaseIssuer } from './auth/tokens.js'
import { createJobsRepo } from './db/jobs.js'
import { createReputationRepo } from './db/reputation.js'
import { createReviewsRepo } from './db/reviews.js'
import { createSkillsRepo } from './db/skills.js'
import { createUsersRepo } from './db/users.js'
import { createInferenceClient } from './inference/client.js'
import { createReputationService } from './reputation/recompute.js'
import { createClassificationService } from './reviews/classification.js'

const { SUPABASE_URL, SUPABASE_SECRET_KEY, INFERENCE_URL, INFERENCE_SERVICE_KEY } = process.env
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
// Without these every review would be saved as pending and never classified.
if (!INFERENCE_URL || !INFERENCE_SERVICE_KEY) {
  console.error('Startup failed: set INFERENCE_URL and INFERENCE_SERVICE_KEY (see .env.example).')
  process.exit(1)
}
try {
  new URL(INFERENCE_URL)
} catch {
  console.error(`Startup failed: INFERENCE_URL is not a URL: ${INFERENCE_URL}`)
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
const scoring = createReputationService(repos)
const classification = createClassificationService({
  reviews: repos.reviews,
  inference: createInferenceClient({ url: INFERENCE_URL, serviceKey: INFERENCE_SERVICE_KEY }),
  scoring,
})
const app = createApp({
  verifyToken: createTokenVerifier({ issuer, keySet: remoteKeySet(issuer) }),
  ...repos,
  scoring,
  classification,
})

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
  // Retries reviews left pending because the inference service was down:
  // once now, then every minute.
  classification.start()
})
