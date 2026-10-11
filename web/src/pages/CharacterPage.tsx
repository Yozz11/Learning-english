import type { CharacterDetail } from '@english-coach/shared'
import { avatarSrc } from '@english-coach/shared'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/icons'
import { Alert, Button, LoadingBox } from '../components/ui'
import { api, errorMessage } from '../lib/api'

/*
 * Ficha del personaje. Por ahora enseña quién es y deja seguirlo; el chat con
 * cada personaje llega en el paso siguiente de la remodelación.
 */
export function CharacterPage() {
  const { characterId = '' } = useParams()
  const [character, setCharacter] = useState<CharacterDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .get<{ data: CharacterDetail }>(`/api/characters/${encodeURIComponent(characterId)}`)
      .then((result) => {
        if (active) setCharacter(result.data)
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
      })
    return () => {
      active = false
    }
  }, [characterId])

  const toggleFavorite = useCallback(async () => {
    if (!character) return
    setError(null)
    try {
      const result = await api.post<{ data: CharacterDetail }>(
        `/api/characters/${encodeURIComponent(character.id)}/favorite`,
        { favorite: !character.favorite },
      )
      setCharacter(result.data)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }, [character])

  if (error) return <Alert>{error}</Alert>
  if (!character) return <LoadingBox />

  const src = avatarSrc(character.avatar)

  return (
    <div className="ficha">
      <Link className="link-btn back-link" to="/">
        <Icon name="back" size={18} />
        Volver
      </Link>

      <div className="ficha-img">
        {src ? <img src={src} alt="" /> : character.name.trim().charAt(0).toUpperCase()}
      </div>

      <h1 className="ficha-name">{character.name}</h1>
      <p className="ficha-tagline">{character.tagline}</p>
      <p className="tiny">{character.messageCount} mensajes tuyos</p>

      <div className="row" style={{ marginTop: 16 }}>
        <Link to={`/chat/${character.id}`}>
          <Button variant="primary">Chatear</Button>
        </Link>
        <Button className="btn-small" onClick={toggleFavorite}>
          {character.favorite ? 'Siguiendo' : 'Seguir'}
        </Button>
      </div>
    </div>
  )
}
