import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FileDown, FlaskConical, LineChart as LineChartIcon } from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, apiBlob } from '../lib/api'
import type { Calendar, CalendarDay, DayDetail, EmotionsResponse, InsightsResponse, SleepToday, Trends, WaterToday } from '../lib/types'
import { Button, Card, Empty, Input, Skeleton } from '../components/ui'
import { EMOTION_EMOJI, emotionColor, emotionLabel, MOOD_DOT_BG } from '../lib/emotions'

const TREND_PERIODS = ['week', 'month', 'year'] as const
const EMOTION_PERIODS = ['day', 'week', 'month', 'year'] as const

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localISOMonth(d: Date): string {
  return localISODate(d).slice(0, 7)
}

const LEVEL_TONE: Record<string, string> = {
  strong: 'bg-relaxed/15 text-relaxed',
  moderate: 'bg-accent/15 text-accent',
  weak: 'bg-warn/15 text-warn',
  none: 'bg-surface-3 text-muted',
}

interface Report {
  metrics: {
    happy_percent: number
    sad_percent: number
    stress_percent: number
    fatigue_percent: number
    burnout: string
    burnout_score: number
    wellness: number
    wellness_level: string
    emotion_breakdown: Record<string, number>
  }
  recommendation: string
  generated_at: number
}

