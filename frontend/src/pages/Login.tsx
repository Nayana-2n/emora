import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { GoogleButton, OrDivider } from '../components/GoogleButton'
import { Logo } from '../components/Logo'

export function AuthShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[460px] w-[760px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #E8A0A0, rgba(232,160,160,0.15), transparent)' }}
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo size={56} />
          <h1 className="font-serif text-3xl font-semibold">{title}</h1>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        <div className="glass rounded-3xl p-7">{children}</div>
        <p className="mt-6 text-center font-mono text-[11px] text-muted">emora · reading emotional weather</p>
      </div>
    </div>
  )
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null
  return <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{message}</p>
}

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Continue your journey to emotional clarity">
      <AuthError message={error} />
      <div className="mb-4 flex flex-col gap-3">
        <GoogleButton onError={setError} label="Continue with Google" />
        <OrDivider />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-cream placeholder:text-muted focus:border-aurora-indigo focus:outline-none"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-cream placeholder:text-muted focus:border-aurora-indigo focus:outline-none"
            placeholder="••••••••"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="aurora-bg mt-2 rounded-xl px-4 py-3 text-sm font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-muted">
          New here?{' '}
          <Link to="/signup" className="text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
