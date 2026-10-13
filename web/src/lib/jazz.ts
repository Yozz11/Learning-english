/*
 * Música de fondo de la app: un jazz suave a volumen bajito, en loop.
 * El <audio> vive fuera de React (una sola instancia) para que la música
 * siga sonando al cambiar de pantalla sin reiniciarse.
 *
 * Música: «Feelin Good» por Kevin MacLeod (incompetech.com).
 * Licencia: CC-BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
 * https://incompetech.com/music/royalty-free/mp3-royaltyfree/Feelin%20Good.mp3
 */

const AUDIO_SRC = '/audio/jazz-fondo.mp3'

/** Volumen bajito, tipo ascensor. */
const JAZZ_VOLUME = 0.14

let audio: HTMLAudioElement | null = null
let on = false
const listeners = new Set<(on: boolean) => void>()

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(AUDIO_SRC)
    audio.loop = true
    audio.preload = 'none'
    audio.volume = JAZZ_VOLUME
  }
  return audio
}

function emit() {
  for (const listener of listeners) listener(on)
}

export function isJazzOn(): boolean {
  return on
}

/**
 * Enciende o apaga la música. Se llama desde el botón, que es un gesto del
 * usuario: así no choca con la política de audio automático de iOS/Safari.
 */
export function toggleJazz(): boolean {
  const el = getAudio()
  if (on) {
    el.pause()
    on = false
  } else {
    el.volume = JAZZ_VOLUME
    on = true
    // Si el navegador bloquea el play, apagamos el estado para no mentirle al botón.
    void el.play().catch(() => {
      on = false
      emit()
    })
  }
  emit()
  return on
}

export function onJazzChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}