import { Sidebar } from './Sidebar.jsx'
import styles from './Shell.module.css'

// Sidebar plus a 1200px content area with 32px margins, as on every 1440 wide
// frame. Kept apart from AppLayout so the figure fixtures can use it.
export function Shell({ user, onLogOut, activeTo, children }) {
  return (
    <div className={styles.shell}>
      <Sidebar user={user} onLogOut={onLogOut} activeTo={activeTo} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
