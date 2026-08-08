import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { AuthShell } from './Login'

export default function GoogleCallback() {
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const token = new URLSearchParams(window.location.search).get('token')
    if (!token) {
      setError('Google Sign-In did not return a session. Please try again.')
      return
    }
    loginWithToken(token)
      .then(() => {
        if (!cancelled) navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        if (!cancelled) setError('Google Sign-In failed. Please try again.')
      })
    return () => {
      cancelled = true
    }
  }, [loginWithToken, navigate])

  return (
    <AuthShell title="Signing you in" subtitle="One moment…">
      {error && (
        <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{error}</p>
      )}
      {!error && <p className="text-center text-sm text-muted">Completing Google sign-in…</p>}
      {error && (
        <Link to="/login" className="mt-4 block text-center text-sm text-aurora-teal hover:underline">
          Back to login
        </Link>
      )}
    </AuthShell>
  )
}
