import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { RegisterPlaceholder } from './pages/RegisterPlaceholder.jsx'
import { SignedInPlaceholder } from './pages/SignedInPlaceholder.jsx'
import { StatusPage } from './pages/StatusPage.jsx'
import { PublicOnly } from './routes/PublicOnly.jsx'
import { RequireAuth } from './routes/RequireAuth.jsx'

// Routes. vercel.json sends every path to index.html, so each of these loads
// when opened or refreshed directly.
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
                <RegisterPlaceholder />
              </PublicOnly>
            }
          />
          <Route element={<RequireAuth />}>
            <Route path="*" element={<SignedInPlaceholder />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
