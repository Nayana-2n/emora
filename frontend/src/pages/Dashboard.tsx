import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Droplets, Moon, NotebookPen, Sparkles } from 'lucide-react'
import { api } from '../lib/api'
import type { DailyQuote, DayDetail, HabitToday, Overview, SleepToday, WaterToday } from '../lib/types'
import { Card, Empty, EmotionBadge, Skeleton, SectionTitle } from '../components/ui'
import { emotionColor } from '../lib/emotions'
import { useAuth } from '../lib/auth'

const LEVEL_LABEL: Record<string, string> = {
  thriving: 'Thriving',
  balanced: 'Balanced',
  struggling: 'Struggling',
  at_risk: 'At risk',
  no_data: 'No data yet',
}

const BURNOUT_LABEL: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  no_data: 'No data',
}

interface Report {
  metrics: {
    wellness: number
    burnout_score: number
    stress_percent: number
  }
  recommendation: string
}

function isoDate(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(100, percent)}%`, background: color ?? 'var(--color-accent)' }}
      />
    </div>
  )
}

function WellnessRing({ value, color, label }: { value: number | null; color: string; label: string }) {
  const pct = value ?? 0
  const r = 66
  const c = 2 * Math.PI * r
  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 152 152" className="h-full w-full -rotate-90">
        <circle cx="76" cy="76" r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="9" />
        <circle
          cx="76"
          cy="76"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ filter: `drop-shadow(0 0 10px ${color}66)`, transition: 'stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-7xl font-medium leading-none" style={{ color }}>
          {value === null ? '—' : value}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-widest text-muted">/ 100 · {label}</span>
      </div>
    </div>
  )
}

function Tile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {icon}
        {label}
      </div>
      {children}
    </Card>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [data, setData] = useState<Overview | null>(null)
  const [quote, setQuote] = useState<DailyQuote | null>(null)
  const [habits, setHabits] = useState<HabitToday | null>(null)
  const [water, setWater] = useState<WaterToday | null>(null)
  const [sleep, setSleep] = useState<SleepToday | null>(null)
  const [todayDetail, setTodayDetail] = useState<DayDetail | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Overview>('/api/analytics/overview')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
    api<DailyQuote>('/api/quotes/today')
      .then(setQuote)
      .catch(() => {})
    api<HabitToday>('/api/habits/today')
      .then(setHabits)
      .catch(() => {})
    api<WaterToday>('/api/water/today')
      .then(setWater)
      .catch(() => {})
    api<SleepToday>('/api/sleep/today')
      .then(setSleep)
      .catch(() => {})
    api<DayDetail>(`/api/analytics/day?date=${isoDate(0)}`)
      .then(setTodayDetail)
      .catch(() => {})
    api<Report>('/api/analytics/report')
      .then(setReport)
      .catch(() => {})
  }, [])

  if (error) {
    return (
      <Card>
        <Empty title="Could not load dashboard" hint={error} />
      </Card>
    )
  }

  const wellness = data?.wellness
  const burnout = data?.burnout
  const name = (user?.display_name || user?.email?.split('@')[0] || '').trim()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

  const dominantToday = Object.entries(todayDetail?.emotion_counts ?? {})
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const ringColor = emotionColor(dominantToday)
  const todayStress =
    todayDetail?.stress_series?.length
      ? todayDetail.stress_series[todayDetail.stress_series.length - 1].stress
      : burnout?.stress?.score ?? null

  const insight =
    report?.recommendation?.trim() ||
    (quote ? `“${quote.quote}” — ${quote.author}` : 'Small steps add up. Today is a new day.')

  const habitPct = habits?.total ? habits.percent : null
  const waterPct = water?.percent ?? null

  const quickLinks = [
    { to: '/journal', label: 'Write a journal', icon: BookOpen },
    { to: '/mood', label: 'Check in your mood', icon: NotebookPen },
    { to: '/strategies', label: 'Wellness strategies', icon: Sparkles },
  ]

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">
            {greeting}, <span className="text-accent">{name || 'friend'}</span>!
          </h1>
          <p className="mt-1 text-sm text-muted">A quiet look at how you are today.</p>
        </div>
        <Link
          to="/live"
          className="aurora-bg inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
        >
          <Sparkles className="h-4 w-4" /> Start live session <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      {!data && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="relative overflow-hidden lg:col-span-2">
              <div
                className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl"
                style={{ background: `radial-gradient(circle, ${ringColor}33, transparent 70%)` }}
              />
              <div className="flex flex-wrap items-center gap-8">
                <WellnessRing value={wellness?.overall ?? null} color={ringColor} label={LEVEL_LABEL[wellness?.level ?? 'no_data'] ?? wellness?.level} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-widest text-muted">Today at a glance</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EmotionBadge emotion={dominantToday} />
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-xs">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted">stress</span>
                      <span className={`font-mono ${(todayStress ?? 0) >= 70 ? 'text-stressed' : 'text-cream'}`}>
                        {todayStress ?? '—'}
                      </span>
                    </span>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-muted">
                    {data.counts.active_days > 0
                      ? `${data.counts.active_days} active days · ${data.counts.interactions} live turns · ${data.counts.journals} journal entries.`
                      : 'No sessions yet. Start a live session to begin your emotional record.'}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="flex flex-col justify-center">
              <SectionTitle>Today's quote</SectionTitle>
              {quote ? (
                <>
                  <p className="font-serif text-lg leading-relaxed">“{quote.quote}”</p>
                  <p className="mt-2 text-xs uppercase tracking-widest text-muted">— {quote.author}</p>
                </>
              ) : (
                <Skeleton className="h-16" />
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tile icon={<Droplets className="h-4 w-4 text-accent" />} label="Water">
              {water && water.total_ml > 0 ? (
                <>
                  <div className="flex items-end justify-between">
                    <span className="font-mono text-xl">{water.total_ml} ml</span>
                    <span className="font-mono text-xs text-muted">/ {water.goal_ml ?? 2000}</span>
                  </div>
                  <ProgressBar percent={waterPct ?? 0} color="var(--color-relaxed)" />
                  <p className="text-xs text-muted">
                    {waterPct}%{water.streak ? ` · ${water.streak}-day streak` : ''}
                  </p>
                </>
              ) : (
                <Empty title="No water yet" hint="Log your first glass." />
              )}
            </Tile>

            <Tile icon={<Moon className="h-4 w-4 text-accent" />} label="Sleep">
              {sleep?.recorded && sleep.hours != null ? (
                <>
                  <div className="flex items-end justify-between">
                    <span className="font-mono text-xl">{sleep.hours}h</span>
                    <span className="font-mono text-xs text-muted">quality {sleep.quality ?? '—'}/5</span>
                  </div>
                  <ProgressBar percent={Math.min(100, (sleep.hours / 9) * 100)} color="var(--color-sad)" />
                  <p className="text-xs text-muted">{sleep.quality_label ?? 'Logged last night'}</p>
                </>
              ) : (
                <Empty title="No sleep logged" hint="Record tonight's rest." />
              )}
            </Tile>

            <Tile icon={<BookOpen className="h-4 w-4 text-accent" />} label="Habits">
              {habits && habits.total > 0 ? (
                <>
                  <div className="flex items-end justify-between">
                    <span className="font-mono text-xl">
                      {habits.completed}<span className="text-muted">/{habits.total}</span>
                    </span>
                    <span className="font-mono text-xs text-muted">{habits.percent}%</span>
                  </div>
                  <ProgressBar percent={habitPct ?? 0} color="var(--color-accent)" />
                  <p className="truncate text-xs text-muted">
                    {habits.habits.filter((h) => h.completed).map((h) => h.name).slice(0, 3).join(' · ') || 'None completed yet'}
                  </p>
                </>
              ) : (
                <Empty title="No habits yet" hint="Create your first habit." />
              )}
            </Tile>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <SectionTitle>One thought for today</SectionTitle>
              <p className="font-serif text-lg leading-relaxed">{insight}</p>
            </Card>

            <Card>
              <SectionTitle>Your tools</SectionTitle>
              <div className="grid gap-2 sm:grid-cols-3">
                {quickLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-4 text-center transition hover:border-accent/40 hover:bg-surface-3"
                  >
                    <Icon className="h-5 w-5 text-accent" />
                    <span className="text-xs font-medium">{label}</span>
                  </Link>
                ))}
              </div>
              <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-mono text-[10px] uppercase tracking-widest">burnout</span>
                {burnout &&
                  Object.entries(burnout).map(([key, m]) => (
                    <span
                      key={key}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        m.level === 'high'
                          ? 'bg-stressed/15 text-stressed'
                          : m.level === 'medium'
                            ? 'bg-warn/15 text-warn'
                            : 'bg-relaxed/15 text-relaxed'
                      }`}
                    >
                      {key} {BURNOUT_LABEL[m.level] ?? m.level}
                    </span>
                  ))}
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
