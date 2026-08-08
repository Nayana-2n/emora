import { useState } from 'react'
import { ChevronDown, FlaskConical, Lightbulb, Library, Sparkles } from 'lucide-react'
import { Card } from '../components/ui'

interface Strategy {
  id: string
  name: string
  category: string
  summary: string
  steps: string[]
  why: string[]
  refs: string[]
}

const STRATEGIES: Strategy[] = [
  {
    id: 'breathing-4-7-8',
    name: '4-7-8 Breathing',
    category: 'Nervous system',
    summary:
      'A paced breathing pattern that activates the parasympathetic "rest and digest" system to lower acute stress.',
    steps: [
      'Inhale quietly through the nose for 4 seconds.',
      'Hold the breath for 7 seconds.',
      'Exhale fully through the mouth for 8 seconds.',
      'Repeat for 4 full cycles (about 2 minutes).',
    ],
    why: [
      'Extended exhales lengthen heart rate deceleration, quickly shifting the body out of fight-or-flight.',
      'Consistent practice is used to lower baseline anxiety and improve sleep onset.',
    ],
    refs: ['Ma et al., 2017 — The effect of diaphragmatic breathing on attention, negative affect and stress in healthy adults'],
  },
  {
    id: 'body-scan',
    name: 'Body Scan Meditation',
    category: 'Mindfulness',
    summary: 'A guided attention exercise that moves awareness through the body to release tension and ground you.',
    steps: [
      'Lie down or sit comfortably and close your eyes.',
      'Notice your breath for a few cycles.',
      'Slowly move attention from the crown of your head down to your toes.',
      'For each region, notice sensation without judging, then let it go.',
      'Spend 5–15 minutes; end by returning to full-body awareness.',
    ],
    why: [
      'Body scans improve interoception and reduce the physical tension that accompanies stress.',
      'Regular practice is linked to lower self-reported stress and better emotional regulation.',
    ],
    refs: ['Mirams et al., 2013 — Mindfulness meditation reduces pain and stress by altering attention'],
  },
  {
    id: 'journaling',
    name: 'Expressive Journaling',
    category: 'Emotional processing',
    summary:
      'Writing about a difficult experience for 10–20 minutes helps the brain organise it, reducing its emotional charge.',
    steps: [
      'Pick a time when you feel safe to write for at least 10 minutes.',
      'Write continuously about how you feel and what the experience means to you.',
      'Do not worry about grammar or logic — write freely.',
      'Repeat on a few occasions; you do not need to show it to anyone.',
    ],
    why: [
      'Expressive writing reduces intrusive thoughts about stressful events and improves working memory.',
      'It gives emotions a narrative shape, which helps the prefrontal cortex regulate the amygdala.',
    ],
    refs: ['Pennebaker & Beall, 1986 — Confronting a traumatic event: Toward an understanding of inhibition and disease'],
  },
  {
    id: 'morning-story',
    name: "Tomorrow's Story",
    category: 'Future self',
    summary:
      'Write tomorrow as if it already went the way you hoped — the brain rehearses the emotion and the actions.',
    steps: [
      'Before bed, describe tomorrow in the past tense: what you did, felt, and handled well.',
      'Include a concrete, tiny first step (e.g. "I drank water right after waking").',
      'Read it back once and imagine the feeling.',
    ],
    why: [
      'Mental rehearsal activates the same neural circuits as actually performing an action.',
      'Framing a day as already successful raises expected self-efficacy and primes better choices.',
    ],
    refs: ['Taylor et al., 1998 — Harnessing the imagination: Mental simulation, self-regulation, and coping'],
  },
  {
    id: 'gratitude-list',
    name: 'Three Good Things',
    category: 'Positive psychology',
    summary: 'Each night, list three things that went well and why. It retrains attention toward the positive.',
    steps: [
      'Write down three things that went well today, large or small.',
      'For each one, add a line about why it happened.',
      'Do this nightly for at least a week to build the habit.',
    ],
    why: [
      'The practice reduces depression scores and increases happiness in controlled studies.',
      'It counters the brain\u2019s negativity bias by making positive events more memorable.',
    ],
    refs: ['Seligman et al., 2005 — Positive psychology progress: Empirical validation of interventions'],
  },
  {
    id: 'habit-linking',
    name: 'Habit Stacking',
    category: 'Behaviour change',
    summary: 'Attach a new tiny habit to an existing routine cue so it becomes automatic.',
    steps: [
      'Choose a habit you already do daily (brushing teeth, morning coffee).',
      'Pick one small new behaviour and put it right after that cue.',
      'Example: "After I pour my morning coffee, I will write one line of gratitude."',
      'Keep it small enough that you cannot fail.',
    ],
    why: [
      'Existing routines provide reliable triggers, so the new behaviour does not rely on motivation.',
      'Small repeated wins build self-efficacy and momentum.',
    ],
    refs: ['Lally et al., 2010 — How are habits formed: Modelling habit formation in the real world'],
  },
  {
    id: 'hydration-goal',
    name: 'Hydration Anchoring',
    category: 'Physiology',
    summary: 'Meeting a hydration goal stabilises mood and energy; anchoring water to daily moments makes it stick.',
    steps: [
      'Set a daily goal (default 2000 ml) in the Water page.',
      'Anchor a glass to three cues: waking, lunch, and before bed.',
      'Use visible reminders — a bottle on your desk beats willpower.',
    ],
    why: [
      'Even mild dehydration degrades mood, alertness, and concentration.',
      'Anchored routines turn hydration into an automatic behaviour.',
    ],
    refs: ['Pross, 2017 — Hydration and health: A review'],
  },
  {
    id: 'movement-breaks',
    name: 'Movement Snacks',
    category: 'Physiology',
    summary: 'Short, frequent bouts of movement regulate stress hormones better than rare long workouts.',
    steps: [
      'Every 45–60 minutes, stand and move for 2–5 minutes.',
      'Walk the room, stretch, or do 10 squats.',
      'Aim for a total of 30 minutes of movement across the day.',
    ],
    why: [
      'Movement clears circulating stress hormones and boosts mood-regulating neurotransmitters.',
      'Frequent short breaks also reduce the physical toll of sitting.',
    ],
    refs: ['Craft & Perna, 2004 — The benefits of exercise for the clinically depressed'],
  },
  {
    id: 'sleep-window',
    name: 'Consistent Sleep Window',
    category: 'Sleep',
    summary: 'Keeping a stable wake time anchors your circadian rhythm and improves sleep quality.',
    steps: [
      'Pick a wake time and keep it within 30 minutes every day, including weekends.',
      'Wind down with dim light and screens off 30–60 minutes before bed.',
      'Log your sleep in EMORA to track consistency.',
    ],
    why: [
      'A stable wake time is the single strongest anchor for the circadian clock.',
      'Sleep consistency is tightly linked to mood stability and stress resilience.',
    ],
    refs: ['Walker, 2017 — Why We Sleep'],
  },
  {
    id: 'rain-check',
    name: 'Name It to Tame It',
    category: 'Emotional regulation',
    summary: 'Labelling an emotion ("I am anxious") reduces the amygdala\u2019s alarm response.',
    steps: [
      'When you notice a strong feeling, pause.',
      'Say or write its name in one or two words: anxious, overwhelmed, hurt.',
      'Add a light note about where you feel it in your body.',
      'Check in on the feeling again after 60 seconds.',
    ],
    why: [
      'Affect labelling activates the right ventrolateral prefrontal cortex and reduces amygdala reactivity.',
      'It creates a moment of distance between the feeling and the automatic reaction.',
    ],
    refs: ['Lieberman et al., 2007 — Putting feelings into words'],
  },
  {
    id: 'social-check',
    name: 'Social Reality Check',
    category: 'Connection',
    summary: 'A gentle conversation with someone you trust reduces the felt weight of a stressful day.',
    steps: [
      'Choose a person who listens well and does not rush to fix.',
      'Spend 10 minutes telling them how your day actually went.',
      'Let yourself receive support rather than performing "fine".',
    ],
    why: [
      'Social support buffers the physiological stress response.',
      'Sharing emotional experiences reduces their intensity in the brain.',
    ],
    refs: ['Cohen & Wills, 1985 — Stress, social support, and the buffering hypothesis'],
  },
  {
    id: 'walking-nature',
    name: 'Nature Reset',
    category: 'Attention',
    summary: 'A short walk in green space restores directed attention and lowers stress markers.',
    steps: [
      'Find any greenery — a park, a tree-lined street, even a plant-rich corner.',
      'Walk for 10–20 minutes without your phone.',
      'Let your attention wander to shapes, sounds, and light.',
    ],
    why: [
      'Natural environments use "soft fascination" that restores depleted attention.',
      'Time in nature is associated with lower cortisol and rumination.',
    ],
    refs: ['Berman et al., 2008 — The cognitive benefits of interacting with nature'],
  },
]

