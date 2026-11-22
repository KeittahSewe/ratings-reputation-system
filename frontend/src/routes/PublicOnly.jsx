import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

// For /login and /register. Once a session exists the visitor moves on to
// where they were heading, or to My Jobs. That includes an account that could
// not be loaded or has no profile: RequireAuth shows those states with a way
// forward, which the log-in form cannot.
const SIGNED_IN = ['ready', 'error', 'needsBootstrap']

export function PublicOnly({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (SIGNED_IN.includes(status)) return <Navigate to={location.state?.from ?? '/jobs'} replace />
  return children
}
