import { MESSAGES } from '../auth/validation.js'
import { Shell } from '../layout/Shell.jsx'
import { LoginForm } from '../pages/auth/LoginForm.jsx'
import { RegisterForm } from '../pages/auth/RegisterForm.jsx'
import { PlaceholderPage } from '../pages/PlaceholderPage.jsx'

// Sample data shared by the figures (Chapter 4 handover, section 4).
export const AMINA = { id: 'fixture-amina', name: 'Amina Wanjiru', role: 'client', company_name: 'Wanjiru Interiors Ltd' }
export const PETER = { id: 'fixture-peter', name: 'Peter Mwangi', role: 'worker' }

const noop = () => {}

// One entry per fixture. Each screen issue (#83 to #90) adds its figure here.
// View each at the size in its title (DevTools device toolbar).
export const FIXTURES = [
  {
    id: '4.6-register',
    title: 'Figure 4.6, registration panel (1440 x 1024)',
    render: () => (
      <RegisterForm
        values={{ name: 'Amina Wanjiru', email: 'amina.wanjiru@', password: 'password12', confirm: 'password12', role: 'client' }}
        errors={{ email: MESSAGES.email }}
        onChange={noop}
        onSubmit={(event) => event.preventDefault()}
      />
    ),
  },
  {
    id: '4.6-login',
    title: 'Figure 4.6, log-in panel (1440 x 1024)',
    render: () => (
      <LoginForm
        values={{ email: 'amina.wanjiru@example.com', password: 'password12' }}
        errors={{}}
        onChange={noop}
        onSubmit={(event) => event.preventDefault()}
      />
    ),
  },
  {
    id: 'shell-client',
    title: 'App shell, client: sidebar of Figure 4.7 (1440 wide)',
    render: () => (
      <Shell user={AMINA} onLogOut={noop} activeTo="/profile">
        <PlaceholderPage title="Amina Wanjiru" figure="4.7" issue={86} />
      </Shell>
    ),
  },
  {
    id: 'shell-worker',
    title: 'App shell, worker: sidebar of Figure 4.8 (1440 wide)',
    render: () => (
      <Shell user={PETER} onLogOut={noop} activeTo="/profile">
        <PlaceholderPage title="Peter Mwangi" figure="4.8" issue={85} />
      </Shell>
    ),
  },
]
