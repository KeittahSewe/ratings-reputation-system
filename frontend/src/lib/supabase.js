// The browser's Supabase client, used only for Supabase Auth: sign-up,
// sign-in, sign-out and keeping the session. The browser never queries a
// table; every read and write goes through the Express API (backend README,
// Database).

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// A secret key here would be built into the JavaScript every visitor downloads.
if (key?.startsWith('sb_secret_')) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY holds a secret key. Use the sb_publishable_ key.')
}

export const supabaseConfigured = Boolean(url && key)

// The session is kept in localStorage and refreshed before it expires, so a
// reload keeps the user signed in.
export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null
