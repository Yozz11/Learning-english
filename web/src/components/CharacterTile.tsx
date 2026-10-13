import type { CharacterCard } from '@english-coach/shared'
import { avatarSrc } from '@english-coach/shared'
import { Link } from 'react-router-dom'
import { Icon } from './icons'

/**
 * La tarjeta de un profesor en el inicio. Las medidas son las del plano:
 * imagen cuadrada, nombre, frase de dos líneas y el contador de mensajes.
 * Al pasar el mouse aparecen las dos formas de entrar: entrenar o charlar.
 */
export function CharacterTile({ character, handle }: { character: CharacterCard; handle: string }) {
  const src = avatarSrc(character.avatar)
  const initial = character.name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div className="card">
      <Link className="card-link" to={`/personaje/${character.id}`}>
        <div className="img">{src ? <img src={src} alt="" /> : initial}</div>
        <div className="name">{character.name}</div>
        <div className="tag">{character.tagline}</div>
        <div className="meta">
          <Icon name="chat" size={14} />
          <span>{character.messageCount}</span>
          <span>@{handle}</span>
        </div>
      </Link>
      <div className="card-actions">
        <Link className="mini-btn primary" to={`/entrenar/${character.id}`}>
          Entrenar
        </Link>
        <Link className="mini-btn" to={`/chat/${character.id}`}>
          Charlar
        </Link>
      </div>
    </div>
  )
}