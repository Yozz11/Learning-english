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
const JAZZ_VOLUME = 0.2

/** Si el usuario apagó la música a mano, se respeta en las próximas visitas. */
const OFF_KEY = 'english-coach:jazz-off'

let audio: HTMLAudioElement | null = null
let on = false
const listeners = new Set<(on: boolean) => void>()

/** ¿Se puede encender la música? Solo si el usuario no la apagó antes. */
function wanted(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== '1'
  } catch {
    // Sin localStorage (algunos modos privados): se enciende igual, solo no se recuerda.
    return true
  }
}

function remember(off: boolean) {
  try {
    if (off) localStorage.setItem(OFF_KEY, '1')
    else localStorage.removeItem(OFF_KEY)
  } catch {
    // Igual que arriba: es solo una preferencia, no pasa nada si no se puede guardar.
  }
}

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
    remember(true)
  } else {
    el.volume = JAZZ_VOLUME
    on = true
    remember(false)
    // Si el navegador bloquea el play, apagamos el estado para no mentirle al botón.
    void el.play().catch(() => {
      on = false
      emit()
    })
  }
  emit()
  return on
}

/**
 * Enciende la música sola en el primer toque dentro de la app. Los navegadores
 * no dejan sonar nada antes de un gesto del usuario, y el botón queda lejos:
 * así la música de fondo aparece sin tener que buscarla (si no la apagó antes).
 *
 * Devuelve la función para dejar de escuchar (al desmontar la pantalla).
 */
export function autoStartJazz(): () => void {
  const start = (event: Event) => {
    disarm()
    // Si el toque fue en el botón, decide el botón: aquí no lo pisamos.
    const target = event.target as Element | null
    if (target?.closest?.('.jazz-btn')) return
    if (wanted() && !on) toggleJazz()
  }

  const disarm = () => {
    window.removeEventListener('pointerdown', start, true)
    window.removeEventListener('keydown', start, true)
  }

  // En captura: llega antes que el resto de la app, así el play cae dentro del gesto.
  window.addEventListener('pointerdown', start, true)
  window.addEventListener('keydown', start, true)
  return disarm
}

export function onJazzChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}