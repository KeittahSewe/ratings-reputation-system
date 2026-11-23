import { MESSAGES } from '../auth/validation.js'
import { PageTitle } from '../components/PageTitle.jsx'
import { Shell } from '../layout/Shell.jsx'
import { LoginForm } from '../pages/auth/LoginForm.jsx'
import { JobActions } from '../pages/jobs/JobActions.jsx'
import { JobDetail } from '../pages/jobs/JobDetail.jsx'
import { JobFilters } from '../pages/jobs/JobFilters.jsx'
import { JobsTable } from '../pages/jobs/JobsTable.jsx'
import { PostJobPanel } from '../pages/jobs/PostJobPanel.jsx'
import { ReviewForm } from '../pages/review/ReviewForm.jsx'
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

// Figure 4.9. "Replace bathroom tiles" was in the Tiling category, which is
// not one of the six; it becomes a cleaning job. Grace's reputation follows
// the 18 November job history rule (H 5.00 for 23 jobs): 4.53, shown 4.5.
const GRACE = { id: 'fixture-grace', name: 'Grace Otieno' }
const job = (id, title, category, status, created, worker, extra = {}) => ({
  id,
  title,
  category,
  status,
  created_at: `${created}T09:00:00Z`,
  client: { id: AMINA.id, name: AMINA.name, company_name: AMINA.company_name },
  worker,
  can_review: false,
  ...extra,
})
const JOBS_49 = [
  job('j1', 'Fix kitchen plumbing', 'plumbing', 'completed', '2026-08-12', { id: PETER.id, name: PETER.name }, { can_review: true }),
  job('j2', 'Repaint two office rooms', 'painting', 'in_progress', '2026-08-24', GRACE),
  job('j3', 'Install shelving units', 'carpentry', 'assigned', '2026-08-28', { id: 'fixture-daniel', name: 'Daniel Kiprop' }),
  job('j4', 'Rewire reception lighting', 'electrical', 'open', '2026-09-01', null),
  job('j5', 'Deep clean the reception', 'cleaning', 'open', '2026-09-02', null),
]
const REPAINT = {
  ...JOBS_49[1],
  description:
    'Two rooms on the second floor, roughly 40 square metres in total. Walls and ceilings, two coats. Existing furniture needs covering and moving back afterwards. Paint is already on site. Work must happen outside office hours, so weekday evenings or Saturday.',
  required_skills: ['Interior painting'],
  timeline: [
    { step: 'posted', at: '2026-08-24T09:00:00Z' },
    { step: 'assigned', at: '2026-08-26T09:00:00Z' },
    { step: 'accepted', at: '2026-08-30T09:00:00Z' },
    { step: 'submitted', at: null },
    { step: 'completed', at: null },
  ],
}
const GRACE_PROFILE = {
  reputation: { score: 4.53, ratings_component: 4.5, sentiment_component: 4.33, history_component: 5, review_count: 23, provisional: false },
  completed_jobs: 23,
}
const clientActions = (j) => {
  if (j.can_review) return { label: 'Leave review', to: '#' }
  if (j.status === 'open') return { label: 'Find workers', to: '#' }
  return { label: 'View details' }
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
    id: '4.9',
    title: 'Figure 4.9, job management, client (1440 x 1024)',
    render: () => (
      <Shell user={AMINA} onLogOut={noop} activeTo="/jobs">
        <PageTitle title="My Jobs" />
        <JobFilters filters={{ status: '', category: '', q: '' }} onChange={noop} />
        <JobsTable jobs={JOBS_49} selectedId="j2" party="worker" onSelect={noop} actionFor={clientActions} />
        <JobDetail job={REPAINT} viewerRole="client" partyProfile={GRACE_PROFILE} onClose={noop} />
      </Shell>
    ),
  },
  {
    id: '4.10',
    title: 'Figure 4.10, review submission (1440 x 1024)',
    render: () => (
      <Shell user={AMINA} onLogOut={noop} activeTo="/jobs">
        <PageTitle title="Leave a review" />
        <ReviewForm
          job={{ title: 'Replace office door locks' }}
          reviewee={{ name: 'Samuel Kariuki' }}
          revieweeRole="worker"
          completedAt="2026-08-20T09:00:00Z"
          values={{
            rating: 3,
            text: 'Samuel did the work and the locks are fine, but he arrived almost two hours late on the first day and I had to call twice to find out where he was. Once he was on site he was quick and tidy. I would use him again if the scheduling side improved.',
          }}
          errors={{}}
          onChange={noop}
          onSubmit={(event) => event.preventDefault()}
          onCancel={noop}
        />
      </Shell>
    ),
  },
  {
    id: 'job-actions',
    title: 'Job actions and Post a job, every state (not a figure)',
    render: () => (
      <Shell user={AMINA} onLogOut={noop} activeTo="/jobs">
        <PageTitle title="Job actions" />
        <PostJobPanel onPosted={noop} onClose={noop} />
        {[
          ['Client, open', 'client', { status: 'open' }],
          ['Client, assigned', 'client', { status: 'assigned', worker: GRACE }],
          ['Client, in progress, not submitted', 'client', { status: 'in_progress', worker: GRACE, submitted_at: null }],
          ['Client, work submitted', 'client', { status: 'in_progress', worker: GRACE, submitted_at: '2026-09-02T09:00:00Z' }],
          ['Client, completed, not reviewed', 'client', { status: 'completed', worker: GRACE }, true],
          ['Worker, assigned', 'worker', { status: 'assigned' }],
          ['Worker, in progress', 'worker', { status: 'in_progress', submitted_at: null }],
          ['Worker, submitted', 'worker', { status: 'in_progress', submitted_at: '2026-09-02T09:00:00Z' }],
          ['Worker, completed, reviewed', 'worker', { status: 'completed' }, false],
        ].map(([label, role, fields, canReview]) => (
          <section key={label}>
            <p>{label}</p>
            <JobActions job={{ ...REPAINT, ...fields }} role={role} canReview={canReview} onChanged={noop} />
          </section>
        ))}
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
