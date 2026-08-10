import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Mic, MicOff, Radio, Send, Square, Video, VideoOff, Camera, AudioLines } from 'lucide-react'
import { api, postJSON } from '../lib/api'
import type { ChatReply, EmotionResult } from '../lib/types'
import { Button, Card, Empty, EmotionBadge, ThinkingDots } from '../components/ui'
import { emotionColor, emotionLabel } from '../lib/emotions'

type SessionState = 'idle' | 'starting' | 'listening' | 'thinking' | 'speaking' | 'stopped'
type SensorMode = 'both' | 'camera' | 'mic'

interface Turn {
  id: string
  role: 'user' | 'emora'
  text: string
  emotion?: string
  stress?: number
}

interface RecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    length: number
    [index: number]: { transcript: string }
  }>
}

const SPEECH_RECOGNITION =
  typeof window !== 'undefined'
    ? (window as unknown as { SpeechRecognition?: new () => RecognitionLike }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike }).webkitSpeechRecognition
    : undefined

const FILM_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"

const MIME_OPUS = (() => {
  if (typeof MediaRecorder === 'undefined') return ''
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) return 'video/webm;codecs=vp9,opus'
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  return ''
})()

function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve()
      return
    }
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = 'en-US'
    utter.rate = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find((v) => /en[-_](US|GB)/i.test(v.lang) && /female|google/i.test(v.name)) ?? voices.find((v) => /en/i.test(v.lang))
    if (preferred) utter.voice = preferred
    utter.onend = () => resolve()
    utter.onerror = () => resolve()
    window.speechSynthesis.speak(utter)
  })
}

function StatusPill({ state }: { state: SessionState }) {
  let content: ReactNode
  switch (state) {
    case 'starting':
      content = (
        <>
          <ThinkingDots />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-widest text-muted">Starting</span>
        </>
      )
      break
    case 'listening':
      content = (
        <>
          <span className="flex h-3 items-end gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="inline-block w-0.5 rounded-full bg-accent"
                style={{ height: 12, animation: 'speak 0.9s ease-in-out infinite', animationDelay: `${i * 0.09}s` }}
              />
            ))}
          </span>
          <span className="ml-2 font-mono text-[11px] uppercase tracking-widest text-cream">Listening</span>
        </>
      )
      break
    case 'thinking':
      content = (
        <>
          <ThinkingDots />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-widest text-muted">Processing</span>
        </>
      )
      break
    case 'speaking':
      content = (
        <>
          <span className="h-2 w-2 rounded-full bg-accent animate-pulse-soft glow-accent" />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-widest text-cream">Speaking</span>
        </>
      )
      break
    default:
      content = (
        <>
          <span className="h-2 w-2 rounded-full bg-muted-2" />
          <span className="ml-2 font-mono text-[11px] uppercase tracking-widest text-muted">{state === 'stopped' ? 'Ended' : 'Ready'}</span>
        </>
      )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-line bg-surface/80 px-3 py-1.5 backdrop-blur">
      {content}
    </span>
  )
}

