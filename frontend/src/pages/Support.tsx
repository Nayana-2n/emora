import { useCallback, useState } from 'react'
import { AlertTriangle, ExternalLink, MapPin, Navigation, Phone } from 'lucide-react'
import { api } from '../lib/api'
import { Button, Card, Skeleton } from '../components/ui'

interface Provider {
  name: string
  address?: string
  rating?: number
  open_now?: boolean | null
  place_id?: string
}

const QUERIES = [
  { key: 'psychologist', label: 'Psychologist' },
  { key: 'psychiatrist', label: 'Psychiatrist' },
  { key: 'counselor', label: 'Counselor' },
] as const

const CRISIS_LINES_IN = [
  { name: 'National Emergency', detail: '112 (India)', note: 'Police, fire, ambulance and crisis response. Call immediately if you or someone else is in danger.' },
  { name: 'Tele-MANAS (Government of India)', detail: '14416', note: 'Free 24/7 national tele-mental health helpline, available in multiple languages.' },
  { name: 'KIRAN (Ministry of Social Justice)', detail: '1800-599-0019', note: 'Mental health rehabilitation helpline, toll-free, 24/7.' },
  { name: 'Vandrevala Foundation', detail: '1860-2662-345', note: 'Free 24/7 mental health support and counselling.' },
  { name: 'iCall (Tata Institute of Social Sciences)', detail: '9152987821', note: 'Professional counselling helpline (Mon–Sat, 10am–8pm).' },
  { name: 'AASRA', detail: '+91 98204 66726', note: '24/7 suicide prevention helpline — call or chat.' },
  { name: 'Samaritans Mumbai', detail: '+91 84229 84528', note: 'Confidential emotional support, available every day.' },
]

const CRISIS_LINES_INTL = [
  { name: 'Emergency services', detail: '911 (US) or your local emergency number', note: 'Call immediately if you or someone else is in danger.' },
  { name: '988 Suicide & Crisis Lifeline', detail: 'Call or text 988 (US)', note: 'Free, confidential support 24/7.' },
  { name: 'Crisis Text Line', detail: 'Text HOME to 741741 (US)', note: 'Free, 24/7 text support with a real counselor.' },
  { name: 'SAMHSA National Helpline', detail: '1-800-662-4357 (US)', note: 'Confidential treatment referral and information, 24/7.' },
]

function detectCrisisRegion(): 'IN' | 'INTL' {
  const lang = (navigator.language || '').toLowerCase()
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  if (lang.startsWith('hi') || lang.startsWith('en-in') || tz.startsWith('Asia/Kolkata') || tz === 'Asia/Calcutta') return 'IN'
  return 'INTL'
}

