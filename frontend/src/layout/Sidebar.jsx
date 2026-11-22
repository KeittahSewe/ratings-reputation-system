import { NavLink } from 'react-router'
import { NAV_ITEMS, ROLE_LABELS } from './navItems.js'
import styles from './Sidebar.module.css'

// The 240px sidebar on every signed-in screen, as drawn in Figures 4.7 to
// 4.12. It takes the user as props rather than reading the session, so the
// figure fixtures can show it with sample data. activeTo, for fixtures only,
// marks an item active whatever the current address is.
export function Sidebar({ user, onLogOut, activeTo }) {
  const items = NAV_ITEMS[user.role] ?? []
  return (
    <aside className={styles.sidebar}>
      <p className={styles.brand}>Ratings and Reputation</p>
      <nav className={styles.nav} aria-label="Main">
        <ul className={styles.list}>
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  (activeTo ? item.to === activeTo : isActive) ? `${styles.link} ${styles.active}` : styles.link
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className={styles.user}>
        <p className={styles.userName}>{user.name}</p>
        <p className={styles.userRole}>{ROLE_LABELS[user.role]}</p>
        <button type="button" className={styles.logOut} onClick={onLogOut}>
          Log out
        </button>
      </div>
    </aside>
  )
}
