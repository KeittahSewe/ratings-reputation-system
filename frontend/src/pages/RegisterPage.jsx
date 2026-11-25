import { useSearchParams } from 'react-router'
import { useAuth } from '../auth/useAuth.js'
import { validateRegistration } from '../auth/validation.js'
import { RegisterForm } from './auth/RegisterForm.jsx'
import { useAuthForm } from './auth/useAuthForm.js'

// Figure 4.6, registration. Sign-up keeps the name and role in the account's
// user_metadata; AuthProvider then creates the users row through
// POST /api/me/bootstrap. Company name is not asked here; clients add it on
// their profile. The landing page links here with ?role=client or
// ?role=worker, which preselects that tile; any other value selects none.
const ROLES = ['client', 'worker']

export function RegisterPage() {
  const { signUp, status } = useAuth()
  const [params] = useSearchParams()
  const role = ROLES.includes(params.get('role')) ? params.get('role') : ''
  const form = useAuthForm({
    initial: { name: '', email: '', password: '', confirm: '', role },
    validate: validateRegistration,
    submit: ({ name, email, password, role }) => signUp({ name: name.trim(), email: email.trim(), password, role }),
  })
  return <RegisterForm {...form} busy={form.busy || status === 'loading'} />
}
