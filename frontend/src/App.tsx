import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import type { ReactNode } from 'react'
import Layout from './components/Layout'
import { LoginPage } from './pages/Login'
import { SignupPage } from './pages/Signup'
import GoogleCallback from './pages/GoogleCallback'
import Dashboard from './pages/Dashboard'
import Live from './pages/Live'
import Sessions from './pages/Sessions'
import Journal from './pages/Journal'
import Mood from './pages/Mood'
import Water from './pages/Water'
import Habits from './pages/Habits'
import Sleep from './pages/Sleep'
import Profile from './pages/Profile'
import Strategies from './pages/Strategies'
import Support from './pages/Support'
import { Spinner } from './components/ui'

const Analytics = lazy(() => import('./pages/Analytics'))

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullScreenSpinner />}>{children}</Suspense>
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <FullScreenSpinner />
  if (user) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnly>
                <SignupPage />
              </PublicOnly>
            }
          />
          <Route
            path="/auth/callback"
            element={
              <PublicOnly>
                <GoogleCallback />
              </PublicOnly>
            }
          />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/live" element={<Live />} />
            <Route path="/sessions" element={<Sessions />} />
            <Route path="/journal" element={<Journal />} />
            <Route path="/mood" element={<Mood />} />
            <Route path="/water" element={<Water />} />
            <Route path="/habits" element={<Habits />} />
            <Route path="/sleep" element={<Sleep />} />
            <Route path="/strategies" element={<Strategies />} />
            <Route path="/support" element={<Support />} />
            <Route
              path="/analytics"
              element={
                <LazyPage>
                  <Analytics />
                </LazyPage>
              }
            />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
