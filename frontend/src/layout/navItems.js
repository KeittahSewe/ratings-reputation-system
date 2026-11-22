// Sidebar items per role. Figures 4.7 to 4.12 also show Dashboard, Reviews
// and (for workers) Skills; those have no screen of their own, so they are
// left out (change log, 22 November): reviews received sit on the profile,
// reviews to write are reached from My Jobs, and skills are edited on the
// worker profile.
export const NAV_ITEMS = {
  client: [
    { to: '/jobs', label: 'My Jobs', end: true },
    { to: '/find-workers', label: 'Find Workers' },
    { to: '/insights', label: 'Insights' },
    { to: '/profile', label: 'Profile' },
  ],
  worker: [
    { to: '/jobs/available', label: 'Available Jobs' },
    { to: '/jobs', label: 'My Jobs', end: true },
    { to: '/insights', label: 'Insights' },
    { to: '/profile', label: 'Profile' },
  ],
}

export const ROLE_LABELS = { client: 'Client', worker: 'Worker' }
