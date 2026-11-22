import { useAuth } from '../auth/useAuth.js'
import { Button } from '../components/Button.jsx'
import styles from './SignedInPlaceholder.module.css'

// Temporary page for #82 step 5, to prove sign-in and GET /api/me work.
// Step 6 replaces it with the app shell and sidebar.
export function SignedInPlaceholder() {
  const { me, signOut } = useAuth()
  const { user, skills, reputation } = me
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Signed in</h1>
      <p>
        {user.name}, {user.role}
        {user.company_name ? `, ${user.company_name}` : ''}
      </p>
      <p className={styles.helper}>
        Skills listed: {skills.length}. Reputation: {reputation ? `${reputation.score} from ${reputation.review_count} reviews` : 'none yet'}.
      </p>
      <Button variant="secondary" onClick={signOut}>
        Sign out
      </Button>
    </main>
  )
}
