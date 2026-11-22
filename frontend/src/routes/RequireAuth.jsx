import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { Button } from '../components/Button.jsx'
import { ErrorState } from '../components/ErrorState.jsx'
import { LoadingState } from '../components/LoadingState.jsx'
import styles from './RequireAuth.module.css'

// Wraps every signed-in route. Sends signed-out visitors to /login and
// remembers where they were going.
export function RequireAuth() {
  const { status, error, reloadMe, signOut } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <LoadingState label="Loading your account" />
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (status === 'error') {
    return (
      <main className={styles.page}>
        <ErrorState title="Your account could not be loaded" error={error} onRetry={reloadMe} />
      </main>
    )
  }
  if (status === 'needsBootstrap') {
    return (
      <main className={styles.page}>
        <p>This account has no profile yet, so it cannot be used. Sign out and register again with a role.</p>
        <Button variant="secondary" onClick={signOut}>
          Sign out
        </Button>
      </main>
    )
  }
  return <Outlet />
}
