export const EMOTION_COLORS: Record<string, string> = {
  happy: '#E3C08D',
  surprised: '#E3C08D',
  relaxed: '#A8C4A2',
  calm: '#A8C4A2',
  excited: '#E8A0A0',
  neutral: '#8A9099',
  sad: '#6B8CAE',
  fear: '#6B8CAE',
  stressed: '#E5626C',
  anxious: '#E5626C',
  angry: '#C4453F',
  disgust: '#C4453F',
  unknown: '#8A9099',
}

export const EMOTION_LABELS: Record<string, string> = {
  happy: 'Happy',
  surprised: 'Surprised',
  relaxed: 'Relaxed',
  calm: 'Calm',
  excited: 'Excited',
  neutral: 'Neutral',
  sad: 'Sad',
  fear: 'Anxious',
  stressed: 'Stressed',
  anxious: 'Anxious',
  angry: 'Angry',
  disgust: 'Disgusted',
  unknown: 'Neutral',
}

export const EMOTION_EMOJI: Record<string, string> = {
  happy: '😄',
  surprised: '😮',
  relaxed: '😌',
  calm: '😌',
  excited: '🤩',
  neutral: '😐',
  sad: '😢',
  fear: '😨',
  stressed: '😟',
  anxious: '😟',
  angry: '😠',
  disgust: '🤢',
  unknown: '😐',
}

export function emotionColor(emotion?: string | null): string {
  if (!emotion) return EMOTION_COLORS.unknown
  return EMOTION_COLORS[emotion.toLowerCase()] ?? EMOTION_COLORS.unknown
}

export function emotionLabel(emotion?: string | null): string {
  if (!emotion) return 'Neutral'
  return EMOTION_LABELS[emotion.toLowerCase()] ?? emotion
}

export function emotionEmoji(emotion?: string | null): string {
  if (!emotion) return EMOTION_EMOJI.unknown
  return EMOTION_EMOJI[emotion.toLowerCase()] ?? '😐'
}

/** Color for a 1–5 mood value (used in the mood calendar heatmap). */
export function moodColor(mood: number | null | undefined): string {
  switch (mood) {
    case 1: return '#C4453F'
    case 2: return '#E5626C'
    case 3: return '#8A9099'
    case 4: return '#A8C4A2'
    case 5: return '#E3C08D'
    default: return '#2A313A'
  }
}

export const MOOD_DOT_BG: Record<number, string> = {
  1: 'bg-angry',
  2: 'bg-stressed',
  3: 'bg-neutral',
  4: 'bg-relaxed',
  5: 'bg-happy',
}
