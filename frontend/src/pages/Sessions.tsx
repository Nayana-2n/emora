import { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Clock, Radio } from 'lucide-react'
import { api } from '../lib/api'
import { Button, Card, Empty, Spinner } from '../components/ui'

interface SessionSummary {
  session_id: string
  created_at?: number
  ended_at?: number
  status: string
  turns: number
  interactions: number
  dominant_emotion?: string | null
  avg_stress?: number | null
  emotion_distribution: Record<string, number>
  final_emotion?: string | null
}

interface Turn {
  turn_id?: string
  question: string
  answer: string
  emotion?: string
  stress?: number
  confidence?: number
  modalities?: string[] | null
  ts?: number
}

interface SessionDetail {
  session: SessionSummary
  turns: Turn[]
}

function fmtTime(ts?: number): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

export default function Sessions() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api<{ sessions: SessionSummary[] }>('/api/session/history')
      setSessions(res.sessions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const toggle = async (sessionId: string) => {
    if (expanded === sessionId) {
      setExpanded(null)
      setDetail(null)
      return
    }
    setExpanded(sessionId)
    setBusy(true)
    try {
      const res = await api<SessionDetail>(`/api/session/${sessionId}`)
      setDetail(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl animate-fade-up">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Session History</h1>
          <p className="text-sm text-muted">Every live session you have had, with transcripts and emotional analysis.</p>
        </div>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </header>

      {error && (
        <Card className="mb-4 border-bad/30 bg-bad/10">
          <p className="text-sm text-bad">{error}</p>
        </Card>
      )}

      {loading ? (
        <Card className="flex justify-center py-16">
          <Spinner className="h-7 w-7" />
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <Empty title="No sessions yet" hint="Start a Live Session to begin recording your emotional journey." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((s) => {
            const open = expanded === s.session_id
            return (
              <Card key={s.session_id} className={open ? 'border-aurora-indigo/40' : ''}>
                <button
                  onClick={() => toggle(s.session_id)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-2">
                    {open ? <ChevronDown className="h-5 w-5 text-aurora-teal" /> : <ChevronRight className="h-5 w-5 text-muted" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-medium text-cream">{fmtTime(s.created_at)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                          s.status === 'ended' ? 'bg-surface-2 text-muted' : 'bg-good/15 text-good'
                        }`}
                      >
                        {s.status}
                      </span>
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-xs text-muted">
                      <span>{s.turns} turns</span>
                      {s.dominant_emotion && <span className="capitalize">dominant: {s.dominant_emotion}</span>}
                      {typeof s.avg_stress === 'number' && <span>avg stress: {s.avg_stress}%</span>}
                    </span>
                  </span>
                </button>

                {open && (
                  <div className="mt-4 border-t border-line pt-4">
                    {busy ? (
                      <div className="flex justify-center py-8">
                        <Spinner className="h-6 w-6" />
                      </div>
                    ) : detail && detail.session.session_id === s.session_id && detail.turns.length === 0 ? (
                      <Empty title="No turns recorded" hint="This session had no completed speaking turns." />
                    ) : detail && detail.session.session_id === s.session_id ? (
                      <div className="flex flex-col gap-3">
                        {detail.turns.map((t, i) => (
                          <div key={t.turn_id ?? i} className="rounded-xl bg-surface-2 p-4">
                            <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                              <span>turn {i + 1}</span>
                              {t.ts && (
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> {new Date(t.ts * 1000).toLocaleTimeString()}
                                </span>
                              )}
                              {t.emotion && <span className="capitalize text-aurora-teal">felt: {t.emotion}</span>}
                              {typeof t.stress === 'number' && <span>stress {t.stress}</span>}
                              {typeof t.confidence === 'number' && <span>confidence {t.confidence}%</span>}
                              {t.modalities && t.modalities.length > 0 && <span>[{t.modalities.join('+')}]</span>}
                            </div>
                            <p className="text-sm text-cream">
                              <span className="font-medium">You:</span> {t.question}
                            </p>
                            <p className="mt-1 text-sm text-muted">
                              <span className="font-medium text-aurora-violet">EMORA:</span> {t.answer}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <p className="mt-6 flex items-center gap-2 font-mono text-[11px] text-muted">
        <Radio className="h-3.5 w-3.5" /> Sessions are stored on the backend and survive app restarts.
      </p>
    </div>
  )
}
