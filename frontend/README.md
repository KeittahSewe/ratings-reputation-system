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
| `VITE_SUPABASE_ANON_KEY` | Public anon key of the Supabase project |
| `VITE_API_BASE_URL` | Base URL of the Express API, ending in `/api` |

Never commit `.env`. Only variables that start with `VITE_` are visible in the browser, so never put a secret such as the service role key here.

## Run

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server at http://localhost:5173 with hot reload |
| `npm run build` | Builds the production bundle into `dist/` |
| `npm run preview` | Serves the built `dist/` folder locally to check the build |
| `npm run lint` | Checks the code with oxlint |

## Styles

All colours and type sizes live in `src/styles/tokens.css` as CSS custom properties. It is imported once in `src/main.jsx`. Components use CSS modules (`*.module.css`) and refer to the tokens, for example `color: var(--color-text);`.
