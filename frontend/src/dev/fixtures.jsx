import { Shell } from '../layout/Shell.jsx'
import { PlaceholderPage } from '../pages/PlaceholderPage.jsx'

// Sample data shared by the figures (Chapter 4 handover, section 4).
export const AMINA = { id: 'fixture-amina', name: 'Amina Wanjiru', role: 'client', company_name: 'Wanjiru Interiors Ltd' }
export const PETER = { id: 'fixture-peter', name: 'Peter Mwangi', role: 'worker' }

const noop = () => {}

// One entry per fixture. Each screen issue (#83 to #90) adds its figure here.
export const FIXTURES = [
  {
    id: 'shell-client',
    title: 'App shell, client (sidebar of Figure 4.7)',
    render: () => (
      <Shell user={AMINA} onLogOut={noop} activeTo="/profile">
        <PlaceholderPage title="Amina Wanjiru" figure="4.7" issue={86} />
      </Shell>
    ),
  },
  {
    id: 'shell-worker',
    title: 'App shell, worker (sidebar of Figure 4.8)',
    render: () => (
      <Shell user={PETER} onLogOut={noop} activeTo="/profile">
        <PlaceholderPage title="Peter Mwangi" figure="4.8" issue={85} />
      </Shell>
    ),
  },
]
