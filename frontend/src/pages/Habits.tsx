import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  Calendar,
  Flame,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  X,
} from 'lucide-react'
import { api, postJSON } from '../lib/api'
import type { HabitDaySummary, HabitDef, HabitToday } from '../lib/types'
import { Button, Card, Empty, Input, Label, Skeleton, Select } from '../components/ui'

const CATEGORIES = ['health', 'education', 'fitness', 'productivity', 'personal', 'social', 'other']
const PRIORITIES = [
  { value: 1, label: 'High' },
  { value: 2, label: 'Medium' },
  { value: 3, label: 'Low' },
]
const CATEGORY_EMOJI: Record<string, string> = {
  health: '🌿',
  education: '📚',
  fitness: '💪',
  productivity: '⚡',
  personal: '🌸',
  social: '🤝',
  other: '✨',
}

export default function Habits() {
  const [today, setToday] = useState<HabitToday | null>(null)
  const [defs, setDefs] = useState<HabitDef[]>([])
  const [days, setDays] = useState<HabitDaySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([
        api<HabitToday>('/api/habits/today'),
        api<{ habits: HabitDef[]; days: HabitDaySummary[] }>('/api/habits'),
      ])
      setToday(t)
      setDefs(h.habits)
      setDays(h.days ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load habits')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const toggle = async (id: string) => {
    setError('')
    try {
      await postJSON(`/api/habits/${id}/toggle`, {})
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle habit')
    }
  }

  const remove = async (id: string) => {
    setError('')
    try {
      await api(`/api/habits/${id}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete habit')
    }
  }

  const week = days.slice(0, 7).reverse()

  const monthSummary = (() => {
    const byMonth = new Map<string, { label: string; completed: number; total: number; days: number }>()
    for (const d of days) {
      const key = d.date.slice(0, 7)
      const rec = byMonth.get(key) ?? {
        label: new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        completed: 0,
        total: 0,
        days: 0,
      }
      rec.completed += d.completed
      rec.total += d.total
      rec.days += 1
      byMonth.set(key, rec)
    }
    return [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
  })()

  const monthPct = (rec: { completed: number; total: number }) =>
    rec.total > 0 ? Math.round((rec.completed / rec.total) * 1000) / 10 : 0

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Habits</h1>
          <p className="text-sm text-muted">Build your own routine. Small daily actions compound into wellbeing.</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> New habit
        </Button>
      </header>

      {error && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{error}</p>}

      {showAdd && <AddHabit onDone={async () => { await load(); setShowAdd(false) }} onClose={() => setShowAdd(false)} />}

      <Card className="mb-6">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Target className="h-4 w-4 text-aurora-indigo" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Today</h2>
          {today && today.total > 0 && (
            <span className="ml-auto font-mono text-xs text-muted">
              {today.completed}/{today.total} · {today.percent}%
            </span>
          )}
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-40" />
        ) : today && today.total > 0 ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {today.habits.map((h) => (
                <button
                  key={h.id}
                  onClick={() => toggle(h.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${
                    h.completed ? 'aurora-bg border-transparent text-ink' : 'border-line bg-surface-2 text-cream hover:bg-surface-3'
                  }`}
                >
                  <span className="text-xl">{CATEGORY_EMOJI[h.category ?? 'other'] ?? '✨'}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{h.name}</span>
                    {h.description && <span className="block truncate text-xs text-muted">{h.description}</span>}
                  </span>
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      h.priority === 1 ? 'bg-bad/15 text-bad' : h.priority === 3 ? 'bg-good/15 text-good' : 'bg-warn/15 text-warn'
                    }`}
                  >
                    {h.priority === 1 ? 'High' : h.priority === 2 ? 'Med' : 'Low'}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">Tap a habit to mark it done for today.</p>
          </>
        ) : (
          <Empty title="No habits yet" hint="Create your first habit and start a streak." />
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Flame className="h-4 w-4 text-aurora-teal" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Last 7 days</h2>
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-24" />
        ) : week.length === 0 ? (
          <Empty title="No habits logged yet" />
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {week.map((d) => (
              <div key={d.date} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span className="text-sm">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                    <div className="aurora-bg h-full rounded-full" style={{ width: `${d.percent}%` }} />
                  </div>
                  <span className="font-mono text-xs text-muted">
                    {d.completed}/{d.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Calendar className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Monthly view</h2>
          {days.length > 0 && <span className="ml-auto font-mono text-xs text-muted">{days.length} days recorded</span>}
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-24" />
        ) : monthSummary.length === 0 ? (
          <Empty title="No habit history yet" hint="Your monthly breakdown appears here." />
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {monthSummary.map(([key, rec]) => (
              <div key={key} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                <span className="text-sm">{rec.label}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
                    <div className="aurora-bg h-full rounded-full" style={{ width: `${monthPct(rec)}%` }} />
                  </div>
                  <span className="font-mono text-xs text-muted">
                    {rec.completed}/{rec.total} · {monthPct(rec)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Activity className="h-4 w-4 text-aurora-violet" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">My habits</h2>
          {defs.length > 0 && <span className="ml-auto font-mono text-xs text-muted">{defs.length} total</span>}
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-24" />
        ) : defs.length === 0 ? (
          <Empty title="No habits yet" hint="Create your first habit to get started." />
        ) : (
          <div className="mt-4 flex flex-col gap-2">
            {defs.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5">
                <span className="text-xl">{CATEGORY_EMOJI[h.category ?? 'other'] ?? '✨'}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{h.name}</span>
                    <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {h.category}
                    </span>
                  </div>
                  {h.description && <p className="truncate text-xs text-muted">{h.description}</p>}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="hidden items-center gap-1 sm:flex" title="Current streak">
                    <Flame className="h-3.5 w-3.5 text-aurora-teal" /> {h.streak ?? 0}d
                  </span>
                  <span className="hidden items-center gap-1 md:flex" title="Longest streak">
                    <Trophy className="h-3.5 w-3.5 text-aurora-violet" /> {h.longest_streak ?? 0}d
                  </span>
                  <span className="hidden items-center gap-1 sm:flex" title="Completion rate">
                    <TrendingUp className="h-3.5 w-3.5 text-aurora-indigo" /> {h.completion_percent ?? 0}%
                  </span>
                  <button
                    onClick={() => remove(h.id)}
                    className="rounded-lg p-1.5 text-muted transition hover:bg-bad/15 hover:text-bad"
                    title="Delete habit"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function AddHabit({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('health')
  const [priority, setPriority] = useState(2)
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) {
      setError('Please give your habit a name.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await postJSON('/api/habits', {
        name: name.trim(),
        category,
        priority,
        description: description.trim(),
        frequency: frequency.trim(),
      })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create habit')
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6 border-aurora-indigo/40">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg font-semibold">New habit</h3>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted transition hover:bg-surface-2 hover:text-cream">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 10-minute morning stretch" autoFocus />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_EMOJI[c]} {c}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Priority</Label>
          <Select value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Description (optional)</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why it matters to you" />
        </div>
        <div>
          <Label>Frequency (optional)</Label>
          <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} placeholder="e.g. daily" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={submit} loading={saving}>
          <Plus className="h-4 w-4" /> Create habit
        </Button>
      </div>
    </Card>
  )
}
