import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { Button } from '../components/Button.jsx'
import { TextField } from '../components/TextField.jsx'
import styles from './LoginPage.module.css'

// A working sign-in form for #82. #83 rebuilds it to Figure 4.6.
export function LoginPage() {
  const { signIn, status } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err.code === 'invalid_credentials' ? 'Email or password is incorrect.' : err.message)
      setBusy(false)
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.title}>Log in</h1>
        <TextField label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" busy={busy || status === 'loading'} busyLabel="Signing in">
          Log in
        </Button>
        <p className={styles.helper}>
          No account yet? <Link to="/register">Create one</Link>
        </p>
      </form>
    </main>
  )
}
