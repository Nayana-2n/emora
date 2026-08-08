import { useCallback, useEffect, useState } from 'react'
import { Moon } from 'lucide-react'
import { api, postJSON } from '../lib/api'
import type { SleepDoc, SleepToday } from '../lib/types'
import { Button, Card, Empty, Input, Label, Skeleton } from '../components/ui'

const QUALITY = [
  { value: 1, label: 'Very bad' },
  { value: 2, label: 'Bad' },
  { value: 3, label: 'Okay' },
  { value: 4, label: 'Good' },
  { value: 5, label: 'Great' },
]

export default function Sleep() {
  const [today, setToday] = useState<SleepToday | null>(null)
  const [history, setHistory] = useState<SleepDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [hours, setHours] = useState('')
  const [quality, setQuality] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([
        api<SleepToday>('/api/sleep/today'),
        api<{ entries: SleepDoc[] }>('/api/sleep'),
      ])
      setToday(t)
      setHistory(h.entries)
      if (t.recorded) {
        setHours(t.hours !== null ? String(t.hours) : '')
        setQuality(t.quality)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sleep data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    const h = parseFloat(hours)
    if (isNaN(h) || !quality) return
    setSaving(true)
    setError('')
    try {
      await postJSON('/api/sleep', { hours: h, quality })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save sleep')
    } finally {
      setSaving(false)
    }
  }

  const week = history.slice(0, 7).reverse()

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold">Sleep</h1>
        <p className="text-sm text-muted">Rest is not a reward. It is a need.</p>
      </header>

      {error && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{error}</p>}

      <Card className="mb-6">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Moon className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Last night</h2>
          {today?.recorded && <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-good">logged</span>}
        </div>
        {loading ? (
          <Skeleton className="mt-4 h-32" />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Hours of sleep</Label>
              <Input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 7.5"
              />
            </div>
            <div>
              <Label>Quality</Label>
              <div className="flex gap-1.5">
                {QUALITY.map((q) => (
                  <button
                    key={q.value}
                    onClick={() => setQuality(q.value)}
                    title={q.label}
                    className={`flex-1 rounded-xl border p-2 text-center text-[11px] transition ${
                      quality === q.value ? 'aurora-bg border-transparent font-semibold text-ink' : 'border-line bg-surface-2 text-muted hover:text-cream'
                    }`}
                  >
                    {q.value}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <Button
            onClick={save}
            loading={saving}
            disabled={isNaN(parseFloat(hours)) || !quality}
          >
            {today?.recorded ? 'Update' : 'Save sleep'}
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Last 7 days</h2>
        {loading ? (
          <Skeleton className="h-24" />
        ) : week.length === 0 ? (
          <Empty title="No sleep logged yet" />
        ) : (
          <div className="flex items-end justify-between gap-3">
            {week.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted">{d.hours}h</span>
                <div
                  className="w-full rounded-t-md transition-all"
                  style={{
                    height: `${Math.max(10, Math.min(90, (d.hours / 9) * 90))}px`,
                    background:
                      d.hours >= 7 ? 'var(--color-aurora-teal)' : d.hours >= 6 ? 'var(--color-aurora-indigo)' : 'var(--color-bad)',
                  }}
                />
                <span className="font-mono text-[10px] text-muted">
                  {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
