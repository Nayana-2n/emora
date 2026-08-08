import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { api, postJSON } from '../lib/api'
import type { MoodDoc, MoodToday } from '../lib/types'
import { Button, Card, Empty, Skeleton, TextArea } from '../components/ui'
import { moodColor } from '../lib/emotions'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Very low', color: '#C4453F' },
  { value: 2, emoji: '😕', label: 'Low', color: '#E5626C' },
  { value: 3, emoji: '😐', label: 'Neutral', color: '#8A9099' },
  { value: 4, emoji: '🙂', label: 'Good', color: '#A8C4A2' },
  { value: 5, emoji: '😄', label: 'Great', color: '#E3C08D' },
]

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function MoodHeatmap({ history }: { history: MoodDoc[] }) {
  const byDate = new Map(history.map((d) => [d.date, d]))
  const weeks = 15
  const boxRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ left: number; top: number; date: string; mood: number } | null>(null)

  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - end.getDay() - (weeks - 1) * 7)

  const cols: { date: string; mood: number | null }[][] = []
  for (let w = 0; w < weeks; w++) {
    const col: { date: string; mood: number | null }[] = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start)
      dt.setDate(start.getDate() + w * 7 + d)
      const ds = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
      col.push({ date: ds, mood: byDate.get(ds)?.mood ?? null })
    }
    cols.push(col)
  }

  const showTip = (e: React.MouseEvent, date: string, mood: number | null) => {
    const box = boxRef.current
    const cell = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const rect = box?.getBoundingClientRect()
    if (!box || !rect || mood === null) return
    setTip({ left: cell.left - rect.left, top: cell.top - rect.top, date, mood })
  }

  return (
    <div ref={boxRef} className="relative overflow-x-auto py-1">
      <div className="flex">
        <div className="mr-1.5 flex flex-col justify-between py-0.5 pr-1 text-right text-[9px] uppercase tracking-wide text-muted">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>
        <div className="flex gap-[2px]">
          {cols.map((col, i) => (
            <div key={i} className="flex flex-col gap-[2px]">
              {col.map((cell) => (
                <button
                  key={cell.date}
                  onMouseEnter={(e) => showTip(e, cell.date, cell.mood)}
                  onMouseLeave={() => setTip(null)}
                  aria-label={`${cell.date}: ${cell.mood === null ? 'no mood' : `${MOODS.find((m) => m.value === cell.mood)?.label ?? cell.mood}/5`}`}
                  className="h-3.5 w-3.5 rounded-[4px] transition-transform hover:scale-125"
                  style={{ background: cell.mood === null ? 'var(--color-surface-3)' : moodColor(cell.mood) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs shadow-xl"
          style={{ left: tip.left, top: tip.top }}
        >
          <span className="font-mono text-muted">{tip.date}</span>
          <span className="ml-2 inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: moodColor(tip.mood) }} />
            {MOODS.find((m) => m.value === tip.mood)?.label ?? tip.mood}/5
          </span>
        </div>
      )}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-muted">
        Less
        {MOODS.map((m) => (
          <span key={m.value} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: m.color }} />
        ))}
        More
      </div>
    </div>
  )
}

export default function Mood() {
  const [today, setToday] = useState<MoodToday | null>(null)
  const [history, setHistory] = useState<MoodDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [t, h] = await Promise.all([
        api<MoodToday>('/api/mood/today'),
        api<{ entries: MoodDoc[] }>('/api/mood'),
      ])
      setToday(t)
      setHistory(h.entries)
      setSelected(t.mood)
      setNote(t.note ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mood data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!selected) return
    setSaving(true)
    setError('')
    try {
      await postJSON('/api/mood', { mood: selected, note: note || undefined })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save mood')
    } finally {
      setSaving(false)
    }
  }

  const week = history.slice(0, 7).reverse()

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <header className="mb-6">
        <h1 className="font-serif text-4xl font-semibold">Mood</h1>
        <p className="mt-1 text-sm text-muted">A daily weather report for your inner sky.</p>
      </header>

      {error && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{error}</p>}

      <Card className="mb-6">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Sparkles className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">How are you feeling today?</h2>
          {today?.recorded && <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-relaxed">logged</span>}
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              onClick={() => setSelected(m.value)}
              aria-pressed={selected === m.value}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 transition ${
                selected === m.value ? 'text-ink font-medium' : 'border-line bg-surface-2 text-cream hover:bg-surface-3'
              }`}
              style={selected === m.value ? { background: m.color, borderColor: m.color } : undefined}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span className="text-[11px]">{m.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a short note (optional)…" />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} loading={saving} disabled={!selected}>
            {today?.recorded ? 'Update today' : 'Save mood'}
          </Button>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Last 15 weeks</h2>
        {loading ? (
          <Skeleton className="h-24" />
        ) : history.length === 0 ? (
          <Empty title="No moods yet" hint="Your heatmap grows one day at a time." />
        ) : (
          <MoodHeatmap history={history} />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Last 7 days</h2>
          {loading ? (
            <Skeleton className="h-24" />
          ) : week.length === 0 ? (
            <Empty title="No moods yet" />
          ) : (
            <div className="flex items-end justify-between gap-2">
              {week.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-xl">{MOODS.find((m) => m.value === d.mood)?.emoji ?? '—'}</span>
                  <span className="font-mono text-[10px] text-muted">
                    {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Recent history</h2>
          {loading ? (
            <Skeleton className="h-24" />
          ) : history.length === 0 ? (
            <Empty title="Nothing logged yet" />
          ) : (
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {history.slice(0, 14).map((d) => {
                const mood = MOODS.find((m) => m.value === d.mood)
                return (
                  <div key={d.date} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                    <span className="text-sm">
                      {mood?.emoji} {new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    {d.note && <span className="ml-2 truncate text-xs text-muted">{d.note}</span>}
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs" style={{ color: mood?.color }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: mood?.color }} />
                      {mood?.label ?? d.mood_label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
