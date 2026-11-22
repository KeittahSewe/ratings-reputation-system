import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

// For /login and /register: a signed-in user goes on to where they were
// heading, or to My Jobs.
export function PublicOnly({ children }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'ready') return <Navigate to={location.state?.from ?? '/jobs'} replace />
  return children
}
