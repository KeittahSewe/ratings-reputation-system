import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { LoadingState } from './components/LoadingState.jsx'
import { AppLayout } from './layout/AppLayout.jsx'
import { AvailableJobsPage } from './pages/jobs/AvailableJobsPage.jsx'
import { InsightsPage } from './pages/insights/InsightsPage.jsx'
import { JobsPage } from './pages/jobs/JobsPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'
import { ProfilePage } from './pages/profile/ProfilePage.jsx'
import { FindWorkersPage } from './pages/recommendations/FindWorkersPage.jsx'
import { RecommendationsPage } from './pages/recommendations/RecommendationsPage.jsx'
import { UserProfilePage } from './pages/profile/UserProfilePage.jsx'
import { RegisterPage } from './pages/RegisterPage.jsx'
import { ReviewPage } from './pages/review/ReviewPage.jsx'
import { StatusPage } from './pages/StatusPage.jsx'
import { HomeRoute } from './routes/HomeRoute.jsx'
import { PublicOnly } from './routes/PublicOnly.jsx'
import { RequireAuth } from './routes/RequireAuth.jsx'
import { RoleRoute } from './routes/RoleRoute.jsx'

// Figure fixtures exist in development only. In a production build
// import.meta.env.DEV is false, so Vite drops this import and the route.
const DevFiguresPage = import.meta.env.DEV ? lazy(() => import('./dev/DevFiguresPage.jsx')) : null

// Routes. vercel.json sends every path to index.html, so each of these loads
// when opened or refreshed directly.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/status" element={<StatusPage />} />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <RegisterPage />
              </PublicOnly>
            }
          />
          {DevFiguresPage && (
            <Route
              path="/dev/figures/:figure?"
              element={
                <Suspense fallback={<LoadingState />}>
                  <DevFiguresPage />
                </Suspense>
              }
            />
          )}

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id/review" element={<ReviewPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/users/:id" element={<UserProfilePage />} />

              <Route element={<RoleRoute role="client" />}>
                <Route path="/find-workers" element={<FindWorkersPage />} />
                <Route path="/jobs/:id/recommendations" element={<RecommendationsPage />} />
              </Route>
              <Route element={<RoleRoute role="worker" />}>
                <Route path="/jobs/available" element={<AvailableJobsPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
