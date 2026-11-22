import { MESSAGES } from '../auth/validation.js'
import { Shell } from '../layout/Shell.jsx'
import { LoginForm } from '../pages/auth/LoginForm.jsx'
import { RegisterForm } from '../pages/auth/RegisterForm.jsx'
import { PlaceholderPage } from '../pages/PlaceholderPage.jsx'
import { ClientProfileView } from '../pages/profile/ClientProfileView.jsx'
import { WorkerProfileView } from '../pages/profile/WorkerProfileView.jsx'

// Sample data shared by the figures (Chapter 4 handover, section 4).
export const AMINA = { id: 'fixture-amina', name: 'Amina Wanjiru', role: 'client', company_name: 'Wanjiru Interiors Ltd' }
export const PETER = { id: 'fixture-peter', name: 'Peter Mwangi', role: 'worker' }

const noop = () => {}
const later = async () => {}

// Figure 4.8 with the numbers the real formulas give (change log,
// 12 and 18 November): R 4.90, S 4.41 from 32 / 6 / 3, H 5.00 because a
// client's cancellation no longer counts against the worker; score 4.72,
// shown as 4.7.
const PETER_PROFILE = {
  user: {
    ...PETER,
    email: 'peter.mwangi@example.com',
    bio: 'Licensed plumber working across Nairobi and Kiambu. Eleven years on residential water systems, bathroom fitting and small commercial jobs. Available weekdays and Saturday mornings.',
    availability: true,
    created_at: '2025-01-10T09:00:00Z',
  },
  skills: [
    { id: 's1', skill_name: 'Residential plumbing', category: 'plumbing' },
    { id: 's2', skill_name: 'Bathroom installation', category: 'plumbing' },
    { id: 's3', skill_name: 'Pipe fitting and repair', category: 'plumbing' },
    { id: 's4', skill_name: 'Basic electrical wiring', category: 'electrical' },
  ],
  reputation: {
    score: 4.72,
    ratings_component: 4.9,
    sentiment_component: 4.41,
    history_component: 5,
    review_count: 41,
    provisional: false,
    sentiment_counts: { positive: 32, neutral: 6, negative: 3 },
  },
  completedJobs: 41,
  reviewCount: 41,
  reviews: [
    {
      id: 'r1',
      rating: 5,
      review_text: 'Peter arrived when he said he would and explained what was wrong before starting. The leak has not come back. I will call him again for the bathroom job.',
      created_at: '2026-08-18T09:00:00Z',
      reviewer: { id: 'fixture-amina', name: 'Amina Wanjiru', role: 'client' },
      job: { id: 'j1', title: 'Fix kitchen plumbing' },
      sentiment: { label: 'positive', confidence_score: 0.97 },
    },
    {
      id: 'r2',
      rating: 4,
      review_text: 'Solid work and a fair price. He needed an extra day because a part was hard to find, and he did let me know, though I would have liked more notice.',
      created_at: '2026-08-05T09:00:00Z',
      reviewer: { id: 'fixture-joseph', name: 'Joseph Njoroge', role: 'client' },
      job: { id: 'j2', title: 'Replace bathroom pipework' },
      sentiment: { label: 'neutral', confidence_score: 0.68 },
    },
    {
      id: 'r3',
      rating: 5,
      review_text: 'Careful and tidy. He tested everything twice before leaving and walked me through how to use the timer. No complaints at all.',
      created_at: '2026-07-29T09:00:00Z',
      reviewer: { id: 'fixture-faith', name: 'Faith Chebet', role: 'client' },
      job: { id: 'j3', title: 'Install water heater' },
      sentiment: { label: 'positive', confidence_score: 0.94 },
    },
  ],
}

// Figure 4.7 with numbers 14 real reviews can give. The figure's sentiment
// 4.5 cannot come from 14 reviews (the nearest are 4.43 and 4.57), so this
// uses 12 positive, 1 neutral, 1 negative: S 4.57. R 66 / 14 = 4.71, H 5.00
// for 14 completed jobs; score 4.71, shown as 4.7 as on the figure.
const AMINA_PROFILE = {
  user: {
    ...AMINA,
    email: 'amina.wanjiru@example.com',
    bio: 'We refurbish residential and small office interiors around Nairobi. We hire regularly for plumbing, carpentry and electrical work.',
    created_at: '2025-03-04T09:00:00Z',
  },
  reputation: {
    score: 4.71,
    ratings_component: 4.71,
    sentiment_component: 4.57,
    history_component: 5,
    review_count: 14,
    provisional: false,
    sentiment_counts: { positive: 12, neutral: 1, negative: 1 },
  },
  completedJobs: 14,
  reviewCount: 14,
  reviews: [
    {
      id: 'a1',
      rating: 5,
      review_text: 'Amina was clear about what the job involved and paid the same day I finished. She had all the materials ready when I arrived, which saved me a second trip.',
      created_at: '2026-08-18T09:00:00Z',
      reviewer: { id: 'fixture-peter', name: 'Peter Mwangi', role: 'worker' },
      job: { id: 'j1', title: 'Fix kitchen plumbing' },
      sentiment: { label: 'positive', confidence_score: 0.96 },
    },
    {
      id: 'a2',
      rating: 4,
      review_text: 'Good client overall. The brief changed once we had started, but she was reasonable about the extra time it needed and we agreed on it quickly.',
      created_at: '2026-08-02T09:00:00Z',
      reviewer: { id: 'fixture-grace', name: 'Grace Otieno', role: 'worker' },
      job: { id: 'j4', title: 'Repaint two office rooms' },
      sentiment: { label: 'neutral', confidence_score: 0.71 },
    },
    {
      id: 'a3',
      rating: 5,
      review_text: 'Very organised. Amina answered questions quickly and the site was ready when she said it would be. I would take another job from her.',
      created_at: '2026-07-21T09:00:00Z',
      reviewer: { id: 'fixture-daniel', name: 'Daniel Kiprop', role: 'worker' },
      job: { id: 'j5', title: 'Install shelving units' },
      sentiment: { label: 'positive', confidence_score: 0.93 },
    },
  ],
}

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
    id: '4.7',
    title: 'Figure 4.7, client profile (1440 wide)',
    render: () => (
      <Shell user={AMINA} onLogOut={noop} activeTo="/profile">
        <ClientProfileView {...AMINA_PROFILE} own onSaveDetails={later} />
      </Shell>
    ),
  },
  {
    id: '4.8',
    title: 'Figure 4.8, worker profile (1440 wide)',
    render: () => (
      <Shell user={PETER} onLogOut={noop} activeTo="/profile">
        <WorkerProfileView
          {...PETER_PROFILE}
          own
          onToggleAvailability={noop}
          onSaveDetails={later}
          onAddSkill={later}
          onRemoveSkill={later}
        />
      </Shell>
    ),
  },
  {
    id: '4.8-other',
    title: 'Figure 4.8 as another user sees it: read only (1440 wide)',
    render: () => (
      <Shell user={AMINA} onLogOut={noop} activeTo="/find-workers">
        <WorkerProfileView {...PETER_PROFILE} user={{ ...PETER_PROFILE.user, email: undefined }} />
      </Shell>
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
