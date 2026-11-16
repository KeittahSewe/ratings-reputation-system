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
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key. Full database access, so it stays on the server only. |
| `SUPABASE_JWT_SECRET` | Secret used to check Supabase Auth tokens sent by the frontend |
| `INFERENCE_URL` | Base URL of the FastAPI inference service |
| `INFERENCE_SERVICE_KEY` | Shared key the API sends to the inference service |
| `CORS_ORIGIN` | Frontend URL allowed to call the API |

Never commit `.env`. The variables are loaded with Node's built-in `--env-file-if-exists` flag, so no extra package is needed. If `.env` is missing, Node starts anyway and uses whatever is set in the environment, which is how Render provides them.

## Run

| Command | What it does |
|---|---|
| `npm run dev` | Starts the API and restarts it whenever a file changes |
| `npm start` | Starts the API once, as on Render |

Check that it is running:

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

This returns `{ "status": "ok" }`.

## Code layout

| File | What it does |
|---|---|
| `src/app.js` | Builds and exports the Express app: routes, 404 handler and error handler |
| `src/server.js` | Imports the app and starts listening on `PORT` |

Keeping these apart lets tests import the app without starting a server.

## Errors

Every error response uses the same format:

```json
{ "error": { "code": "not_found", "message": "No route for GET /api/unknown" } }
```

An unknown route returns 404 with code `not_found`. An unexpected server error returns 500 with code `internal_error`.

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

`20261116180836_create_core_tables.sql` creates the six tables with row level security on and no policies yet. Only `service_role`, which this API uses through the secret key, has table privileges, so the publishable key in the browser cannot read or write any table.
