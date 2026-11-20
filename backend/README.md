# backend

Node.js and Express.js REST API. Handles auth checks, jobs, reviews, reputation scoring and recommendations against Supabase. Deployed on Render.

## Requirements

- Node.js 26 and npm 11

## Install

From the `backend` folder:

```powershell
npm install
```

## Environment variables

Copy the example file and fill in real values:

```powershell
Copy-Item .env.example .env
```

| Variable | What it is |
|---|---|
| `PORT` | Port the API listens on. Defaults to 3000. |
| `SUPABASE_URL` | URL of the Supabase project |
| `SUPABASE_SECRET_KEY` | Secret key, starting `sb_secret_`. It acts as `service_role`, which bypasses row level security, so it stays on the server only. The API refuses to start without it. |
| `INFERENCE_URL` | Base URL of the FastAPI inference service, such as `http://localhost:8000`. The API refuses to start without it. |
| `INFERENCE_SERVICE_KEY` | Shared key the API sends in the `X-Service-Key` header. It must equal the inference service's own `INFERENCE_SERVICE_KEY`. The API refuses to start without it. |
| `CORS_ORIGIN` | Frontend URL allowed to call the API |

No JWT secret is needed: access tokens are checked against the project's public keys (see Authentication).

Never commit `.env`. The variables are loaded with Node's built-in `--env-file-if-exists` flag, so no extra package is needed. If `.env` is missing, Node starts anyway and uses whatever is set in the environment, which is how Render provides them.

## Run

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and restarts it whenever a file changes |
| `npm start` | Starts the API once, as on Render |
| `npm test` | Runs the tests in `test/` with Node's built-in test runner. They need no network and no Supabase project. |

Check that it is running:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

This returns `{ "status": "ok" }`.

## Code layout

| File | What it does |
|---|---|
| `src/app.js` | `createApp()` builds the Express app: JSON parsing, routes, 404 handler and error handler |
| `src/server.js` | Checks the environment, creates the Supabase client and token checker, and starts listening on `PORT` |
| `src/errors.js` | `ApiError`, thrown by routes and middleware for any error the API means to send, and `validationError` for 400s |
| `src/ids.js` | The UUID check used before any id reaches the database |
| `src/categories.js` | The six service categories, matching the database CHECK constraints |
| `src/auth/tokens.js` | Checks a Supabase access token against the project's public keys |
| `src/auth/authenticate.js` | Middleware that requires `Authorization: Bearer <token>` and sets `req.auth` |
| `src/auth/requireUser.js` | `requireUser` loads the caller's `users` row into `req.user`; `requireRole` lets one role through |
| `src/db/users.js` | Every query on `public.users` |
| `src/db/skills.js` | Every query on `public.skills` |
| `src/db/reputation.js` | Reads and writes `public.reputation_scores`, adding `provisional` on the way out |
| `src/db/reviews.js` | Every query on `public.reviews` and `public.sentiment_results` |
| `src/db/jobs.js` | Every query on `public.jobs`, including the conditional update behind each status change |
| `src/jobs/status.js` | The five job actions with their roles and statuses, and the timeline steps |
| `src/jobs/access.js` | Who may see a job, and who its two parties are |
| `src/inference/client.js` | Calls `POST /classify` on the inference service with a 5 second timeout and two retries |
| `src/reviews/classification.js` | Classifies a review on submit, stores the result, and retries pending reviews every minute |
| `src/reputation/score.js` | The reputation formula from plan 3.4: R, S, H and the 40/40/20 score, with no database access |
| `src/reputation/recompute.js` | Reads a user's counted reviews and finished jobs, computes the score and stores it |
| `src/reviews/visibility.js` | When a review becomes visible: the pair is complete, or 14 days have passed |
| `src/recommendations/match.js` | The match score from plan 3.5, the skill rule, the ranking order and each card's explanation, with no database access |
| `src/text/phrases.js` | Whole-phrase matching ignoring capitals, shared by the skill rule and the theme lexicon |
| `src/insights/lexicon.js` | The worker and client themes, their triggers and the fixed advice for each polarity |
| `src/insights/months.js` | Calendar months in Africa/Nairobi for the 3m and 6m periods |
| `src/insights/themes.js` | Finds themes in sentences, decides each review's sentiment per theme, and counts them |
| `src/insights/guidance.js` | Picks up to three suggestions and fills their fixed text with the counts |
| `src/insights/build.js` | Builds the whole insights response from rows already read, with no database access |
| `src/routes/me.js` | `POST /api/me/bootstrap`, `GET /api/me`, `PATCH /api/me` |
| `src/routes/users.js` | `GET /api/users/:id` |
| `src/routes/skills.js` | `GET`, `POST /api/me/skills` and `DELETE /api/me/skills/:id` |
| `src/routes/jobs.js` | Job create, list, available, detail, and the five status changes |
| `src/routes/reviews.js` | `POST` and `GET /api/jobs/:id/reviews` |
| `src/routes/recommendations.js` | `GET /api/jobs/:id/recommendations` |
| `src/routes/insights.js` | `GET /api/me/insights` |