function BucketLabel(bucket: string): string {
  const parts = bucket.split('-')
  if (parts.length === 3) return new Date(bucket + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (bucket.includes('W')) return `W${bucket.split('W')[1]}`
  return bucket.split('-')[1] ?? bucket
}

/** Simple radial gauge (no pie). */
function RadialGauge({ value, color, label, sub }: { value: number; color: string; label: string; sub?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="var(--color-surface-3)" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (pct / 100) * c}
            style={{ filter: `drop-shadow(0 0 8px ${color}55)`, transition: 'stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-2xl font-medium">{value === 0 ? '—' : `${Math.round(value)}%`}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted">{sub}</span>
        </div>
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  )
}

export default function Analytics() {
  const [tab, setTab] = useState<'trends' | 'day' | 'calendar' | 'emotions' | 'insights'>('trends')
  const [period, setPeriod] = useState<(typeof TREND_PERIODS)[number]>('week')
  const [trends, setTrends] = useState<Trends | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [water, setWater] = useState<WaterToday | null>(null)
  const [sleep, setSleep] = useState<SleepToday | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState('')

  const loadTrends = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api<Trends>(`/api/analytics/trends?period=${period}`)
      setTrends(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trends')
    } finally {
      setLoading(false)
    }
  }, [period])

  useEffect(() => {
    loadTrends()
  }, [loadTrends])

  useEffect(() => {
    api<Report>('/api/analytics/report')
      .then(setReport)
      .catch(() => {})
    api<WaterToday>('/api/water/today')
      .then(setWater)
      .catch(() => {})
    api<SleepToday>('/api/sleep/today')
      .then(setSleep)
      .catch(() => {})
  }, [])

  const downloadPdf = async () => {
    setReportLoading(true)
    try {
      const blob = await apiBlob('/api/analytics/report.pdf')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'emora-report.pdf'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to download report')
    } finally {
      setReportLoading(false)
    }
  }

  const moodData = (trends?.buckets ?? []).map((b, i) => ({
    bucket: BucketLabel(b),
    stress: trends?.stress?.[i] ?? null,
    mood: trends?.mood?.[i] !== null && trends?.mood?.[i] !== undefined ? ((trends?.mood?.[i] ?? 0) / 5) * 100 : null,
  }))

  const habitData = (trends?.buckets ?? []).map((b, i) => ({
    bucket: BucketLabel(b),
    habits: trends?.habits?.[i] ?? 0,
  }))

  const waterPct = water?.percent ?? (water?.goal_ml ? Math.round(((water?.total_ml ?? 0) / water.goal_ml) * 100) : 0)
  const sleepPct = sleep?.hours != null ? Math.round((sleep.hours / 9) * 100) : 0

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl font-semibold">Analytics</h1>
          <p className="mt-1 text-sm text-muted">Your emotional patterns, made visible.</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'trends' && (
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1">
              {TREND_PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                    period === p ? 'aurora-bg text-ink' : 'text-muted hover:text-cream'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={downloadPdf} loading={reportLoading} className="px-3 py-1.5 text-xs">
            <FileDown className="h-4 w-4" /> PDF report
          </Button>
        </div>
      </header>

      <div className="mb-6 flex gap-1 rounded-xl border border-line bg-surface p-1">
        {(['trends', 'day', 'calendar', 'emotions', 'insights'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
              tab === t ? 'aurora-bg text-ink' : 'text-muted hover:text-cream'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{error}</p>}

      {tab === 'trends' && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <div className="mb-4 flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Stress vs Mood</h2>
              </div>
              {loading ? (
                <Skeleton className="h-56" />
              ) : moodData.every((d) => d.stress === null && d.mood === null) ? (
                <Empty title="No session data" hint="Use the live session to generate signals." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={moodData}>
                    <defs>
                      <linearGradient id="stress" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E5626C" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#E5626C" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="mood" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E3C08D" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#E3C08D" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" stroke="var(--color-muted)" fontSize={10} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="var(--color-muted)" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-line)', borderRadius: 12 }}
                      labelStyle={{ color: 'var(--color-cream)' }}
                    />
                    <Area type="monotone" dataKey="stress" stroke="#E5626C" fill="url(#stress)" strokeWidth={2} />
                    <Area type="monotone" dataKey="mood" stroke="#E3C08D" fill="url(#mood)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card>
              <div className="mb-4 flex items-center gap-2">
                <LineChartIcon className="h-4 w-4 text-accent" />
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Habit consistency</h2>
              </div>
              {loading ? (
                <Skeleton className="h-56" />
              ) : habitData.every((d) => d.habits === 0) ? (
                <Empty title="No habit data" hint="Log your habits to see completion." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={habitData} layout="vertical">
                    <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="var(--color-muted)" fontSize={10} tickLine={false} />
                    <YAxis type="category" dataKey="bucket" width={46} stroke="var(--color-muted)" fontSize={10} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(232,160,160,0.08)' }}
                      contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-line)', borderRadius: 12 }}
                      labelStyle={{ color: 'var(--color-cream)' }}
                      formatter={(v) => [`${Math.round(Number(v))}%`, 'completed']}
                    />
                    <Bar dataKey="habits" fill="var(--color-accent)" radius={[0, 6, 6, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Card className="flex items-center justify-center">
              <RadialGauge value={waterPct} color="#A8C4A2" label="Water today" sub={water ? `${water.total_ml}/${water.goal_ml ?? 2000} ml` : 'no goal'} />
            </Card>
            <Card className="flex items-center justify-center">
              <RadialGauge value={sleepPct} color="#6B8CAE" label="Sleep tonight" sub={sleep?.hours != null ? `${sleep.hours}h` : 'no record'} />
            </Card>
          </div>

          <Card className="mt-4">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Wellness report</h2>
            {report ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-surface-2 p-3 text-center">
                    <p className="font-mono text-lg">{report.metrics.wellness}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted">wellness</p>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3 text-center">
                    <p className="font-mono text-lg">{report.metrics.burnout_score}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted">burnout</p>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-3 text-center">
                    <p className="font-mono text-lg">{report.metrics.stress_percent}%</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted">stress</p>
                  </div>
                </div>
                <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm leading-relaxed text-cream">
                  {report.recommendation}
                </p>
                <p className="font-mono text-[10px] text-muted">Generated {new Date(report.generated_at * 1000).toLocaleString()}</p>
              </div>
            ) : (
              <Empty title="No report yet" hint="Gather a little more data, then refresh." />
            )}
          </Card>
        </>
      )}

      {tab === 'day' && <DayView />}
      {tab === 'calendar' && <CalendarView />}
      {tab === 'emotions' && <EmotionsView />}
      {tab === 'insights' && <InsightsView />}
    </div>
  )
}

function EmotionBreakdown({ data }: { data: Record<string, number> }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1])
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Emotion breakdown</h2>
      {rows.length === 0 ? (
        <Empty title="No emotions recorded" hint="Face and voice signals from live sessions appear here." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map(([name, val]) => {
            const c = emotionColor(name)
            return (
              <div key={name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 capitalize text-cream">
                    <span>{EMOTION_EMOJI[name] ?? '😐'}</span> {emotionLabel(name)}
                  </span>
                  <span className="font-mono text-muted">{val}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, val)}%`, background: c }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}

function DayView({ value, onChange }: { value?: string; onChange?: (d: string) => void }) {
  const [internalDate, setInternalDate] = useState(localISODate(new Date()))
  const date = value ?? internalDate
  const setDate = (d: string) => {
    if (onChange) onChange(d)
    else setInternalDate(d)
  }
  const [day, setDay] = useState<DayDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (d: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await api<DayDetail>(`/api/analytics/day?date=${d}`)
      setDay(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load day')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(date)
  }, [load, date])

  const stressData = (day?.stress_series ?? []).map((p) => ({
    label: new Date(p.ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
    stress: p.stress,
  }))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Day detail</h2>
          </div>
          <div className="max-w-[200px]">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-40" />
        ) : error ? (
          <p className="mt-4 text-sm text-bad">{error}</p>
        ) : day ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DayStat label="Mood" value={day.mood !== null && day.mood !== undefined ? `${day.mood}/5` : '—'} sub={day.mood_note} />
            <DayStat
              label="Emotions"
              value={Object.keys(day.emotion_counts ?? {}).length ? `${Object.values(day.emotion_counts ?? {}).reduce((a, b) => a + b, 0)} samples` : '—'}
              sub={Object.keys(day.emotion_counts ?? {}).map((k) => `${EMOTION_EMOJI[k] ?? ''} ${emotionLabel(k)}`).join(', ') || 'none recorded'}
            />
            <DayStat
              label="Habits"
              value={day.habits ? `${day.habits.completed}/${day.habits.total}` : '—'}
              sub={day.habits ? `${day.habits.percent}%` : 'not tracked'}
            />
            <DayStat
              label="Water"
              value={`${day.water.total_ml} ml`}
              sub={day.water.goal_ml ? `${day.water.percent}% of ${day.water.goal_ml} ml goal` : 'no goal set'}
            />
            {day.sleep && <DayStat label="Sleep" value={`${day.sleep.hours}h`} sub={`quality ${day.sleep.quality}/5`} />}
            <DayStat
              label="Journals"
              value={day.journals.length}
              sub={day.journals.map((j) => j.section === 'tomorrow_story' ? '🌅' : '🌤').join(' ') || 'none'}
            />
          </div>
        ) : (
          <Empty title="No data for this day" />
        )}
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Stress through the day</h2>
        {stressData.length === 0 ? (
          <Empty title="No stress samples" hint="Live sessions with voice analysis record stress over time." />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={stressData}>
              <defs>
                <linearGradient id="dayStress" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E5626C" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#E5626C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="var(--color-muted)" fontSize={10} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="var(--color-muted)" fontSize={10} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-line)', borderRadius: 12 }}
                labelStyle={{ color: 'var(--color-cream)' }}
              />
              <Area type="monotone" dataKey="stress" stroke="#E5626C" fill="url(#dayStress)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {day && day.sessions.length > 0 && (
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Sessions</h2>
          <div className="flex flex-col gap-2">
            {day.sessions.map((s, i) => (
              <div key={i} className="rounded-xl bg-surface-2 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-muted">
                    {s.ts ? new Date(s.ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                  {s.emotion && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 capitalize text-cream">
                      <span>{EMOTION_EMOJI[s.emotion] ?? '😐'}</span> {emotionLabel(s.emotion)}
                    </span>
                  )}
                  {typeof s.stress === 'number' && <span className="font-mono text-muted">stress {s.stress}</span>}
                  {s.modalities && s.modalities.length > 0 && (
                    <span className="text-muted">via {s.modalities.join(', ')}</span>
                  )}
                </div>
                {s.transcript && <p className="mt-1 truncate text-xs italic text-muted">“{s.transcript}”</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function DayStat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg text-cream">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-muted" title={sub}>{sub}</p>}
    </div>
  )
}

function dayTitle(day?: CalendarDay): string {
  if (!day) return ''
  const parts: string[] = []
  if (day.emotion) parts.push(`Emotion: ${day.emotion}`)
  if (day.mood !== null && day.mood !== undefined) parts.push(`Mood: ${day.mood}/5`)
  if (day.stress !== null && day.stress !== undefined) parts.push(`Stress: ${day.stress}`)
  if (day.journal) parts.push(`Journal: ${day.journal.title}`)
  return parts.join('\n')
}

function DayCell({
  date,
  day,
  selected,
  isToday,
  onSelect,
}: {
  date: string
  day?: CalendarDay
  selected: boolean
  isToday: boolean
  onSelect: (d: string) => void
}) {
  const mood = day?.mood !== null && day?.mood !== undefined ? day!.mood : null
  return (
    <button
      onClick={() => onSelect(date)}
      title={dayTitle(day)}
      aria-label={date}
      className={`flex min-h-[64px] flex-col items-center gap-0.5 rounded-xl border p-1.5 transition ${
        selected
          ? 'border-accent bg-accent/15'
          : isToday
            ? 'border-accent-2/70 bg-surface-2'
            : 'border-line bg-surface-2 hover:border-accent/60'
      }`}
    >
      <span className="flex w-full items-center justify-between">
        <span className={`font-mono text-[11px] ${isToday ? 'font-bold text-accent' : 'text-muted'}`}>
          {Number(date.slice(8, 10))}
        </span>
        {mood !== null && <span className={`h-1.5 w-1.5 rounded-full ${MOOD_DOT_BG[mood] ?? 'bg-muted'}`} />}
      </span>
      <span className="flex flex-1 items-center justify-center text-lg leading-none">
        {day?.emotion ? (EMOTION_EMOJI[day.emotion] ?? '😐') : <span className="text-[10px] text-muted/40">•</span>}
      </span>
      <span className="flex min-h-[14px] items-center gap-1 text-[9px] text-muted">
        {day?.stress !== null && day?.stress !== undefined && <span>S{day.stress}</span>}
        {day?.journal && <span>🌤</span>}
      </span>
    </button>
  )
}

function CalendarView() {
  const [month, setMonth] = useState(localISOMonth(new Date()))
  const [cal, setCal] = useState<Calendar | null>(null)
  const [selected, setSelected] = useState(localISODate(new Date()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await api<Calendar>(`/api/analytics/calendar?month=${m}`)
      setCal(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(month)
  }, [load, month])

  const goMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    const nm = localISOMonth(d)
    setMonth(nm)
    setSelected(`${nm}-01`)
  }

  const goToday = () => {
    const now = new Date()
    setMonth(localISOMonth(now))
    setSelected(localISODate(now))
  }

  const byDate = new Map((cal?.days ?? []).map((d) => [d.date, d]))
  const [year, mIdx] = month.split('-').map(Number)
  const first = new Date(year, mIdx - 1, 1)
  const leading = first.getDay()
  const daysInMonth = new Date(year, mIdx, 0).getDate()
  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ]
  const todayStr = localISODate(new Date())
  const hasData = (cal?.days ?? []).some((d) => d.emotion || d.mood !== null || d.stress !== null || d.journal)
  const monthLabel = new Date(year, mIdx - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Mood calendar</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goMonth(-1)}
              className="rounded-lg border border-line bg-surface-2 p-2 text-muted transition hover:text-cream"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-muted transition hover:text-cream"
            >
              Today
            </button>
            <button
              onClick={() => goMonth(1)}
              className="rounded-lg border border-line bg-surface-2 p-2 text-muted transition hover:text-cream"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="mt-1 font-serif text-lg text-cream">{monthLabel}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-happy" /> great</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-relaxed" /> good</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-neutral" /> neutral</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-stressed" /> low</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-angry" /> very low</span>
          <span className="flex items-center gap-1">😄 emotion</span>
          <span className="flex items-center gap-1">S20 stress</span>
          <span className="flex items-center gap-1">🌤/🌅 journal</span>
        </div>

        {loading ? (
          <Skeleton className="mt-4 h-72" />
        ) : error ? (
          <p className="mt-4 text-sm text-bad">{error}</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => (
                <div key={d} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {d}
                </div>
              ))}
              {cells.map((c, i) =>
                c ? (
                  <DayCell
                    key={i}
                    date={c}
                    day={byDate.get(c)}
                    selected={c === selected}
                    isToday={c === todayStr}
                    onSelect={setSelected}
                  />
                ) : (
                  <div key={i} />
                ),
              )}
            </div>
            {!hasData && (
              <Empty title="No records this month" hint="Moods, journal entries and live-session emotions will show here." />
            )}
          </>
        )}
      </Card>
      <DayView value={selected} onChange={setSelected} />
    </div>
  )
}

function EmotionsView() {
  const [period, setPeriod] = useState<(typeof EMOTION_PERIODS)[number]>('week')
  const [data, setData] = useState<EmotionsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api<EmotionsResponse>(`/api/analytics/emotions?period=${period}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [period])

  const allEmotions = Array.from(
    new Set([
      ...Object.keys(data?.total_counts ?? {}),
      ...(data?.buckets ?? []).flatMap((b) => Object.keys(b.counts ?? {})),
    ]),
  )

  const barData = (data?.buckets ?? []).map((b) => ({
    bucket: BucketLabel(b.bucket),
    ...(Object.fromEntries(allEmotions.map((e) => [e, b.counts?.[e] ?? 0]))),
  }))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Emotions over time</h2>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1">
            {EMOTION_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                  period === p ? 'aurora-bg text-ink' : 'text-muted hover:text-cream'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-56" />
        ) : barData.length === 0 || allEmotions.length === 0 ? (
          <Empty title="No emotions in this period" hint="Face and voice signals from live sessions appear here." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
              <XAxis dataKey="bucket" stroke="var(--color-muted)" fontSize={10} tickLine={false} />
              <YAxis allowDecimals={false} stroke="var(--color-muted)" fontSize={10} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(232,160,160,0.08)' }}
                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-line)', borderRadius: 12 }}
                labelStyle={{ color: 'var(--color-cream)' }}
              />
              {allEmotions.map((e, i) => (
                <Bar key={e} dataKey={e} stackId="e" fill={emotionColor(e)} radius={i === allEmotions.length - 1 ? [4, 4, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <EmotionBreakdown data={data?.distribution ?? {}} />
    </div>
  )
}

function InsightsView() {
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<InsightsResponse>('/api/analytics/insights')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton className="h-40" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Your patterns</h2>
      </div>
      <p className="-mt-2 text-xs text-muted">
        Correlations found in your own data. They show possible connections — never proof of cause and effect.
      </p>
      {data && data.insights.length > 0 ? (
        data.insights.map((ins) => (
          <Card key={ins.title}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-serif text-lg font-semibold">{ins.title}</h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${LEVEL_TONE[ins.level] ?? LEVEL_TONE.none}`}>
                {ins.level}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-cream">{ins.statement}</p>
            <p className="mt-2 font-mono text-[10px] text-muted">{ins.samples} data points</p>
          </Card>
        ))
      ) : (
        <Card>
          <Empty title="No insights yet" hint="Use the app for a few days — the patterns need data to appear." />
        </Card>
      )}
    </div>
  )
}