const CATEGORY_COLORS: Record<string, string> = {
  'Nervous system': 'text-aurora-teal',
  Mindfulness: 'text-aurora-indigo',
  'Emotional processing': 'text-aurora-violet',
  'Future self': 'text-accent',
  'Positive psychology': 'text-good',
  'Behaviour change': 'text-aurora-teal',
  Physiology: 'text-warn',
  Sleep: 'text-aurora-indigo',
  'Emotional regulation': 'text-bad',
  Connection: 'text-good',
  Attention: 'text-accent',
}

const BOOKS = [
  { title: 'Why We Sleep', author: 'Matthew Walker', note: 'Sleep as the foundation of emotional regulation.' },
  { title: 'The Relaxation and Stress Reduction Workbook', author: 'Davis, Eshelman & McKay', note: 'Practical exercises for tension release.' },
  { title: 'Opening Up by Writing It Down', author: 'James Pennebaker', note: 'The science of expressive writing.' },
  { title: 'Atomic Habits', author: 'James Clear', note: 'Tiny changes for lasting behaviour change.' },
  { title: 'The Stress-Proof Brain', author: 'Melanie Greenberg', note: 'Mindfulness for anxiety and stress.' },
]

function StrategyCard({ s }: { s: Strategy }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${CATEGORY_COLORS[s.category] ?? 'text-muted'}`}>
            {s.category}
          </span>
          <h3 className="mt-1 font-serif text-lg font-semibold">{s.name}</h3>
        </div>
        <Lightbulb className="h-5 w-5 shrink-0 text-aurora-teal" />
      </div>
      <p className="mt-2 text-sm text-muted">{s.summary}</p>
      <ol className="mt-4 flex flex-col gap-1.5">
        {s.steps.map((step, i) => (
          <li key={i} className="flex gap-2 text-sm text-cream">
            <span className="font-mono text-xs text-aurora-indigo">{i + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <button
        onClick={() => setOpen((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-aurora-indigo transition hover:text-aurora-teal"
      >
        <FlaskConical className="h-3.5 w-3.5" /> Why it works
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-aurora-indigo/25 bg-aurora-indigo/10 p-3">
          <ul className="flex flex-col gap-1.5 text-xs leading-relaxed text-cream">
            {s.why.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
          <div className="mt-2 border-t border-line pt-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">Research</p>
            <p className="text-[11px] italic text-muted">{s.refs.join(' · ')}</p>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function Strategies() {
  const [filter, setFilter] = useState('All')
  const categories = ['All', ...Array.from(new Set(STRATEGIES.map((s) => s.category)))]
  const shown = filter === 'All' ? STRATEGIES : STRATEGIES.filter((s) => s.category === filter)

  return (
    <div className="mx-auto max-w-5xl animate-fade-up">
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-aurora-violet" />
          <h1 className="font-serif text-3xl font-semibold">Strategies</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Science-backed practices for stress, mood, and daily wellbeing. Tap "Why it works" for the research behind each one.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`rounded-full px-3 py-1.5 text-xs transition ${
              filter === c ? 'aurora-bg font-semibold text-ink' : 'border border-line text-muted hover:text-cream'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {shown.map((s) => (
          <StrategyCard key={s.id} s={s} />
        ))}
      </div>

      <Card className="mt-8">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <Library className="h-4 w-4 text-aurora-teal" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Books & resources</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {BOOKS.map((b) => (
            <div key={b.title} className="rounded-xl bg-surface-2 p-3">
              <p className="text-sm font-semibold text-cream">{b.title}</p>
              <p className="text-xs text-muted">{b.author}</p>
              <p className="mt-1 text-xs italic text-muted">{b.note}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
