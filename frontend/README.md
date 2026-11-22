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

Never commit `.env`. Only variables that start with `VITE_` are visible in the browser, so never put a secret such as the Supabase secret key here.

## Run

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server at http://localhost:5173 with hot reload |
| `npm run build` | Builds the production bundle into `dist/` |
| `npm run preview` | Serves the built `dist/` folder locally to check the build |
| `npm run lint` | Checks the code with oxlint |

## Deployment check

Until phase 4 the page is the scaffold plus a deployment check. It calls `GET {VITE_API_BASE_URL}/health` and shows the API's status, the inference service's status and model version, and the base URL it was built with. A *not reachable* line usually means one of three things: `VITE_API_BASE_URL` was wrong at build time, the API's `CORS_ORIGIN` does not list this origin (the browser console then shows a CORS error), or the free Render service is still waking. *Check again* repeats the call.

## Vercel

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite (build `npm run build`, output `dist`) |
| Production branch | `main` |
| Ignored Build Step | `git diff HEAD^ HEAD --quiet -- .`, so a push that changes nothing under `frontend` is not built. Vercel's automatic skip only works for workspace monorepos. |
| Environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_API_BASE_URL` (`https://ratings-reputation-api.onrender.com/api`), for Production and Preview |

Vite writes `VITE_` variables into the bundle at build time, so after changing one, redeploy for it to take effect.

`vercel.json` sends every path that is not a built file to `index.html`, so React Router routes (phase 4) load when opened or refreshed directly.

Only the production origin is in the API's `CORS_ORIGIN`. Preview deployments get their own URLs, so their deployment check reports the API as not reachable; that is expected.

## Styles

All colours and type sizes live in `src/styles/tokens.css` as CSS custom properties. It is imported once in `src/main.jsx`. Components use CSS modules (`*.module.css`) and refer to the tokens, for example `color: var(--color-text);`.
