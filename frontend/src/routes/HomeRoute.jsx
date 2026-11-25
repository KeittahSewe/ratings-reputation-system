import { Navigate } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { LoadingState } from '../components/LoadingState.jsx'
import { LandingPage } from '../pages/landing/LandingPage.jsx'

// The / route. Signed-out visitors see the landing page; anyone with a
// session goes on to My Jobs, where RequireAuth handles an account that
// could not be loaded or has no profile, as PublicOnly does.
export function HomeRoute() {
  const { status } = useAuth()
  if (status === 'loading') return <LoadingState label="Loading" />
  if (status === 'signedOut') return <LandingPage />
  return <Navigate to="/jobs" replace />
}
