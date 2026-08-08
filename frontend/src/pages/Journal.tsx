import { useCallback, useEffect, useRef, useState } from 'react'
import { HelpCircle, PenLine, Trash2 } from 'lucide-react'
import { api, postJSON, del } from '../lib/api'
import type { JournalDoc } from '../lib/types'
import { Button, Card, Empty, EmotionBadge, Input, Label } from '../components/ui'
import { emotionColor } from '../lib/emotions'

const MOOD_TAGS = ['happy', 'calm', 'neutral', 'anxious', 'sad', 'angry']

const SECTION_INFO = {
  today: {
    label: 'Today',
    icon: '🌤',
    placeholder: 'How is today going? What is on your mind, what made you feel something?',
    desc: 'Capture the present moment — your thoughts, feelings, and what happened today.',
  },
  tomorrow_story: {
    label: "Tomorrow's Story",
    icon: '🌅',
    placeholder:
      'Write the story you want to live tomorrow. Who do you want to be, what do you want to feel, what small step makes it real?',
    desc: 'A future-self prompt: write tomorrow as if it already went the way you hoped. Your brain practices the feeling.',
  },
} as const

type SectionKey = keyof typeof SECTION_INFO

export default function Journal() {
  const [entries, setEntries] = useState<JournalDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [moodTag, setMoodTag] = useState('neutral')
  const [section, setSection] = useState<SectionKey>('today')
  const [showHelp, setShowHelp] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle')
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState('')

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const contentRef = useRef(content)
  contentRef.current = content
  const titleRef = useRef(title)
  titleRef.current = title
  const moodTagRef = useRef(moodTag)
  moodTagRef.current = moodTag
  const sectionRef = useRef(section)
  sectionRef.current = section

  const load = useCallback(async () => {
    try {
      const res = await api<{ entries: JournalDoc[] }>('/api/journal')
      setEntries(res.entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load journal')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [load])

  const doSave = useCallback(async () => {
    if (!contentRef.current.trim()) {
      setSaveState('idle')
      return
    }
    setSaveState('saving')
    try {
      await postJSON('/api/journal', {
        title: titleRef.current.trim() || (sectionRef.current === 'tomorrow_story' ? "Tomorrow's Story" : 'Untitled'),
        content: contentRef.current,
        mood_tag: moodTagRef.current,
        section: sectionRef.current,
      })
      setSaveState('saved')
      setSavedAt(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))
      await load()
    } catch (e) {
      setSaveState('dirty')
      setError(e instanceof Error ? e.message : 'Failed to save entry')
    }
  }, [load])

  const onContentChange = (v: string) => {
    setContent(v)
    if (v.trim().length < 5) {
      setSaveState('idle')
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }
    setSaveState('dirty')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => void doSave(), 1500)
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this journal entry?')) return
    try {
      await del(`/api/journal/${id}`)
      setEntries((e) => e.filter((x) => x.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete')
    }
  }

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  const bySection = (key: string) => entries.filter((e) => (e.section ?? 'today') === key)
  const todayEntries = bySection('today')
  const tomorrowEntries = bySection('tomorrow_story')

  const renderEntries = (list: JournalDoc[]) =>
    list.length === 0 ? (
      <Empty title="Nothing here yet" hint="Your words start here." />
    ) : (
      <div className="flex flex-col gap-3">
        {list.map((e) => (
          <Card key={e.id} className="group">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-xl font-semibold">{e.title}</h3>
                  {e.mood_tag && <EmotionBadge emotion={e.mood_tag} />}
                  {e.section === 'tomorrow_story' && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                      Tomorrow
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted">
                    {new Date((e.created_at ?? 0) * 1000).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted">{e.content}</p>
              </div>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button variant="ghost" className="px-2 py-1.5" onClick={() => remove(e.id)}>
                  <Trash2 className="h-4 w-4 text-bad" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <header className="mb-6">
        <h1 className="font-serif text-4xl font-semibold">Journal</h1>
        <p className="mt-1 text-sm text-muted">Write it out. Untangle it. Imagine it better.</p>
      </header>

      {error && <p className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-4 py-2.5 text-sm text-bad">{error}</p>}

      <Card className="mb-6 border-line-2/60">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <PenLine className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">New entry</h2>
          <button
            onClick={() => setShowHelp((v) => !v)}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition hover:bg-surface-2 hover:text-cream"
          >
            <HelpCircle className="h-4 w-4" /> What is this?
          </button>
        </div>

        {showHelp && (
          <div className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm leading-relaxed text-cream">
            <p className="mb-2">
              <strong>Today</strong> — {SECTION_INFO.today.desc}
            </p>
            <p>
              <strong>Tomorrow's Story</strong> — {SECTION_INFO.tomorrow_story.desc}
            </p>
            <p className="mt-2 text-xs text-muted">
              The Tomorrow's Story prompt draws on narrative therapy and mental rehearsal: describing a desired day in
              detail helps prime your mood and choices the next morning.
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SECTION_INFO) as SectionKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={`rounded-2xl border p-3 text-left transition ${
                  section === key ? 'border-accent bg-accent/10' : 'border-line bg-surface-2 hover:bg-surface-3'
                }`}
              >
                <span className="text-lg">{SECTION_INFO[key].icon}</span>
                <span className="mt-1 block text-sm font-semibold">{SECTION_INFO[key].label}</span>
                <span className="block text-xs text-muted">{SECTION_INFO[key].desc}</span>
              </button>
            ))}
          </div>

          <div>
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={section === 'tomorrow_story' ? "Tomorrow, I will…" : 'How would you name this moment?'}
              className="font-serif text-lg"
            />
          </div>

          <div>
            <Label>How do you feel?</Label>
            <div className="flex flex-wrap gap-2">
              {MOOD_TAGS.map((tag) => {
                const c = emotionColor(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => setMoodTag(tag)}
                    aria-pressed={moodTag === tag}
                    className={`rounded-full px-3.5 py-1.5 text-xs capitalize transition ${
                      moodTag === tag ? 'text-ink font-semibold' : 'border border-line text-muted hover:text-cream'
                    }`}
                    style={moodTag === tag ? { background: c, borderColor: c } : undefined}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label>Entry</Label>
            <textarea
              rows={9}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              placeholder={SECTION_INFO[section].placeholder}
              className="w-full resize-y rounded-2xl border border-line bg-surface-2 px-5 py-4 font-serif text-lg leading-relaxed text-cream placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-muted">
                {wordCount} word{wordCount === 1 ? '' : 's'}
              </span>
              <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    saveState === 'saved' ? 'bg-relaxed' : saveState === 'saving' ? 'bg-warn' : saveState === 'dirty' ? 'bg-accent' : 'bg-surface-3'
                  }`}
                />
                {saveState === 'saved' ? `Saved ${savedAt ?? ''}` : saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved changes' : 'Autosave on'}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => void doSave()} loading={saveState === 'saving'} disabled={!content.trim()}>
              Save {section === 'tomorrow_story' ? "tomorrow's story" : 'entry'}
            </Button>
          </div>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <span>🌤</span> Today {todayEntries.length > 0 && <span className="font-mono text-xs">({todayEntries.length})</span>}
            </h2>
            {renderEntries(todayEntries)}
          </section>
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
              <span>🌅</span> Tomorrow's Story{' '}
              {tomorrowEntries.length > 0 && <span className="font-mono text-xs">({tomorrowEntries.length})</span>}
            </h2>
            {renderEntries(tomorrowEntries)}
          </section>
        </div>
      )}
    </div>
  )
}
