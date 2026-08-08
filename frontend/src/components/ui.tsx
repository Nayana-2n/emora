import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { emotionColor, emotionEmoji, emotionLabel } from '../lib/emotions'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      {children}
    </div>
  )
}

export function Button({
  children,
  loading,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean
  variant?: 'primary' | 'ghost' | 'danger' | 'outline'
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent'
  const variants = {
    primary: 'aurora-bg text-ink font-semibold hover:brightness-110 active:scale-[0.98]',
    ghost: 'text-muted hover:text-cream hover:bg-surface-2',
    danger: 'bg-bad/10 text-bad hover:bg-bad/20',
    outline: 'border border-line text-cream hover:bg-surface-2',
  }
  return (
    <button className={`${base} ${variants[variant]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-cream focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  )
}

export function TextArea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted">{children}</label>
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-accent ${className}`} />
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 py-12 text-center">
      <p className="font-serif text-lg text-cream">{title}</p>
      {hint && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: ReactNode; sub?: string; tone?: 'default' | 'good' | 'bad' | 'warn' }) {
  const toneColor = { default: 'text-cream', good: 'text-good', bad: 'text-bad', warn: 'text-warn' }[tone]
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className={`font-mono text-2xl font-medium ${toneColor}`}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </Card>
  )
}

/** Calm three-dot shimmer used while EMORA is processing a turn. */
export function ThinkingDots({ color = 'var(--color-accent)' }: { color?: string }) {
  return (
    <span className="flex items-center gap-1" role="status" aria-label="EMORA is thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: color, animation: 'shimmer 1.4s ease-in-out infinite', animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </span>
  )
}

/** Emotion shown with colour AND a readable label/icon — never colour alone. */
export function EmotionBadge({
  emotion,
  className = '',
}: {
  emotion?: string | null
  className?: string
}) {
  const color = emotionColor(emotion)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${className}`}
      style={{ borderColor: `${color}55`, background: `${color}1f`, color }}
    >
      <span className="text-[11px]">{emotionEmoji(emotion)}</span>
      <span className="capitalize">{emotionLabel(emotion)}</span>
    </span>
  )
}

export function SectionTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
      {icon}
      {children}
    </div>
  )
}
