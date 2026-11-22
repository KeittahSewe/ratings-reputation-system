import { useAuth } from '../auth/useAuth.js'
import { validateLogin } from '../auth/validation.js'
import { LoginForm } from './auth/LoginForm.jsx'
import { useAuthForm } from './auth/useAuthForm.js'

// Figure 4.6, log in.
export function LoginPage() {
  const { signIn, status } = useAuth()
  const form = useAuthForm({
    initial: { email: '', password: '' },
    validate: validateLogin,
    submit: ({ email, password }) => signIn(email.trim(), password),
  })
  return <LoginForm {...form} busy={form.busy || status === 'loading'} />
}
