import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import './styles/tokens.css'
import App from './App.jsx'
import { API_BASE_URL, wakeServices } from './lib/api.js'
import { supabaseConfigured } from './lib/supabase.js'

const root = createRoot(document.getElementById('root'))

if (!supabaseConfigured || !API_BASE_URL) {
  // A build without its VITE_ variables cannot sign anyone in; say so plainly.
  root.render(
    <main style={{ padding: 'var(--space-7)' }}>
      <h1>Configuration missing</h1>
      <p>This build has no VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY or VITE_API_BASE_URL. See frontend/README.md.</p>
    </main>,
  )
} else {
  wakeServices()
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