`createApp()` takes the token checker, the data access, the reputation service and the classification service as arguments, so tests pass in fakes and import the app without starting a server.

## Errors

Every error response uses the same format:

```json
{ "error": { "code": "not_found", "message": "No route for GET /api/unknown" } }
```

| Status | Code | When |
|---|---|---|
| 400 | `invalid_json` | The body is not valid JSON |
| 400 | `validation_failed` | A field is missing or out of range; the message names it |
| 401 | `missing_token` | No `Authorization: Bearer <token>` header |
| 401 | `invalid_token` | Bad signature, wrong project, wrong audience, anonymous user or not a token |
| 401 | `token_expired` | The access token has expired; the frontend refreshes it or signs in again |
| 403 | `not_bootstrapped` | The account has no `users` row yet; call `POST /api/me/bootstrap` first |
| 403 | `wrong_role` | The route is for the other role, such as a client calling a skills route |
| 404 | `not_found` | No route matches (with a valid token; without one, `/api` routes answer 401 first), or the user or skill does not exist |
| 409 | `email_in_use` | Bootstrap found another account with the same email |
| 409 | `skill_exists` | The worker already lists this skill, ignoring capitals |
| 409 | `job_not_completed` | A review was sent for a job that is not completed |
| 409 | `already_reviewed` | The caller has already reviewed this job |
| 409 | `job_not_open` | Recommendations were asked for a job that is not open |
| 413 | `body_too_large` | The body is over 100 kB |
| 500 | `internal_error` | Anything unexpected; details go to the server log only |
| 503 | `auth_unavailable` | The project's public keys could not be fetched |

## Database

The schema lives in `supabase/migrations/` as SQL files and is applied to the hosted Supabase project with the Supabase CLI, installed here as a dev dependency.

| Command | What it does |
|---|---|
| `npx supabase login` | Signs the CLI in to your Supabase account, once per laptop |
| `npx supabase link --project-ref <ref>` | Points the CLI at the hosted project, once per laptop |
| `npx supabase migration new <name>` | Creates an empty, timestamped migration file |
| `npx supabase db push --remote --dry-run` | Lists migrations not yet applied to the hosted project |
| `npx supabase db push --remote` | Applies them |

Without `--remote` the CLI targets a local Docker database, which this project does not use.

| Migration | What it does |
|---|---|
| `20261116180836_create_core_tables.sql` | Creates the six tables with row level security on and no policies. Only `service_role` has table privileges. |
| `20261116200000_lock_browser_roles.sql` | Makes anything a later migration creates in `public` start closed to `anon` and `authenticated`, and stops the push if any table has RLS off or grants anything to those roles. |
| `20261118160000_add_job_timeline.sql` | Adds `assigned_at`, `accepted_at` and `cancelled_at` to `jobs` for the Figure 4.9 timeline, each tied to the job's status by a CHECK. |
| `20261118200000_add_reputation_review_count.sql` | Adds `review_count` to `reputation_scores`: how many reviews the stored score was built from. |

