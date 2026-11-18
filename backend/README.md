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
| `INFERENCE_URL` | Base URL of the FastAPI inference service |
| `INFERENCE_SERVICE_KEY` | Shared key the API sends to the inference service |
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
| `src/db/reputation.js` | Reads from `public.reputation_scores` |
| `src/db/reviews.js` | Reads received reviews, with reviewer, job and sentiment, for profiles |
| `src/reviews/visibility.js` | When a review becomes visible: the pair is complete, or 14 days have passed |
| `src/routes/me.js` | `POST /api/me/bootstrap`, `GET /api/me`, `PATCH /api/me` |
| `src/routes/users.js` | `GET /api/users/:id` |
| `src/routes/skills.js` | `GET`, `POST /api/me/skills` and `DELETE /api/me/skills/:id` |

`createApp()` takes the token checker and the data access as arguments, so tests pass in fakes and import the app without starting a server.

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
- An unknown or malformed id gets 404.
