import { useEffect, useState } from 'react'
import { isJazzOn, onJazzChange, toggleJazz } from '../lib/jazz'
import { Icon } from './icons'

/*
 * Botón flotante de música de fondo. Se mantiene encendido al navegar:
 * el <audio> vive fuera de React (lib/jazz.ts).
 */
export function MusicToggle() {
  const [on, setOn] = useState(isJazzOn)

  useEffect(() => onJazzChange(setOn), [])

  return (
    <button
      type="button"
      className={on ? 'jazz-btn on' : 'jazz-btn'}
      aria-label={on ? 'Apagar música de fondo' : 'Encender música de fondo'}
      aria-pressed={on}
      title="Música de fondo"
      onClick={() => toggleJazz()}
    >
      <Icon name="music" className="i" />
    </button>
  )
}