The browser never queries a table. The publishable key is used only for Supabase Auth sign-up and sign-in, and every read and write goes through this API as `service_role`, which bypasses row level security. So there are no RLS policies: `anon` and `authenticated` hold no privileges on any table, and RLS stays on with no policies so that a privilege granted by mistake still exposes no rows. Supabase's security advisor reports "RLS enabled, no policy" on all six tables; that is intended.

Two rules follow for later work:

- Create tables only through migrations, never in the dashboard Table Editor. Dashboard tables are created by `supabase_admin`, whose default grants to the browser roles cannot be changed.
- A migration that adds a table must `grant select, insert, update, delete ... to service_role` itself, and one that adds a function Express calls through `rpc()` must `grant execute ... to service_role`.

## Authentication

Supabase Auth handles sign-up, sign-in and passwords. The frontend sends the user's access token on every request as `Authorization: Bearer <token>`. `src/auth/tokens.js` checks it with `jose` against the public keys Supabase publishes at `<SUPABASE_URL>/auth/v1/.well-known/jwks.json`. It checks the signature (ES256 or RS256 only), the issuer `<SUPABASE_URL>/auth/v1`, the audience `authenticated` and the expiry, and rejects anonymous users. Keys are fetched once and cached, so a request costs no call to Supabase.

A token stays valid until it expires (one hour by default), even after the user signs out.

### POST /api/me/bootstrap

Creates the `users` row for a signed-in account. The frontend calls it after every sign-in.

Body: `{ "name": "Peter Mwangi", "role": "worker" }`, or for a client `{ "name": "Amina Wanjiru", "role": "client", "company_name": "Wanjiru Interiors Ltd" }`. `company_name` is optional and for clients only.

- `auth_id` and `email` come from the verified token, never from the body.
- New workers start with `availability` true; clients have none.
- The first call returns 201 with `{ "user": { ... } }`. Later calls return 200 with the existing row and ignore the body, so a role cannot be changed this way.
- `auth_id` is never returned.

## Profile and skills

Every route here needs the caller's `users` row, so an account that has not bootstrapped gets 403 `not_bootstrapped`.

### GET /api/me

Returns `{ "user": {...}, "skills": [...], "reputation": {...} }`.

- `skills` is the worker's list, sorted by name, each `{ id, skill_name, category }`. It is always `[]` for clients.
- `reputation` is `{ score, ratings_component, sentiment_component, history_component, last_updated }`, or `null` until the user's first review has been classified.

### PATCH /api/me

Send only the fields to change. Returns `{ "user": {...} }`.

| Field | Who | Rule |
|---|---|---|
| `name` | both | 1 to 100 characters after trimming |
| `bio` | both | Up to 1000 characters; blank or `null` clears it |
| `availability` | workers | `true` or `false` |
| `company_name` | clients | Up to 120 characters; blank or `null` clears it |

Any other field, including `email` and `role`, is rejected with 400. Email belongs to Supabase Auth, and role is fixed at bootstrap.