export default function Support() {
  const [query, setQuery] = useState<string>('psychologist')
  const [state, setState] = useState<'idle' | 'locating' | 'searching' | 'done' | 'error' | 'unconfigured'>('idle')
  const [results, setResults] = useState<Provider[]>([])
  const [message, setMessage] = useState('')
  const [region, setRegion] = useState<'IN' | 'INTL'>(() => detectCrisisRegion())
  const crisisLines = region === 'IN' ? CRISIS_LINES_IN : CRISIS_LINES_INTL

  const search = useCallback(async (lat: number, lng: number, q: string) => {
    setState('searching')
    try {
      const res = await api<{ configured: boolean; count: number; results: Provider[] }>(
        `/api/professionals/search?lat=${lat}&lng=${lng}&query=${encodeURIComponent(q)}`,
      )
      setResults(res.results ?? [])
      setState('done')
    } catch (e) {
      const status = (e as { status?: number }).status
      if (status === 501) {
        setState('unconfigured')
      } else {
        setState('error')
        setMessage(e instanceof Error ? e.message : 'Failed to search for providers.')
      }
    }
  }, [])

  const useLocation = () => {
    if (!navigator.geolocation) {
      setState('error')
      setMessage('Your browser does not support location access.')
      return
    }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        search(pos.coords.latitude, pos.coords.longitude, query)
      },
      (err) => {
        setState('error')
        setMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied.'
            : 'Could not access your location.',
        )
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const mapsUrl = (p: Provider) => {
    const params = new URLSearchParams({ api: '1', query: `${p.name} ${p.address ?? ''}`.trim() })
    return `https://www.google.com/maps/search/?${params.toString()}`
  }

  return (
    <div className="mx-auto max-w-6xl animate-fade-up">
      <header className="mb-6">
        <h1 className="font-serif text-3xl font-semibold">Support</h1>
        <p className="text-sm text-muted">Find a professional nearby, or someone to talk to right now.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-aurora-teal" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Find a professional</h2>
          </div>

          <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
            {QUERIES.map((q) => (
              <button
                key={q.key}
                onClick={() => setQuery(q.key)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                  query === q.key ? 'aurora-bg text-ink' : 'text-muted hover:text-cream'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>

          {state === 'idle' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-muted">
                Share your location to find real {query}s near you. We use Google Places — we never list providers we
                haven't verified.
              </p>
              <Button onClick={useLocation}>
                <Navigation className="h-4 w-4" /> Use my location
              </Button>
            </div>
          )}

          {state === 'locating' && (
            <div className="py-8">
              <Skeleton className="h-24" />
              <p className="mt-2 text-center text-xs text-muted">Getting your location…</p>
            </div>
          )}

          {state === 'searching' && (
            <div className="flex flex-col gap-2 py-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <p className="text-center text-xs text-muted">Searching nearby {query}s…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
              <p className="font-medium">{message}</p>
              <p className="mt-1 text-warn/90">Crisis resources below are available no matter what.</p>
            </div>
          )}

          {state === 'unconfigured' && (
            <div className="rounded-xl border border-line bg-surface-2 px-4 py-4 text-sm text-muted">
              <p className="font-medium text-cream">Provider search isn't configured on this server yet.</p>
              <p className="mt-1">
                When it is enabled, verified nearby {query}s would appear here. For now, the crisis resources on this
                page can connect you with real help.
              </p>
            </div>
          )}

          {state === 'done' && results.length === 0 && (
            <div className="rounded-xl border border-line bg-surface-2 px-4 py-4 text-sm text-muted">
              No {query}s found within ~10 km of your location. Try another type or check the crisis resources below.
            </div>
          )}

          {state === 'done' && results.length > 0 && (
            <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto">
              {results.map((p, i) => (
                <div key={p.place_id ?? i} className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-cream">{p.name}</p>
                      {p.address && <p className="mt-0.5 text-xs text-muted">{p.address}</p>}
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
                        {typeof p.rating === 'number' && <span>★ {p.rating.toFixed(1)}</span>}
                        {typeof p.open_now === 'boolean' && (
                          <span className={p.open_now ? 'text-good' : 'text-bad'}>
                            {p.open_now ? 'Open now' : 'Closed now'}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={mapsUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-cream transition hover:bg-surface-3"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Maps
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-aurora-indigo" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Crisis resources</h2>
            </div>
            <div className="flex gap-1 rounded-lg border border-line bg-surface p-0.5">
              {(['IN', 'INTL'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                    region === r ? 'aurora-bg text-ink' : 'text-muted hover:text-cream'
                  }`}
                >
                  {r === 'IN' ? 'India' : 'International'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {crisisLines.map((c) => (
              <div key={c.name} className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <p className="text-sm font-medium text-cream">{c.name}</p>
                <p className="mt-0.5 font-mono text-sm text-aurora-teal">{c.detail}</p>
                <p className="mt-0.5 text-xs text-muted">{c.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">
            {region === 'IN'
              ? 'Indian helplines are shown automatically based on your location. If you are elsewhere, switch to International.'
              : 'International helplines shown (US-focused). If you are in India, switch to India for local numbers.'}
          </p>
        </Card>
      </div>

      <Card className="mt-4 flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <p className="text-xs leading-relaxed text-muted">
          Provider results come from Google Places and are informational only. EMORA does not endorse or verify any
          individual provider — always confirm a professional's credentials and licensing. This app is a wellness
          companion, not a medical service or a substitute for professional care.
        </p>
      </Card>
    </div>
  )
}
