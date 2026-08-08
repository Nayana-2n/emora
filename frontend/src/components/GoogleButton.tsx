import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { api } from '../lib/api'

function GoogleG({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

export function GoogleButton({
  onError,
  label = 'Continue with Google',
}: {
  onError?: (message: string) => void
  label?: string
}) {
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const redirect = encodeURIComponent(window.location.origin + '/auth/callback')
      const res = await api<{ url: string }>('/api/auth/google/login?redirect=' + redirect)
      window.location.href = res.url
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Google Sign-In failed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={start}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-cream transition hover:bg-surface-3 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleG />}
      {busy ? 'Redirecting to Google…' : label}
    </button>
  )
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-[11px] font-mono uppercase tracking-widest text-muted">
      <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
    </div>
  )
}
