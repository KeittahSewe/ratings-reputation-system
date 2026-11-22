import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, apiFetch } from '../lib/api.js'
import { supabase } from '../lib/supabase.js'
import { AuthContext } from './authContext.js'

const ROLES = ['client', 'worker']

// Reads GET /api/me. An account with no users row yet is bootstrapped from
// the name and role kept in its Supabase user_metadata at sign-up, so a
// bootstrap that failed (for example during a cold start) finishes at the
// next sign-in without asking the user again.
async function loadMe(signal) {
  try {
    return { status: 'ready', me: await apiFetch('/me', { signal }), error: null }
  } catch (err) {
    if (!(err instanceof ApiError) || err.code !== 'not_bootstrapped') throw err
  }

  const { data } = await supabase.auth.getSession()
  const meta = data.session?.user?.user_metadata ?? {}
  if (typeof meta.name !== 'string' || !ROLES.includes(meta.role)) {
    return { status: 'needsBootstrap', me: null, error: null }
  }
  const body = { name: meta.name, role: meta.role }
  if (meta.role === 'client' && meta.company_name) body.company_name = meta.company_name
  await apiFetch('/me/bootstrap', { method: 'POST', body, signal })
  return { status: 'ready', me: await apiFetch('/me', { signal }), error: null }
}

export function AuthProvider({ children }) {
  // undefined until the stored session has been read; null when signed out.
  const [session, setSession] = useState(undefined)
  const [state, setState] = useState({ userId: null, attempt: 0, status: 'loading', me: null, error: null })
  const [attempt, setAttempt] = useState(0)

  const sessionRead = session !== undefined
  const userId = session?.user?.id ?? null

  // Follows Supabase's session: sign-in, sign-out and token refreshes.
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Loads the users row whenever a different user signs in. A token refresh
  // keeps the same user id, so it does not reload.
  useEffect(() => {
    if (!sessionRead || !userId) return undefined
    const controller = new AbortController()
    loadMe(controller.signal)
      .then((result) => setState({ userId, attempt, ...result }))
      .catch((error) => {
        if (!controller.signal.aborted) setState({ userId, attempt, status: 'error', me: null, error })
      })
    return () => controller.abort()
  }, [sessionRead, userId, attempt])

  const signIn = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  // Confirm email is off on this project (change log, 18 November), so
  // sign-up returns a session straight away.
  const signUp = useCallback(async ({ name, email, password, role }) => {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role } } })
    if (error) throw error
    if (!data.session) throw new Error('The account was created but not signed in. Try signing in.')
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const reloadMe = useCallback(() => setAttempt((n) => n + 1), [])
  const setMe = useCallback((me) => setState((s) => ({ ...s, me })), [])

  const value = useMemo(() => {
    let current
    if (!sessionRead) current = { status: 'loading', me: null, error: null }
    else if (!userId) current = { status: 'signedOut', me: null, error: null }
    else if (state.userId !== userId || state.attempt !== attempt) current = { status: 'loading', me: null, error: null }
    else current = state
    return { status: current.status, me: current.me, error: current.error, signIn, signUp, signOut, reloadMe, setMe }
  }, [sessionRead, userId, attempt, state, signIn, signUp, signOut, reloadMe, setMe])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
