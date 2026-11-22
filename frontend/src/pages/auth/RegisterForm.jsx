import { Link } from 'react-router'
import { Button } from '../../components/Button.jsx'
import { RoleTiles } from '../../components/RoleTiles.jsx'
import { TextField } from '../../components/TextField.jsx'
import { AuthCard } from './AuthCard.jsx'
import styles from './AuthForm.module.css'

// The registration panel of Figure 4.6, drawn from props so the figure
// fixture can show it with the figure's sample values and error.
export function RegisterForm({ values, errors, formError, busy, onChange, onSubmit }) {
  const field = (name) => ({
    value: values[name],
    error: errors[name],
    onChange: (event) => onChange(name, event.target.value),
  })
  return (
    <AuthCard
      title="Create your account"
      subtitle="Join the marketplace as a client or a worker."
      footer={
        <>
          Already have an account?<Link to="/login">Log in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <TextField label="Full name" autoComplete="name" {...field('name')} />
        <TextField label="Email address" type="email" autoComplete="email" {...field('email')} />
        <TextField label="Password" type="password" autoComplete="new-password" {...field('password')} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" {...field('confirm')} />
        <RoleTiles legend="I am signing up as" value={values.role} error={errors.role} onChange={(role) => onChange('role', role)} />
        {formError && (
          <p className={styles.formError} role="alert">
            {formError}
          </p>
        )}
        <Button type="submit" large busy={busy} busyLabel="Creating your account">
          Create account
        </Button>
      </form>
    </AuthCard>
  )
}
