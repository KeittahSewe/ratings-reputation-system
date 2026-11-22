import { Outlet } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { Shell } from './Shell.jsx'

// The signed-in layout: sidebar plus the page from the matched route.
export function AppLayout() {
  const { me, signOut } = useAuth()
  return (
    <Shell user={me.user} onLogOut={signOut}>
      <Outlet />
    </Shell>
  )
}