### /api/me/skills (workers only)

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/me/skills` | none | 200 `{ "skills": [...] }` |
| POST | `/api/me/skills` | `{ "skill_name": "Pipe fitting and repair", "category": "plumbing" }` | 201 `{ "skill": {...} }` |
| DELETE | `/api/me/skills/:id` | none | 204 |

- `skill_name` is trimmed, runs of spaces become one, and it must be 1 to 60 characters.
- `category` is one of plumbing, painting, electrical, carpentry, cleaning or tutoring.
- A skill that matches one already listed, ignoring capitals, gets 409 `skill_exists`.
- Deleting another worker's skill gets the same 404 as a skill that does not exist.
- Clients get 403 `wrong_role` on all three.

### GET /api/users/:id

Another user's public profile, for any signed-in user with a `users` row. Returns:

```json
{
  "user": { "id", "name", "role", "company_name", "bio", "availability", "created_at" },
  "skills": [...],
  "reputation": { ... } or null,
  "review_count": 2,
  "reviews": [
    {
      "id", "rating", "review_text", "created_at",
      "reviewer": { "id", "name", "role" },
      "job": { "id", "title" },
      "sentiment": { "label", "confidence_score" } or null
    }
  ]
}
```

- `email` is never included; users see their own through `GET /api/me`.
- `reviews` holds the 10 newest visible reviews the user has received. `review_count` counts all visible ones.
- A review is visible once the person reviewed has also reviewed the same job, or 14 days after it was submitted, whichever comes first. Until then it is left out of both fields.
- `sentiment` is `null` while a review is waiting for classification.
- `reputation` is described under Reputation score below.
- An unknown or malformed id gets 404.

## Jobs

Every route here needs the caller's `users` row.

### Statuses

| Action | Who | From | To | Sets |
|---|---|---|---|---|
| `POST /api/jobs/:id/assign` | the job's client | open | assigned | `worker_id`, `assigned_at` |
| `POST /api/jobs/:id/accept` | the assigned worker | assigned | in_progress | `accepted_at` |
| `POST /api/jobs/:id/submit` | the assigned worker | in_progress | in_progress | `submitted_at` |
| `POST /api/jobs/:id/complete` | the job's client | in_progress, once submitted | completed | `completed_at` |
| `POST /api/jobs/:id/cancel` | the job's client | open or assigned | cancelled | `cancelled_at` |

Each returns 200 with the job as `GET /api/jobs/:id` gives it. Checks run in this order:

1. 404 `not_found` if the job does not exist or the caller cannot see it.
2. 403 `wrong_role` if the caller has the other role.
3. 403 `not_your_job` if the caller can see the job but is not its client or worker, such as a worker trying to accept an open job.
4. 400 `validation_failed` for a bad body. Assign takes `{ "worker_id": "<uuid>" }`, which must be a worker account.
5. 409 for the status rules: `invalid_transition` for a move plan 3.1 does not allow, `already_submitted` for a second submit, `not_submitted` for completing before the worker submits, and `worker_unavailable` for assigning a worker whose availability is off.

The update only applies if the job is still in the status that was read, so two requests racing on one job cannot both succeed. The loser gets 409 `job_changed`.

A job cancelled while assigned keeps its worker, so it stays in that worker's history.

Completing or cancelling a job recomputes the reputation of both parties, because their job history may have changed. The status change is saved first, so if a recompute fails it is logged and the request still returns 200.

### POST /api/jobs (clients)

Body: `{ "title", "description", "category", "required_skills": [...] }`. Title 1 to 120 characters, description 1 to 4000, category one of the six, and up to 10 required skills of 1 to 60 characters each. Skill names are cleaned the same way as profile skills, and repeats that differ only in capitals are dropped. Returns 201 `{ "job": {...} }` with status `open`.

### GET /api/jobs

A client gets their own jobs; a worker gets the jobs assigned to them, including cancelled ones. Newest first. Optional query: `status`, `category`, and `q` to search titles.

### GET /api/jobs/available (workers)

Every open job, newest first. Optional query: `category` and `q`.

### GET /api/jobs/:id

Visible to the job's client, its worker, and any worker while the job is open. Returns the job's columns plus:

```json
{
  "client": { "id", "name", "company_name" },
  "worker": { "id", "name" } or null,
  "timeline": [
    { "step": "posted", "at": "..." },
    { "step": "assigned", "at": "..." or null },
    { "step": "accepted", "at": null },
    { "step": "submitted", "at": null },
    { "step": "completed", "at": null }
  ]
}
```

A cancelled job has a sixth step, `cancelled`.

## Reviews

After a job is completed, its client and its worker review each other once. Every review is classified by the inference service (plan 3.6), and the result goes in `sentiment_results` with the model version that produced it.

### POST /api/jobs/:id/reviews

Body: `{ "rating": 5, "review_text": "Peter was punctual and professional. I would hire him again." }`. The reviewee is the other party on the job.

Checks run in this order:

1. 404 `not_found` if the job does not exist or the caller cannot see it.
2. 403 `not_your_job` if the caller can see the job but is not its client or worker.
3. 400 `validation_failed`: `rating` must be a whole number from 1 to 5, and `review_text` 1 to 5000 characters after trimming with at least one letter or number outside HTML tags. Text with none would be empty after the inference service cleans it, and could never be classified.
4. 409 `job_not_completed` unless the job is completed.
5. 409 `already_reviewed` if the caller has reviewed this job before. A review cannot be changed.

Then:

1. The review is saved with `pending_classification` true.
2. If the other party reviewed this job first, the caller's reputation is recomputed, because the review they received has just become visible.
3. The API calls `POST /classify` with `sentences: true`, a 5 second timeout per attempt and two retries, half a second and then one second apart. Unreachable, timed out, 5xx and 429 answers are retried; any other 4xx is not.
4. On success, the label, confidence, model version and per-sentence results are stored in `sentiment_results`, the pending flag is cleared, and the reviewee's reputation is recomputed.
5. If every attempt fails, the review stays saved as pending with no `sentiment_results` row, and the retry below picks it up.

Returns 201 `{ "review": {...} }` either way:

```json
{
  "id", "job_id", "reviewer_id", "reviewee_id", "rating", "review_text",
  "pending_classification": false,
  "created_at": "...",
  "sentiment": { "label", "confidence_score", "model_version", "analyzed_at" } or null
}
```

`sentiment` is `null` and `pending_classification` is true when the classifier could not be reached. If the inference service does not answer, the request takes up to about 16 seconds; if it refuses the connection, as a stopped local service does, it answers within a few seconds.

### GET /api/jobs/:id/reviews

For the job's client and worker only. Returns both sides from the caller's point of view:

```json
{
  "job_id": "...",
  "can_review": true,
  "written": { ...the caller's own review, as above } or null,
  "received": { "status": "none" }
}
```

`received` is one of:

| `status` | Meaning |
|---|---|
| `none` | The other party has not reviewed this job |
| `hidden` | They have, but the caller has not reviewed yet. `visible_at` says when it shows anyway (14 days after it was written). Its text, rating and sentiment are not sent. |
| `visible` | The caller has reviewed too, or 14 days have passed. `review` holds it. |

`can_review` is true when the job is completed and the caller has not reviewed it.

### Classification retry

`src/server.js` starts a timer when the API starts listening. It runs once at startup and then every minute:

- It takes up to 20 reviews still pending, oldest first, leaving out any younger than 30 seconds, whose own submit request may still be classifying them.
- Each gets one attempt. On success it is stored and the reviewee recomputed, as on submit.
- The first failure that means the service is down (unreachable, timeout, 5xx, 401) ends the tick, so a stopped classifier gets one call a minute. A 422 for one text is logged and skipped.
- Each tick that finds pending reviews logs one line, such as `Classification retry: 1 of 1 pending reviews classified.`

On Render's free tier the first call after the inference service has slept wakes it, which takes longer than 5 seconds. That review stays pending and the next tick, a minute later, classifies it.

Writing `sentiment_results` and clearing the flag are two requests, because supabase-js cannot run a transaction. If a sentiment row already exists for the review, it is kept and the flag is cleared, so a crash between the two writes or two attempts racing on one review leaves one row.

## Reputation score

Plan 3.4, with the job history rule from the change log of 18 November. The code is in `src/reputation/score.js`.

| Part | Weight | How it is worked out |
|---|---|---|
| R, ratings | 40% | Mean star rating of the reviews counted |
| S, sentiment | 40% | Mean of the labels mapped positive 5, neutral 3, negative 1. While fewer than three reviews count, one neutral review is added. Confidence is not used. |
| H, job history, worker | 20% | 5 x min(1, completed / 10). Workers cannot cancel, so no cancellation counts against them. |
| H, job history, client | 20% | 5 x max(0, 1 - 2 x cancelled / (completed + cancelled)) x min(1, completed / 10), where cancelled counts only jobs cancelled after a worker was assigned. Cancelling an open job costs nothing. |

Each part is stored to two decimals, and the score is 0.4 R + 0.4 S + 0.2 H worked out from those stored parts, so the breakdown on screen always reproduces the score. Screens show one decimal.

Which reviews count: only reviews that are visible (see `GET /api/users/:id`) and classified. A hidden review that moved the score would give itself away, because the reviewee could work out its stars from the change in R.

A user has no `reputation_scores` row, and `reputation` is `null`, until at least one review counts. After that, `reputation` is:

```json
{
  "score": 4.72,
  "ratings_component": 4.9,
  "sentiment_component": 4.41,
  "history_component": 5,
  "review_count": 41,
  "provisional": false,
  "last_updated": "..."
}
```

`provisional` is true while `review_count` is under three. It is worked out from `review_count` when the row is read, not stored.

A score is recomputed:

- for both parties, when a job is completed or cancelled;
- for the reviewee, when their review is classified, on submit or by the retry;
- for the reviewer, when their review completes the pair, because the review they received earlier has just become visible.

A review that becomes visible because 14 days passed has no request to trigger a recompute; the sweep for that comes with #53, on the same one-minute timer as the classification retry.

Worked example, Peter Mwangi: 41 reviews counted, ratings 201 / 41 = 4.90, labels 32 positive, 6 neutral and 3 negative giving 181 / 41 = 4.41, and 41 completed jobs giving H = 5.00. Score 0.4 x 4.90 + 0.4 x 4.41 + 0.2 x 5.00 = 4.724, stored 4.72 and shown 4.7. `test/reputation.test.js` checks this.

## Recommendations

### GET /api/jobs/:id/recommendations (clients)

Ranks the workers available now for one of the caller's open jobs, as on Figure 4.11. Rankings are worked out on every request and never stored.

Checks run in this order:

1. 403 `wrong_role` for a worker.
2. 404 `not_found` if the job does not exist or is another client's.
3. 409 `job_not_open` unless the job is open.

Every worker whose availability is on is ranked, including workers with no skill in the job's category. The match follows plan 3.5:

```
match = 100 x (0.5 x skill + 0.4 x reputation / 5 + 0.1 x hired_before)
```

| Term | Points | How it is worked out |
|---|---|---|
| skill | up to 50 | 0 if the worker lists no skill in the job's category. Otherwise 0.5 + 0.5 x (required skills held / required skills on the job), or 1 when the job names no required skills. |
| reputation | up to 40 | The stored two-decimal score, so 4.72 and not the 4.7 on screen. A worker with no reputation row scores 0 here. |
| hired_before | 0 or 10 | 10 if the caller has a completed job with this worker. A cancelled job is not a hire. |

A worker holds a required skill when one of their skills in the job's category contains it as a whole phrase, ignoring capitals. "Basic electrical wiring" holds "electrical wiring". "Basic electrical", "Electrical installation" and "Rewiring" do not. A matching skill listed under another category does not count.

Order: workers with a reputation row come first, then workers with none (plan 3.4's cold-start rule), whatever their match. Within each group the order is by unrounded match, then stored score, then completed jobs, then name. A Provisional worker ranks on their score like anyone else, because the neutral prior already stops one review from producing a high score. The match is shown as a whole number, rounded half up.

Returns 200:

```json
{
  "job": { "id", "title", "category", "required_skills": [...] },
  "total": 31,
  "recommendations": [
    {
      "rank": 2,
      "worker": { "id", "name": "Peter Mwangi" },
      "skills": [{ "id", "skill_name", "category" }, ...],
      "completed_jobs": 41,
      "reputation": { ...as GET /api/users/:id gives it } or null,
      "match": 85,
      "match_points": { "skill": 37.5, "reputation": 37.76, "hired_before": 10 },
      "skill_match": 0.75,
      "skills_held": [{ "required": "Electrical wiring", "listed_as": "Basic electrical wiring" }],
      "skills_missing": ["Lighting installation"],
      "hired_before": true,
      "explanation": [
        "Peter holds 1 of the 2 skills this job needs: Electrical wiring (listed as Basic electrical wiring), not Lighting installation.",
        "Reputation score 4.7 from 41 reviews.",
        "You have hired this worker before."
      ]
    }
  ],
  "disclosure": "Ranked by the recommendation engine from skill match, reputation score and whether you have hired the worker before. It is not a paid placement and no worker can pay to appear higher."
}
```

Each card's skills list its skills in the job's category first. `explanation` always holds three sentences, one per term, in the order of the table above. A worker with no reviews gets "No reviews yet, so reputation adds nothing and Daniel is listed after every worker with a score." A Provisional one gets, for example, "Reputation score 3.3, Provisional because it rests on 1 review."

The route makes five queries whatever the number of workers: the available workers, then their skills, reputation rows and completed job counts, and the caller's past hires. The counts query returns one row per completed job, which stays under Supabase's default limit of 1,000 rows for the phase 6 dataset of about 250 completed jobs.

Worked example, Figure 4.11, "Rewire reception lighting" (electrical; requires Electrical wiring and Lighting installation), for Amina Wanjiru:

| Rank | Worker | Skill | Reputation | Hired before | Match |
|---|---|---|---|---|---|
| 1 | Esther Njeri | 1.0 = 50 | 4.80 = 38.40 | no | 88 |
| 2 | Peter Mwangi | 0.75 = 37.5 | 4.72 = 37.76 | yes = 10 | 85 |
| 3 | Samuel Kariuki | 0.75 = 37.5 | 4.33 = 34.64 | no | 72 |
| 4 | Grace Otieno | 0.5 = 25 | 4.53 = 36.24 | no | 61 |

Grace has a higher reputation than Samuel but ranks below him, because she lists an electrical skill and neither of the two the job needs. `test/recommendations.test.js` builds each worker's reputation from raw reviews and jobs with the real formula, then ranks them, and checks these numbers.

## Insights

### GET /api/me/insights

The signed-in user's dashboard, as on Figure 4.12, for workers and clients. Nothing is stored; it is worked out from the reviews and jobs on every request.

`period` is `3m` or `6m` (the default). Anything else gets 400 `validation_failed`.

**Which reviews count.** The same reviews as the reputation score: those the user received that are visible and classified. A hidden review is dropped before any of its sentences are read, so no count, chart column or theme can give it away before the user is allowed to read it. Visible reviews still waiting for a classification are left out and counted in `pending`.

**Periods.** Calendar months in Africa/Nairobi (UTC+03:00, no daylight saving). `6m` is the current month and the five before it, `3m` the current month and the two before it. The current month is marked `partial`. A review belongs to the month it was written in, so a review that turns visible after 14 days lands in an earlier month's column.

**Scope.** The period sets the chart, the themes and the guidance. The summary cards are all-time, each with its value at the start of the period. The reputation card is the stored score.

Returns 200:

```json
{
  "role": "worker",
  "period": { "key": "6m", "time_zone": "Africa/Nairobi", "from": "2026-02-28T21:00:00.000Z", "months": ["2026-03", "...", "2026-08"] },
  "summary": {
    "reputation": { ...as GET /api/me gives it } or null,
    "reviews": { "count": 41, "at_period_start": 0, "pending": 0 },
    "average_rating": { "value": 4.9, "at_period_start": null },
    "jobs_completed": { "count": 41, "at_period_start": 0 }
  },
  "sentiment_by_month": [
    { "month": "2026-03", "partial": false, "total": 6,
      "counts": { "positive": 3, "neutral": 1, "negative": 2 },
      "percent": { "positive": 50, "neutral": 17, "negative": 33 } }
  ],
  "themes": [
    { "key": "advance_notice", "name": "Advance notice of delays", "reviews": 9, "of": 41,
      "sentiment": "negative", "counts": { "positive": 0, "neutral": 0, "negative": 9 },
      "negative_with_4_or_5_stars": 9, "by_month": [0, 0, 0, 0, 2, 7] }
  ],
  "guidance": [
    { "kind": "theme_negative", "theme": "advance_notice",
      "title": "Tell clients about a delay as soon as you know about it.",
      "detail": "Advance notice of delays comes up negative in 9 of your 41 reviews. All 9 of those reviews still gave you four or five stars." }
  ],
  "guidance_note": "Each suggestion comes from a theme or from your sentiment trend above. Nothing here affects your score.",
  "model_versions": ["distilbert-sst5-3cls-v1.0-20261111-seed43-onnx-int8"]
}
```

`percent` adds up to 100 by largest remainder and is `null` for a month with no reviews, so the chart draws a gap rather than an empty column. `average_rating.value` is the same mean as the ratings component of the score. The response never carries review or sentence text.

#### Themes

A theme is found in a sentence when the sentence contains one of its triggers as a whole phrase, ignoring capitals (the same rule as the recommendation skill match, in `src/text/phrases.js`). There is no stemming, so every form is listed. A trigger decides only the topic. The polarity comes from that sentence's DistilBERT label in `sentiment_results.sentences`, so there is no negation list: "did not reply" and "replied quickly" both mark communication, and the model reads one negative and the other positive.

| Role | Themes |
|---|---|
| worker | punctuality, tidiness, communication, quality, pricing, advance_notice (plan C1) |
| client | payment, instructions, communication, scope (the labelling guideline's rule on reviews of clients) |

The triggers are in `src/insights/lexicon.js`. One sentence can mark two themes. A known false hit is "late" in "late afternoon".

A theme counts once per review. The review's sentiment for the theme comes from the sentences that mention it: neutral when a positive and a negative sentence both do (praise and complaint cancel, as in rule 4 of the labelling guideline), otherwise the positive or negative label if there is one, otherwise neutral. Across reviews, `sentiment` is the label with the most reviews, or `mixed` when the top two are level. `counts` gives all three, because the deployed model leans negative and a reader should see the split, not just the winner. `negative_with_4_or_5_stars` counts the negative mentions in reviews that still gave four or five stars, which is where that lean shows. Themes are listed most mentioned first; only themes mentioned at least once appear.

#### Guidance

At most three items, each a fixed sentence filled with counts:

1. `theme_negative`: each theme whose sentiment is negative with at least 3 negative mentions, most first.
2. `theme_positive`: the positive theme with the most positive mentions, if it has at least 3.
3. `trend`: the change in negative share between the first and last months of the period that each hold at least 3 reviews.

3 is the same threshold as Provisional. A user with fewer counted reviews gets no guidance.

Worked example, Figure 4.12: `test/insights.test.js` builds 41 reviews of Peter Mwangi between March and August 2026 and gets the figure's themes, punctuality 27, tidiness 19, communication 14 (the figure's "Explaining the problem before starting") and advance notice 9 negative, all out of 41, with the three guidance items. The figure's chart cannot come from 41 reviews: its rounded shares need at least 204 reviews with 15 negatives.
