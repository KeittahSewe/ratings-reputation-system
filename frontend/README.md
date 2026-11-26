# frontend

React.js single-page application built with Vite. Seven screens matching wireframe Figures 4.6 to 4.12. Deployed on Vercel.

## Requirements

- Node.js 26 and npm 11

## Install

From the `frontend` folder:

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
| `VITE_SUPABASE_URL` | URL of the Supabase project |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key of the Supabase project, starting `sb_publishable_`. Used only for sign-up and sign-in; it can read no table. |
| `VITE_API_BASE_URL` | Base URL of the Express API, ending in `/api` |
| `VITE_INFERENCE_URL` | Optional. Base URL of the inference service (`http://localhost:8000` locally, `https://ratings-reputation-inference.onrender.com` on Vercel). The browser only sends it a `GET /health` it never reads, to wake it: while it sleeps on Render, the API's own call to it fails at once instead of waking it, so a review would be saved as pending. |

Never commit `.env`. Only variables that start with `VITE_` are visible in the browser, so never put a secret such as the Supabase secret key here.

## Run

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server at http://localhost:5173 with hot reload |
| `npm run build` | Builds the production bundle into `dist/` |
| `npm run preview` | Serves the built `dist/` folder locally to check the build |
| `npm run lint` | Checks the code with oxlint |
| `npm run check:design` | Checks the colour rules (see Design check) |
| `npm test` | Runs the tests of plain JavaScript modules (`src/**/*.test.js`) with Node's built-in test runner |

## Structure

| Folder | What lives there |
|---|---|
| `src/lib/` | `supabase.js` (the browser's Supabase client, for Auth only), `api.js` (`apiFetch`, the one way to call the API) and `useApi.js` (the hook a screen uses to load one path) |
| `src/auth/` | `AuthProvider`, which follows the Supabase session and loads `GET /api/me`, and `useAuth()` |
| `src/routes/` | Route guards: `RequireAuth` (signed in, with a users row), `PublicOnly` (log in and register), `RoleRoute` (one role only) |
| `src/layout/` | The 240px sidebar and the shell around every signed-in screen |
| `src/components/` | Shared components built on the tokens: Button, TextField, TextArea, Card, PageTitle, Tag and AiTag, LoadingState, ErrorState, EmptyState |
| `src/pages/` | One file per screen |
| `src/dev/` | Figure fixtures, in development only |
| `scripts/` | `check-design.mjs` |

## Signing in and calling the API

The browser uses the publishable key only for Supabase Auth: sign-up, sign-in, sign-out and the session, which Supabase keeps in localStorage and refreshes before it expires. It never queries a table. Every read and write goes through the Express API with the user's access token.

At sign-up the name and role go into the account's `user_metadata`. `AuthProvider` calls `GET /api/me` whenever a different user signs in; if the API answers 403 `not_bootstrapped`, it calls `POST /api/me/bootstrap` with that name and role, so a bootstrap that failed during a cold start finishes at the next sign-in.

`apiFetch` sends the token, turns `{ error: { code, message } }` into an `ApiError` with `status`, `code` and `message`, refreshes the session once on 401 `token_expired`, and retries a GET once after a network failure. It allows 75 seconds a request, because a sleeping Render service holds the request while it wakes (about 24 s for the API and 33 s for the inference service). After 5 seconds `LoadingState` says the server is waking and counts the seconds.

When the app loads it sends one `GET /api/health` to the API, and one `GET /health` straight to the inference service, without waiting for either answer, so both Render services start waking while the user is on the log-in page. The review page sends the inference request again when it opens.

## Routes

| Path | Who | Screen |
|---|---|---|
| `/login`, `/register` | signed out | Figure 4.6 |
| `/status` | anyone | API and inference status, the phase 7a deployment check |
| `/jobs` | both | My Jobs, Figure 4.9 |
| `/jobs/available` | workers | Available Jobs |
| `/find-workers`, `/jobs/:id/recommendations` | clients | Figure 4.11 |
| `/jobs/:id/review` | both | Figure 4.10 |
| `/insights` | both | Figure 4.12 |
| `/profile` | both | Figure 4.7 or 4.8 |
| `/users/:id` | both | another user's profile, read only |

The sidebar lists only items with a screen of their own. Figures 4.7 to 4.12 also show Dashboard, Reviews and Skills; reviews received are on the profile, reviews to write are reached from My Jobs, and skills are edited on the worker profile.

## Checking a screen against its figure

`/dev/figures` lists one fixture per figure: the screen drawn with the figure's sample data, corrected to the real formulas. Open one with the Chrome DevTools device toolbar at 1440 wide and compare it with its frame in the Figma file. The fixtures exist in `npm run dev` only; a production build leaves them out.

## Design check

`npm run check:design` enforces the two colour rules from the Chapter 4 handover that a linter cannot:

- the AI accent (`--color-ai-accent`, #9DDBAD) is never a text colour, because against white it reaches about 1.6 to 1, under the 4.5 to 1 body text needs;
- no hex colour appears outside `src/styles/tokens.css`.

Run it with lint and build before every pull request.

## Vercel

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite (build `npm run build`, output `dist`) |
| Production branch | `main` |
| Ignored Build Step | `git diff HEAD^ HEAD --quiet -- .`, so a push that changes nothing under `frontend` is not built. Vercel's automatic skip only works for workspace monorepos. |
| Environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_API_BASE_URL` (`https://ratings-reputation-api.onrender.com/api`). The two Supabase variables are type Config, because the `VITE_` prefix puts them in the browser bundle anyway. |

Vite writes `VITE_` variables into the bundle at build time, so after changing one, redeploy for it to take effect.

`vercel.json` sends every path that is not a built file to `index.html`, so React Router routes load when opened or refreshed directly.

Only the production origin is in the API's `CORS_ORIGIN`. Preview deployments get their own URLs, so on a preview the app cannot reach the API and `/status` reports it as not reachable; that is expected.

## Styles

All colours, type sizes, spacing and layout sizes live in `src/styles/tokens.css` as CSS custom properties. Inter is bundled from `@fontsource/inter` (400 and 600), so no font is fetched from another site. It is imported once in `src/main.jsx`. Components use CSS modules (`*.module.css`) and refer to the tokens, for example `color: var(--color-text);`.