/** Real voice energy — reads the live AnalyserNode, never simulated. */
function VoiceEnergy({ analyser, active }: { analyser: RefObject<AnalyserNode | null>; active: boolean }) {
  const [levels, setLevels] = useState<number[]>(Array(28).fill(8))
  useEffect(() => {
    if (!active) {
      setLevels(Array(28).fill(8))
      return
    }
    let raf = 0
    const data = new Uint8Array(analyser.current?.frequencyBinCount ?? 128)
    const tick = () => {
      const a = analyser.current
      if (a) {
        a.getByteFrequencyData(data)
        const bars = 28
        const step = Math.max(1, Math.floor(data.length / bars))
        const next: number[] = []
        for (let i = 0; i < bars; i++) {
          let sum = 0
          for (let j = i * step; j < (i + 1) * step && j < data.length; j++) sum += data[j]
          const v = (sum / (step * 255)) * 100
          next.push(Math.max(6, Math.min(100, Math.round(v * 1.6))))
        }
        setLevels(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, analyser])

  return (
    <div className="flex h-20 items-end justify-center gap-1" aria-hidden="true">
      {levels.map((h, i) => (
        <span
          key={i}
          className={`w-1 rounded-full ${active ? 'bg-accent' : 'bg-surface-3'}`}
          style={{ height: `${h}%`, transition: 'height 120ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      ))}
    </div>
  )
}

export default function Live() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<SessionState>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [face, setFace] = useState<EmotionResult | null>(null)
  const [voice, setVoice] = useState<EmotionResult | null>(null)
  const [lastFace, setLastFace] = useState<Record<string, number>>({})
  const [lastVoice, setLastVoice] = useState<Record<string, number>>({})
  const [lastStress, setLastStress] = useState(0)
  const [typeText, setTypeText] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [mode, setMode] = useState<SensorMode>('both')
  const [error, setError] = useState('')
  const [sttUnsupported, setSttUnsupported] = useState(false)

  const cidRef = useRef<string | null>(null)
  const sidRef = useRef<string | null>(null)
  const turnNoRef = useRef(0)
  const stressHistoryRef = useRef<number[]>([])
  const recRef = useRef<RecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTranscriptRef = useRef('')
  const lastSpeechAtRef = useRef(0)
  const busyRef = useRef(false)
  const sessionActiveRef = useRef(false)
  const faceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  const submitMessage = async (text: string, viaVoice: boolean) => {
    if (!text.trim()) return
    stopRecognition()
    recorderRef.current?.pause()
    const history = turns.map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }))
    setTurns((t) => [...t, { id: `u-${Date.now()}`, role: 'user', text }])
    setState('thinking')
    try {
      const modalities = viaVoice ? Array.from(new Set(['face', 'voice'].filter((m) => (m === 'face' ? Object.keys(lastFace).length : Object.keys(lastVoice).length)))) : undefined
      turnNoRef.current += 1
      const res = await postJSON<ChatReply>('/api/chat', {
        message: text,
        conversation_id: cidRef.current,
        session_id: sidRef.current,
        turn_no: turnNoRef.current,
        modalities,
        face: viaVoice ? lastFace : undefined,
        voice: viaVoice ? lastVoice : undefined,
        stress: viaVoice ? lastStress : undefined,
        chat_history: history,
      })
      if (typeof res.stress === 'number') stressHistoryRef.current.push(res.stress)
      cidRef.current = res.conversation_id
      const turn: Turn = { id: res.turn_id, role: 'emora', text: res.reply, emotion: res.emotion, stress: res.stress }
      setTurns((t) => [...t, turn])
      if (!sessionActiveRef.current) return
      setState('speaking')
      await speak(res.reply)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get a reply')
    } finally {
      if (sessionActiveRef.current) {
        setState('listening')
        if (recorderRef.current && recorderRef.current.state === 'paused') recorderRef.current.resume()
        startRecognition()
      } else {
        setState('stopped')
      }
    }
  }

  const startRecognition = () => {
    if (!SPEECH_RECOGNITION || !sessionActiveRef.current) return
    const rec = new SPEECH_RECOGNITION()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) finalTranscriptRef.current += result[0].transcript + ' '
        else interim += result[0].transcript
      }
      lastSpeechAtRef.current = Date.now()
    }

    rec.onerror = (event: { error: string }) => {
      if (
        recRef.current === rec &&
        sessionActiveRef.current &&
        stateRef.current === 'listening' &&
        event.error !== 'not-allowed' &&
        event.error !== 'service-not-allowed'
      ) {
        recRef.current = null
        startRecognition()
      }
    }

    rec.onend = () => {
      if (recRef.current === rec && sessionActiveRef.current && stateRef.current === 'listening') {
        recRef.current = null
        startRecognition()
      }
    }

    try {
      rec.start()
      recRef.current = rec
    } catch {
      /* already started */
    }
  }

  const stopRecognition = () => {
    if (recRef.current) {
      try {
        recRef.current.stop()
      } catch {
        /* ignore */
      }
      recRef.current = null
    }
  }

  const checkSilence = () => {
    if (busyRef.current || !sessionActiveRef.current) return
    if (stateRef.current !== 'listening') return
    const elapsed = Date.now() - lastSpeechAtRef.current
    const text = finalTranscriptRef.current.trim()
    if (text && elapsed > 3000) {
      finalTranscriptRef.current = ''
      busyRef.current = true
      submitMessage(text, true).finally(() => {
        busyRef.current = false
      })
    }
  }

  const startRecorder = async () => {
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true })
      audio.getTracks().forEach((t) => t.stop())
    } catch {
      /* default mic only */
    }
    if (!recorderRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (!sessionActiveRef.current) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (!streamRef.current) streamRef.current = stream

        if (!audioCtxRef.current) {
          try {
            const Ctx =
              window.AudioContext ??
              (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
            if (Ctx) {
              const ctx = new Ctx()
              const analyser = ctx.createAnalyser()
              analyser.fftSize = 256
              analyser.smoothingTimeConstant = 0.8
              const src = ctx.createMediaStreamSource(stream)
              src.connect(analyser)
              audioCtxRef.current = ctx
              analyserRef.current = analyser
              if (ctx.state === 'suspended') void ctx.resume()
            }
          } catch {
            /* voice energy is optional */
          }
        }

        const recorder = new MediaRecorder(stream, MIME_OPUS ? { mimeType: MIME_OPUS } : undefined)
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data)
        }
        recorder.onstop = () => {
          const blob = new Blob(audioChunksRef.current, { type: MIME_OPUS || 'audio/webm' })
          audioChunksRef.current = []
          if (blob.size > 0 && sessionActiveRef.current) sendVoiceChunk(blob)
        }
        recorder.start(5000)
        recorderRef.current = recorder
      } catch (e) {
        recorderRef.current = null
        throw e instanceof Error ? e : new Error('Microphone unavailable')
      }
    }
  }

  const sendVoiceChunk = async (blob: Blob) => {
    try {
      const form = new FormData()
      form.append('file', blob, 'chunk.webm')
      const res = await api<EmotionResult>('/api/emotion/voice-chunk', { method: 'POST', body: form })
      setVoice(res)
      if (res.distribution && Object.keys(res.distribution).length) setLastVoice(res.distribution)
      if (typeof res.stress === 'number') setLastStress(res.stress)
    } catch {
      /* keep last known voice state */
    }
  }

  const startCamera = async () => {
    try {
      const video = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } })
      if (!sessionActiveRef.current) {
        video.getTracks().forEach((t) => t.stop())
        return
      }
      if (videoRef.current) {
        videoRef.current.srcObject = video
        await videoRef.current.play()
      }
      cameraStreamRef.current = video
      setCameraOn(true)
      faceTimerRef.current = setInterval(captureFace, 3500)
    } catch (e) {
      setCameraOn(false)
      throw e instanceof Error ? e : new Error('Camera unavailable')
    }
  }

  const captureFace = async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return
    canvas.width = video.videoWidth || 320
    canvas.height = video.videoHeight || 240
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) return
    const form = new FormData()
    form.append('file', blob, 'frame.jpg')
    try {
      const res = await api<EmotionResult>('/api/emotion/facial-frame', { method: 'POST', body: form })
      setFace(res)
      if (res.distribution && Object.keys(res.distribution).length) setLastFace(res.distribution)
    } catch {
      /* keep last known face state */
    }
  }

  const stopCamera = () => {
    if (faceTimerRef.current) {
      clearInterval(faceTimerRef.current)
      faceTimerRef.current = null
    }
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop())
    cameraStreamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }

  const stopRecorderNow = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    analyserRef.current = null
    if (audioCtxRef.current) {
      try {
        void audioCtxRef.current.close()
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null
    }
  }

  const toggleCamera = async () => {
    if (!sessionActiveRef.current) return
    if (cameraOn) {
      stopCamera()
      setError('')
    } else {
      setError('')
      try {
        await startCamera()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera unavailable')
      }
    }
  }

  const toggleMic = async () => {
    if (!sessionActiveRef.current) return
    if (recorderRef.current || streamRef.current) {
      stopRecorderNow()
      setError('')
    } else {
      setError('')
      try {
        await startRecorder()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Microphone unavailable')
      }
    }
  }

  const begin = async () => {
    setError('')
    setTurns([])
    setFace(null)
    setVoice(null)
    setLastFace({})
    setLastVoice({})
    setLastStress(0)
    turnNoRef.current = 0
    stressHistoryRef.current = []
    sessionActiveRef.current = true
    busyRef.current = false
    finalTranscriptRef.current = ''
    setSttUnsupported(!SPEECH_RECOGNITION)
    setState('starting')
    try {
      const sres = await api<{ session_id: string }>('/api/session/start', { method: 'POST' })
      sidRef.current = sres.session_id
      const res = await api<{ conversation_id: string }>('/api/conversation/start', { method: 'POST' })
      cidRef.current = res.conversation_id
      setTurns([
        {
          id: 'welcome',
          role: 'emora',
          text: 'Hi, I am EMORA. I am listening. Tell me how you are feeling — a few words are enough.',
        },
      ])
      // Camera / mic are best-effort: a permission problem must never kill the session.
      const sensorWarnings: string[] = []
      if (mode !== 'mic') {
        try {
          await startCamera()
        } catch {
          sensorWarnings.push('camera unavailable')
        }
      }
      if (mode !== 'camera') {
        try {
          await startRecorder()
        } catch {
          sensorWarnings.push('microphone unavailable')
        }
        if (SPEECH_RECOGNITION) startRecognition()
      }
      if (!SPEECH_RECOGNITION) {
        sensorWarnings.push('voice-to-text needs Chrome (not Safari) — use the text box to talk to EMORA')
      }
      if (sensorWarnings.length) setError('Note: ' + sensorWarnings.join(' · '))
      silenceTimerRef.current = setInterval(checkSilence, 500)
      lastSpeechAtRef.current = Date.now()
      setState('listening')
    } catch (e) {
      sessionActiveRef.current = false
      setState('stopped')
      setError(e instanceof Error ? e.message : 'Could not start session')
    }
  }

  const endSession = () => {
    const sid = sidRef.current
    if (!sid) return
    const stresses = stressHistoryRef.current
    const avgStress = stresses.length ? Math.round((stresses.reduce((a, b) => a + b, 0) / stresses.length) * 10) / 10 : undefined
    api('/api/session/' + sid + '/end', {
      method: 'POST',
      body: JSON.stringify({ total_turns: turnNoRef.current, avg_stress: avgStress }),
    }).catch(() => {
      /* session stays "active"; per-turn records are already saved */
    })
    sidRef.current = null
  }

  const stop = () => {
    sessionActiveRef.current = false
    setState('stopped')
    endSession()
    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current)
    stopRecognition()
    stopRecorderNow()
    stopCamera()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  useEffect(() => () => {
    sessionActiveRef.current = false
    endSession()
    if (silenceTimerRef.current) clearInterval(silenceTimerRef.current)
    stopRecognition()
    stopRecorderNow()
    stopCamera()
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, state])

  const stateRef = useRef(state)
  stateRef.current = state

  const live = state !== 'idle' && state !== 'stopped'
  const dominantEmotion = face?.emotion ?? voice?.emotion ?? 'neutral'
  const heroColor = emotionColor(dominantEmotion)

  return (
    <div className="mx-auto max-w-7xl animate-fade-up">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Live Session</h1>
          <p className="text-sm text-muted">Speak, and I will feel with you. 3 seconds of silence ends your turn.</p>
        </div>
        <StatusPill state={state} />
      </header>

      {error && (
        <Card className="mb-4 border-bad/30 bg-bad/10">
          <p className="text-sm text-bad">{error}</p>
        </Card>
      )}

      {state === 'idle' && (
        <div className="flex flex-col items-center gap-6">
          <div className="mt-4 flex flex-col items-center text-center">
            <div className="glow-accent rounded-full p-3" style={{ background: 'radial-gradient(circle, rgba(232,160,160,0.18), transparent 70%)' }}>
              <Camera className="h-10 w-10 text-accent" />
            </div>
            <h2 className="mt-4 font-serif text-4xl font-semibold">
              Let me <span className="aurora-text italic">listen</span>.
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted">
              EMORA reads emotion from your face, your voice, or both — then responds the way a friend would.
            </p>
          </div>

          <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
            {(
              [
                { value: 'both', icon: Video, title: 'Camera + microphone', desc: 'Full emotion reading from face and voice.' },
                { value: 'camera', icon: Camera, title: 'Camera only', desc: 'Face emotions only. Type your thoughts.' },
                { value: 'mic', icon: AudioLines, title: 'Microphone only', desc: 'Voice emotions only. No video needed.' },
              ] as const
            ).map(({ value, icon: Icon, title, desc }) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                  mode === value ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:bg-surface-2'
                }`}
              >
                <Icon className={`h-5 w-5 ${mode === value ? 'text-accent' : 'text-muted'}`} />
                <span className="text-sm font-semibold">{title}</span>
                <span className="text-xs text-muted">{desc}</span>
              </button>
            ))}
          </div>

          <Button onClick={begin} className="px-8 py-3 text-base">
            <Radio className="h-5 w-5" /> Start session
          </Button>
        </div>
      )}

      {state === 'stopped' && (
        <Card>
          <Empty title="Session ended" hint="Your insights were recorded. Start again whenever you need." />
        </Card>
      )}

      {live && (
        <>
          {sttUnsupported && (
            <div className="mb-4 flex items-start gap-2 rounded-2xl border border-line bg-surface/80 px-4 py-3 text-sm text-muted backdrop-blur">
              <AudioLines className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                This browser does not support voice-to-text (common on iPhone/Safari). You can still{' '}
                <span className="text-cream">type below</span> to talk to EMORA — mic tone-analysis still works. For full
                voice, open this page in <span className="text-cream">Chrome</span>.
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[30%_40%_30%] lg:h-[calc(100vh-10rem)] lg:min-h-[560px]">
          {/* Camera — center column, the dominant panel */}
          <div
            className="order-1 relative h-full min-h-[420px] overflow-hidden rounded-3xl border lg:order-2"
            style={{
              borderColor: `${heroColor}66`,
              boxShadow: `0 0 90px ${heroColor}2e, inset 0 0 0 1px rgba(255,255,255,0.04)`,
            }}
          >
            {/* living aurora blobs */}
            <div
              className="animate-blob-a pointer-events-none absolute -left-16 -top-20 h-80 w-80 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(232,160,160,0.5), transparent 70%)' }}
            />
            <div
              className="animate-blob-b pointer-events-none absolute -bottom-24 -right-16 h-96 w-96 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, rgba(244,201,201,0.4), transparent 70%)' }}
            />

            <video ref={videoRef} muted playsInline className="relative z-[1] h-full w-full object-cover" />
            {!cameraOn && (
              <div className="absolute inset-0 z-[1] flex flex-col items-center justify-center gap-3">
                <VideoOff className="h-10 w-10 text-muted-2" />
                <p className="text-sm text-muted">Camera off — voice + conversation still active.</p>
              </div>
            )}

            {/* breathing vignette */}
            <div
              className="pointer-events-none absolute inset-0 z-[2]"
              style={{
                background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)',
                animation: 'breathe 7s ease-in-out infinite',
              }}
            />

            {/* film grain */}
            <div
              className="pointer-events-none absolute inset-0 z-[3] opacity-[0.04]"
              style={{ backgroundImage: FILM_GRAIN, mixBlendMode: 'overlay' }}
            />

            {/* emotion label near camera */}
            <div className="absolute bottom-4 left-4 z-[4] flex items-end gap-3">
              <div>
                <p className="font-serif text-3xl italic leading-none" style={{ color: heroColor }}>
                  {emotionLabel(dominantEmotion)}
                </p>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-widest text-muted">felt right now</p>
              </div>
              <EmotionBadge emotion={dominantEmotion} className="mb-1" />
            </div>

            {/* controls */}
            <div className="absolute right-4 top-4 z-[4] flex flex-wrap items-center justify-end gap-2">
              {mode !== 'mic' && (
                <Button variant="outline" onClick={toggleCamera} className="bg-surface/70 px-3 py-2 text-xs backdrop-blur" disabled={state === 'starting' || state === 'thinking'}>
                  {cameraOn ? <Video className="h-4 w-4 text-accent" /> : <VideoOff className="h-4 w-4 text-muted" />}
                  {cameraOn ? 'Camera on' : 'Camera off'}
                </Button>
              )}
              {mode !== 'camera' && (
                <Button variant="outline" onClick={toggleMic} className="bg-surface/70 px-3 py-2 text-xs backdrop-blur" disabled={state === 'starting' || state === 'thinking'}>
                  {recorderRef.current || streamRef.current ? (
                    <Mic className="h-4 w-4 text-accent" />
                  ) : (
                    <MicOff className="h-4 w-4 text-muted" />
                  )}
                  {recorderRef.current || streamRef.current ? 'Mic on' : 'Mic off'}
                </Button>
              )}
              <Button variant="danger" onClick={stop} className="px-3 py-2 text-xs">
                <Square className="h-4 w-4" /> End session
              </Button>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Conversation — left column */}
          <Card className="order-2 flex h-full min-h-0 flex-col lg:order-1">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted">
                Conversation
              </div>
              <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                {turns.map((t) => (
                  <div key={t.id} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                        t.role === 'user' ? 'aurora-bg text-ink' : 'border border-line bg-surface-2 text-cream'
                      }`}
                    >
                      <p>{t.text}</p>
                      {t.role === 'emora' && (
                        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px]">
                          {t.emotion && <EmotionBadge emotion={t.emotion} />}
                          {typeof t.stress === 'number' && (
                            <span className="font-mono uppercase tracking-widest text-muted">stress {t.stress}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {state === 'thinking' && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-line bg-surface-2 px-4 py-3">
                      <ThinkingDots />
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={typeText}
                  onChange={(e) => setTypeText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      submitMessage(typeText, false)
                      setTypeText('')
                    }
                  }}
                  placeholder={state === 'listening' ? 'Speak… or type here' : 'Type while I listen…'}
                  disabled={state === 'thinking' || state === 'speaking'}
                  className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-cream placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-50"
                />
                <Button
                  disabled={state === 'thinking' || state === 'speaking' || !typeText.trim()}
                  onClick={() => {
                    submitMessage(typeText, mode === 'camera')
                    setTypeText('')
                  }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                  {state === 'listening' ? <Mic className="h-3 w-3 animate-pulse-soft text-accent" /> : <MicOff className="h-3 w-3" />}
                  {state === 'listening' ? 'listening' : state === 'thinking' ? 'thinking' : state === 'speaking' ? 'speaking' : 'paused'}
                </span>
                <button onClick={() => submitMessage('I just need a moment of calm. Could you suggest something grounding?', mode === 'camera')} className="text-xs text-accent hover:underline">
                  Ask for a grounding exercise
                </button>
              </div>
            </Card>

            {/* Voice analysis — right column */}
            <div className="order-3 flex h-full min-h-0 flex-col gap-4">
              {/* Voice panel */}
              <Card className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Voice</h2>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted">
                    <Mic className={`h-3 w-3 ${state === 'listening' ? 'text-accent' : 'text-muted'}`} />
                    {state === 'listening' ? 'capturing' : 'paused'}
                  </span>
                </div>
                <VoiceEnergy analyser={analyserRef} active={state === 'listening' || state === 'starting'} />
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span className="text-sm">Dominant</span>
                    {voice ? <EmotionBadge emotion={voice.emotion} /> : <span className="text-xs text-muted">…</span>}
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span className="text-sm">Stress level</span>
                    <span className={`font-mono text-sm ${(voice?.stress ?? 0) > 60 ? 'text-stressed' : 'text-cream'}`}>
                      {voice?.stress ?? '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                    <span className="text-sm">Confidence</span>
                    <span className="font-mono text-sm text-muted">{voice?.confidence != null ? `${voice.confidence}%` : '—'}</span>
                  </div>
                </div>
              </Card>

              {/* Emotion distribution */}
              <Card className="min-h-0 flex-1 overflow-auto">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Emotions</h2>
                {face && Object.keys(face.distribution).length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {Object.entries(face.distribution)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 4)
                      .map(([emotion, val]) => {
                        const c = emotionColor(emotion)
                        return (
                          <div key={emotion}>
                            <div className="mb-0.5 flex justify-between text-xs">
                              <span className="capitalize">{emotionLabel(emotion)}</span>
                              <span className="font-mono text-muted">{Math.round(val)}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                              <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: c }} />
                            </div>
                          </div>
                        )
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    {mode === 'mic' ? 'Emotion from voice appears here.' : 'Waiting for camera frames…'}
                  </p>
                )}
              </Card>
            </div>
        </div>
        </>
      )}
    </div>
  )
}
