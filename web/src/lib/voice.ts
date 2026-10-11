// Voz del sistema (speechSynthesis). Gratis, sin descargas y ya viene en el
// iPhone. En iOS la lista de voces llega vacía hasta el primer toque del
// usuario, por eso hay que volver a preguntar cuando el sistema avise.

export interface VoiceOption {
  name: string
  lang: string
  /** Voces locales (Enhanced/Premium) suenan mejor y no dependen de internet. */
  local: boolean
  /** Las voces mejoradas del sistema suelen sonar mucho mejor. */
  enhanced: boolean
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Voces en inglés del dispositivo, sin repetir. */
export function englishVoices(): VoiceOption[] {
  if (!isSpeechSupported()) return []
  const seen = new Set<string>()
  const options: VoiceOption[] = []

  for (const voice of window.speechSynthesis.getVoices()) {
    const lang = voice.lang.replace('_', '-')
    if (!lang.toLowerCase().startsWith('en')) continue
    const label = voice.name.replace(/\s*\(.*?\)\s*/g, ' ').trim()
    if (seen.has(label)) continue
    seen.add(label)
    options.push({
      name: voice.name,
      lang,
      local: voice.localService,
      enhanced: /enhanced|premium|neural|siri/i.test(voice.name),
    })
  }

  return options.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
}

/** Avisa cuando el sistema termina de cargar las voces. Devuelve cómo dejar de escuchar. */
export function onVoicesChanged(callback: () => void): () => void {
  if (!isSpeechSupported()) return () => {}
  window.speechSynthesis.addEventListener('voiceschanged', callback)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', callback)
}

/** Lee un texto en voz alta. `voiceName` vacío = la voz por defecto del sistema. */
export function speak(text: string, voiceName?: string | null, rate = 0.95): void {
  const clean = text.trim()
  if (!isSpeechSupported() || clean.length === 0) return

  const synth = window.speechSynthesis
  synth.cancel()

  const utterance = new SpeechSynthesisUtterance(clean)
  utterance.rate = rate
  if (voiceName) {
    const wanted = voiceName.toLowerCase()
    const voice =
      synth.getVoices().find((item) => item.name.toLowerCase() === wanted) ??
      synth.getVoices().find((item) => item.name.toLowerCase().startsWith(wanted))
    if (voice) {
      utterance.voice = voice
      utterance.lang = voice.lang.replace('_', '-')
    }
  }
  synth.speak(utterance)
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}

const FEMALE = /samantha|karen|moira|tessa|victoria|fiona|serena|allison|ava|susan|zira|aria|jenny|emma|amy|nicole|joanna|salli|kimberly|michelle|kate|federica|alice|sonia|libby|clara/i
const MALE = /daniel|alex|fred|tom|oliver|arthur|rishi|aaron|nathan|guy|ryan|matthew|brian|joey|justin|kevin|george|lee|eddy|reed|rocko|gordon/i

/**
 * Busca la voz que mejor encaja con un personaje. Solo sugiere: tú siempre
 * puedes cambiarla a mano en la lista.
 */
export function suggestVoice(
  options: VoiceOption[],
  hint: { lang: 'en-US' | 'en-GB' | 'en-AU' | null; gender: 'male' | 'female' | 'any' },
): string | null {
  if (options.length === 0) return null

  let best: VoiceOption | null = null
  let bestScore = -Infinity

  for (const option of options) {
    let score = 0
    if (hint.lang && option.lang.toLowerCase() === hint.lang.toLowerCase()) score += 4
    if (hint.gender === 'female' && FEMALE.test(option.name)) score += 3
    if (hint.gender === 'male' && MALE.test(option.name)) score += 3
    if (option.enhanced) score += 2
    if (option.local) score += 1
    if (score > bestScore) {
      bestScore = score
      best = option
    }
  }

  return best?.name ?? null
}
