import { Link } from 'react-router'
import styles from './RegisterPlaceholder.module.css'

// Registration is #83 (Figure 4.6). Until then, accounts are the test accounts.
export function RegisterPlaceholder() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Create an account</h1>
      <p className={styles.helper}>Registration is not built yet.</p>
      <Link to="/login">Back to log in</Link>
    </main>
  )
}
