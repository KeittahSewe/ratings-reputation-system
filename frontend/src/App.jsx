import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { LoadingState } from './components/LoadingState.jsx'
import { AppLayout } from './layout/AppLayout.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { NotFoundPage } from './pages/NotFoundPage.jsx'
import { PlaceholderPage } from './pages/PlaceholderPage.jsx'
import { RegisterPage } from './pages/RegisterPage.jsx'
import { StatusPage } from './pages/StatusPage.jsx'
import { PublicOnly } from './routes/PublicOnly.jsx'
import { RequireAuth } from './routes/RequireAuth.jsx'
import { RoleRoute } from './routes/RoleRoute.jsx'

// Figure fixtures exist in development only. In a production build
// import.meta.env.DEV is false, so Vite drops this import and the route.
const DevFiguresPage = import.meta.env.DEV ? lazy(() => import('./dev/DevFiguresPage.jsx')) : null

// Routes. vercel.json sends every path to index.html, so each of these loads
// when opened or refreshed directly. Each placeholder names the issue that
// builds its screen.
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
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
              <Route index element={<Navigate to="/jobs" replace />} />
              <Route path="/jobs" element={<PlaceholderPage title="My Jobs" figure="4.9" issue={87} />} />
              <Route path="/jobs/:id/review" element={<PlaceholderPage title="Leave a review" figure="4.10" issue={88} />} />
              <Route path="/insights" element={<PlaceholderPage title="Insights" figure="4.12" issue={90} />} />
              <Route path="/profile" element={<PlaceholderPage title="Profile" figure="4.7 or 4.8" issue={85} />} />
              <Route path="/users/:id" element={<PlaceholderPage title="Profile" figure="4.7 or 4.8" issue={86} />} />

              <Route element={<RoleRoute role="client" />}>
                <Route path="/find-workers" element={<PlaceholderPage title="Find Workers" figure="4.11" issue={89} />} />
                <Route
                  path="/jobs/:id/recommendations"
                  element={<PlaceholderPage title="Recommended workers" figure="4.11" issue={89} />}
                />
              </Route>
              <Route element={<RoleRoute role="worker" />}>
                <Route path="/jobs/available" element={<PlaceholderPage title="Available Jobs" figure="4.9" issue={87} />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
