import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth.js'

// Routes for one role only, such as Find Workers for clients. The API refuses
// the other role anyway (403 wrong_role); this keeps the screen from loading.
export function RoleRoute({ role }) {
  const { me } = useAuth()
  if (me.user.role !== role) return <Navigate to="/jobs" replace />
  return <Outlet />
}
