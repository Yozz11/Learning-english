import type { CharacterDetail, TeacherConfig } from '@english-coach/shared'
import { SPANISH_USAGE_LABELS, avatarSrc } from '@english-coach/shared'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/icons'
import { Alert, Button, LoadingBox } from '../components/ui'
import { api, errorMessage } from '../lib/api'

/*
 * Ficha del personaje: quién es, cómo habla y cómo corrige. Todo lo que se ve
 * aquí es lo que el personaje usa de verdad en la charla, y se edita en
 * "Editar" (/editar/:id).
 */
const SECTIONS: { label: string; value: keyof TeacherConfig; pre?: boolean }[] = [
  { label: 'Cómo es', value: 'personality' },
  { label: 'Cómo habla', value: 'speechStyle' },
  { label: 'Cómo abre la charla', value: 'greeting' },
  { label: 'Diálogos de ejemplo', value: 'examples', pre: true },
  { label: 'Lo que nunca hace', value: 'neverDoes' },
  { label: 'Escenarios', value: 'scenarios' },
]

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kv">
      <div className="kv-k">{label}</div>
      <div className="kv-v">{children}</div>
    </div>
  )
}

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

  const { config } = character
  const src = avatarSrc(character.avatar)
  const maxCorrections = config.maxCorrections ?? 1
  const correctionsLabel =
    maxCorrections === 1 ? '1 error por mensaje' : `${maxCorrections} errores por mensaje`

  return (
    <div className="ficha">
      <div className="ficha-top">
        <Link className="link-btn back-link" to="/">
          <Icon name="back" size={18} />
          Volver
        </Link>
        <Link className="link-btn back-link" to={`/editar/${character.id}`}>
          Editar
          <Icon name="pencil" size={18} />
        </Link>
      </div>

      <div className="ficha-img">
        {src ? <img src={src} alt="" /> : character.name.trim().charAt(0).toUpperCase()}
      </div>

      <h1 className="ficha-name">{character.name}</h1>
      <p className="ficha-tagline">{character.tagline}</p>

      <div className="chips">
        <span className="chip">Corrige {correctionsLabel}</span>
        <span className="chip">Español: {SPANISH_USAGE_LABELS[config.spanishUsage]}</span>
        <span className="chip">{character.messageCount} mensajes tuyos</span>
      </div>

      <div className="ficha-actions">
        <Link className="btn btn-primary btn-lg btn-block" to={`/entrenar/${character.id}`}>
          Entrenar
        </Link>
        <Link className="btn btn-lg btn-block" to={`/chat/${character.id}`}>
          Charlar
        </Link>
        <Button
          className="btn-block"
          aria-pressed={character.favorite}
          onClick={toggleFavorite}
        >
          {character.favorite ? 'Siguiendo' : 'Seguir'}
        </Button>
      </div>

      {SECTIONS.map((section) => {
        const value = character.config[section.value]
        if (typeof value !== 'string' || value.trim() === '') return null
        return (
          <Row key={section.label} label={section.label}>
            <p className={section.pre ? 'ficha-pre' : undefined}>{value}</p>
          </Row>
        )
      })}
    </div>
  )
}
