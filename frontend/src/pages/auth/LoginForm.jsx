import { Link } from 'react-router'
import { Button } from '../../components/Button.jsx'
import { TextField } from '../../components/TextField.jsx'
import { AuthCard } from './AuthCard.jsx'
import styles from './AuthForm.module.css'

// The log-in panel of Figure 4.6, drawn from props like RegisterForm.
export function LoginForm({ values, errors, formError, busy, onChange, onSubmit }) {
  const field = (name) => ({
    value: values[name],
    error: errors[name],
    onChange: (event) => onChange(name, event.target.value),
  })
  return (
    <AuthCard
      title="Log in"
      subtitle="Welcome back. Sign in to manage your jobs and reviews."
      footer={
        <>
          New here?<Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField label="Email address" type="email" autoComplete="email" {...field('email')} />
        <TextField label="Password" type="password" autoComplete="current-password" {...field('password')} />
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" large busy={busy} busyLabel="Logging in">
          Log in
        </Button>
      </form>
    </AuthCard>
  )
}
