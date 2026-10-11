import type { CharacterCard } from '@english-coach/shared'
import { useEffect, useMemo, useState } from 'react'
import { CharacterTile } from '../components/CharacterTile'
import { Icon } from '../components/icons'
import { Alert, LoadingBox } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { useSession } from '../lib/session'

/*
 * Inicio: la biblioteca de personajes del usuario. Cuatro pestañas que filtran
 * u ordenan la misma lista, y un buscador por nombre o por frase.
 */
const TABS = [
  { id: 'foryou', label: 'Para ti' },
  { id: 'following', label: 'Siguiendo' },
  { id: 'trending', label: 'Tendencia' },
  { id: 'new', label: 'Destacados' },
] as const

type TabId = (typeof TABS)[number]['id']

const EMPTY: Record<TabId, string> = {
  foryou: 'Todavía no hay personajes en tu biblioteca.',
  following: 'Todavía no seguís a ninguno. Abre una ficha y toca la estrella.',
  trending: 'Cuando hables con ellos, aquí aparecen los más usados.',
  new: 'No hay personajes nuevos por mirar.',
}

/** Qué se ve en cada pestaña: se filtra por el buscador y después se ordena. */
function visibleCharacters(all: CharacterCard[], tab: TabId, query: string): CharacterCard[] {
  const needle = query.trim().toLowerCase()
  const found = needle
    ? all.filter(
        (character) =>
          character.name.toLowerCase().includes(needle) ||
          character.tagline.toLowerCase().includes(needle),
      )
    : all

  switch (tab) {
    case 'following':
      return found.filter((character) => character.favorite)
    case 'trending':
      return [...found].sort(
        (a, b) => b.messageCount - a.messageCount || a.name.localeCompare(b.name),
      )
    case 'new':
      return [...found].sort((a, b) => b.createdAt - a.createdAt)
    default:
      return [...found].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
  }
}

/** El "@usuario" del plano es el nombre del perfil, sin espacios. */
function profileHandle(displayName: string | null): string {
  const clean = (displayName ?? '').trim().replace(/\s+/g, '').toLowerCase()
  return clean || 'tú'
}

export function HomePage() {
  const { session } = useSession()
  const [characters, setCharacters] = useState<CharacterCard[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('foryou')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    api
      .get<{ data: CharacterCard[] }>('/api/characters')
      .then((result) => {
        if (active) setCharacters(result.data)
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
      })
    return () => {
      active = false
    }
  }, [])

  const list = useMemo(
    () => (characters ? visibleCharacters(characters, tab, query) : []),
    [characters, tab, query],
  )
  const hasNews = (characters ?? []).some((character) => character.isNew)
  const handle = profileHandle(session?.displayName ?? null)

  if (error) return <Alert>{error}</Alert>
  if (!characters) return <LoadingBox />

  return (
    <div className="home">
      <div className="topbar">
        <div className="brand">english</div>
        <div className="icons">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Novedades${hasNews ? '' : ' (nada nuevo)'}`}
            onClick={() => setTab('new')}
          >
            <Icon name="bell" />
            {hasNews ? <span className="dot" /> : null}
          </button>
        </div>
      </div>

      <div className="search">
        <Icon name="search" />
        <input
          type="search"
          value={query}
          aria-label="Buscar personaje"
          placeholder="Buscar personaje"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="tabs" role="tablist" aria-label="Filtros de personajes">
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={tab === entry.id ? 'tab active' : 'tab'}
            onClick={() => setTab(entry.id)}
          >
            {entry.label}
            {entry.id === 'new' && (characters ?? []).some((character) => character.isNew) ? (
              <span className="dot dot-blue" aria-hidden="true" />
            ) : null}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="empty" style={{ margin: '20px 16px' }}>
          {query.trim() ? 'No encontré ningún personaje con ese nombre.' : EMPTY[tab]}
        </p>
      ) : (
        <div className="grid">
          {list.map((character) => (
            <CharacterTile key={character.id} character={character} handle={handle} />
          ))}
        </div>
      )}
    </div>
  )
}
