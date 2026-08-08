import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { AuthShell, AuthError } from './Login'
import { GoogleButton, OrDivider } from '../components/GoogleButton'

export function SignupPage() {
  const { signup } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await signup(email, password, displayName.trim() || undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create your EMORA" subtitle="Your private space for emotional clarity">
      <AuthError message={error} />
      <div className="mb-4 flex flex-col gap-3">
        <GoogleButton onError={setError} label="Continue with Google" />
        <OrDivider />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Display name</label>
          <input
            type="text"
            maxLength={50}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-cream placeholder:text-muted focus:border-aurora-indigo focus:outline-none"
            placeholder="How should we greet you? (e.g. Alex)"
          />
        </div>
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
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">Confirm password</label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-cream placeholder:text-muted focus:border-aurora-indigo focus:outline-none"
            placeholder="Repeat password"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="aurora-bg mt-2 rounded-xl px-4 py-3 text-sm font-semibold text-ink transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
