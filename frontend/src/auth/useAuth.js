import { useContext } from 'react'
import { AuthContext } from './authContext.js'

// The signed-in state: { status, me, error, signIn, signUp, signOut, reloadMe, setMe }.
// status is loading, signedOut, needsBootstrap, ready or error. me is the
// GET /api/me body ({ user, skills, reputation }) once status is ready.
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider.')
  return value
}
