import { useCallback, useEffect, useState } from 'react'
import { Droplets, Flame, Target } from 'lucide-react'
import { api, postJSON } from '../lib/api'
import type { WaterHistoryItem, WaterToday } from '../lib/types'
import { Button, Card, Empty, Input, Label, Skeleton } from '../components/ui'

const GLASS_ML = 250

export default function Water() {
  const [today, setToday] = useState<WaterToday | null>(null)
  const [history, setHistory] = useState<WaterHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [showGoal, setShowGoal] = useState(false)

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([
        api<WaterToday>('/api/water/today'),
        api<{ history: WaterHistoryItem[]; streak?: number }>('/api/water'),
      ])
      setToday(t)
      setHistory(h.history)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load water data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const add = async (amount: number) => {
    setAdding(true)
    setError('')
    try {
      await postJSON('/api/water', { amount_ml: amount })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log water')
    } finally {
      setAdding(false)
    }
  }

  const goal = today?.goal_ml ?? 2000
  const pct = today?.percent ?? 0
  const week = history.slice(0, 7).reverse()

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Water</h1>
          <p className="text-sm text-muted">Hydration keeps the mind clear. Track your intake against your own goal.</p>
        </div>
        <div className="flex items-center gap-2">
          {today && today.streak ? (
            <span className="flex items-center gap-1 rounded-xl bg-aurora-teal/10 px-3 py-2 text-xs font-medium text-aurora-teal">
              <Flame className="h-4 w-4" /> {today.streak}-day streak
            </span>
          ) : null}
          <Button variant="outline" onClick={() => setShowGoal((v) => !v)}>
            <Target className="h-4 w-4 text-aurora-teal" /> Goal: {goal} ml
          </Button>
        </div>
      </header>

      {error && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{error}</p>}

      {showGoal && <GoalEditor initial={goal} onSaved={async () => { await load(); setShowGoal(false) }} onClose={() => setShowGoal(false)} />}

      <Card className="mb-6">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Droplets className="h-4 w-4 text-aurora-teal" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Today</h2>
          <span className="ml-auto font-mono text-sm text-muted">
            {today?.total_ml ?? 0} <span className="text-xs">/ {goal} ml</span>
          </span>
        </div>
        <div className="mt-5">
          <div className="h-3 overflow-hidden rounded-full bg-surface-3">
            <div className="aurora-bg h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <p className="mt-2 flex items-center gap-2 font-mono text-xs text-muted">
            <span>{today?.glasses ?? 0} glass{((today?.glasses ?? 0) === 1 ? '' : 'es')} logged</span>
            <span>·</span>
            <span>
              {typeof today?.remaining_ml === 'number' && today.remaining_ml > 0
                ? `${today.remaining_ml} ml remaining`
                : 'goal reached — nice work!'}
            </span>
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => add(GLASS_ML)} loading={adding} variant="outline" className="flex-1">
            <Droplets className="h-4 w-4 text-aurora-teal" /> +250 ml
          </Button>
          <Button onClick={() => add(500)} loading={adding} variant="outline" className="flex-1">
            <Droplets className="h-4 w-4 text-aurora-indigo" /> +500 ml
          </Button>
          <Button onClick={() => add(1000)} loading={adding} variant="outline" className="flex-1">
            <Droplets className="h-4 w-4 text-aurora-violet" /> +1000 ml
          </Button>
        </div>
        {today && today.entries.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Today's log</p>
            <div className="flex flex-col gap-1.5">
              {today.entries
                .slice()
                .reverse()
                .map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-xs">
                    <span className="text-muted">
                      {e.ts ? new Date(e.ts * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </span>
                    <span className="font-mono text-cream">{e.amount_ml} ml</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Droplets className="h-4 w-4 text-aurora-indigo" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Last 7 days</h2>
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-24" />
        ) : week.length === 0 ? (
          <Empty title="No water logged" />
        ) : (
          <div className="mt-4 flex items-end justify-between gap-3">
            {week.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted">{d.total_ml}</span>
                <div
                  className={`w-full rounded-t-md transition-all ${(d.percent ?? 0) >= 100 ? 'aurora-bg' : 'bg-surface-3'}`}
                  style={{ height: `${Math.max(8, Math.min(100, ((d.percent ?? 0) / 100) * 80))}px` }}
                />
                <span className="font-mono text-[10px] text-muted">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
        {history.length > 0 && (
          <p className="mt-3 text-xs text-muted">Bars filled to {goal} ml goal · full-height = 100% of goal.</p>
        )}
      </Card>
    </div>
  )
}

function GoalEditor({ initial, onSaved, onClose }: { initial: number; onSaved: () => void; onClose: () => void }) {
  const [value, setValue] = useState(String(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const ml = Number(value)
    if (!ml || ml < 100 || ml > 10000) {
      setError('Enter a goal between 100 and 10,000 ml.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await postJSON('/api/water/goal', { goal_ml: ml })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save goal')
      setSaving(false)
    }
  }

  return (
    <Card className="mb-6 border-aurora-teal/40">
      <p className="font-serif text-lg font-semibold">Daily water goal</p>
      <div className="mt-3 max-w-xs">
        <Label>Millilitres per day</Label>
        <Input type="number" min={100} max={10000} value={value} onChange={(e) => setValue(e.target.value)} />
        {error && <p className="mt-2 text-sm text-bad">{error}</p>}
        <div className="mt-3 flex gap-2">
          <Button onClick={submit} loading={saving}>
            Save goal
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  )
}
