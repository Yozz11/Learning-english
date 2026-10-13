import type {
  CharacterCard,
  CharacterChat,
  ChatMessage,
  Conversation,
  HomeData,
  SendMessageResponse,
} from '@english-coach/shared'
import { avatarSrc, scoreLabel } from '@english-coach/shared'
import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Icon } from '../components/icons'
import { Alert, LoadingBox } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { isSpeechSupported, speak, stopSpeaking } from '../lib/voice'

/*
 * La charla, personaje por personaje: cada uno tiene su propia conversación y
 * su propia ficha manda en el prompt. En el móvil ocupa la pantalla completa
 * (sin barra abajo); en el escritorio, a la derecha va el panel del personaje.
 */
type PanelData = { level: string; errors: string }

export function ChatPage() {
  const { characterId } = useParams()
  const { pathname } = useLocation()
  // /chat/:id conversa; /entrenar/:id practica con ejercicios con ese profesor.
  const mode: 'chat' | 'train' = pathname.startsWith('/entrenar') ? 'train' : 'chat'
  const modeQuery = mode === 'train' ? '?mode=train' : ''
  const [chat, setChat] = useState<CharacterChat | null>(null)
  const [panel, setPanel] = useState<PanelData | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!characterId) return
    let active = true
    setLoading(true)
    setError(null)
    api
      .get<{ data: CharacterChat }>(`/api/characters/${encodeURIComponent(characterId)}/chat${modeQuery}`)
      .then((result) => {
        if (active) setChat(result.data)
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [characterId, modeQuery])

  // El panel del escritorio: tu nivel y los errores que más repites.
  useEffect(() => {
    api
      .get<HomeData>('/api/home')
      .then((home) => {
        const measured = home.skills.filter((skill) => skill.score !== null)
        const average =
          measured.length > 0
            ? measured.reduce((total, skill) => total + (skill.score ?? 0), 0) / measured.length
            : null
        const seen = new Set<string>()
        const errors = home.topErrors
          .map((item) => item.topic.trim())
          .filter((topic) => topic !== '' && !seen.has(topic) && seen.add(topic))
        setPanel({
          level: average === null ? 'Sin medir todavía' : scoreLabel(average),
          errors: errors.slice(0, 4).join(' · '),
        })
      })
      .catch(() => {
        // Sin panel la charla funciona igual.
      })
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [chat?.messages.length, busy])

  useEffect(() => stopSpeaking, [])

  async function startNewConversation() {
    if (!characterId || busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.post<{ data: { conversation: Conversation; messages: ChatMessage[] } }>(
        `/api/characters/${encodeURIComponent(characterId)}/chat${modeQuery}`,
      )
      setChat((previous) => (previous ? { ...previous, ...result.data } : previous))
      setDraft('')
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function send(event?: FormEvent) {
    event?.preventDefault()
    const content = draft.trim()
    const conversation = chat?.conversation
    if (!conversation || busy || content.length === 0) return

    setBusy(true)
    setError(null)
    setDraft('')

    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      createdAt: Date.now(),
      corrections: [],
    }
    setChat((previous) =>
      previous ? { ...previous, messages: [...previous.messages, optimistic] } : previous,
    )

    try {
      const response = await api.post<SendMessageResponse>(
        `/api/conversations/${conversation.id}/messages`,
        { content },
      )
      setChat((previous) =>
        previous
          ? {
              ...previous,
              messages: [
                ...previous.messages.filter((message) => message.id !== optimistic.id),
                response.userMessage,
                response.reply,
              ],
            }
          : previous,
      )
      if (chat?.character.config.autoSpeak) speak(response.reply.content, chat.character.config.voice)
    } catch (caught) {
      setError(errorMessage(caught))
      setChat((previous) =>
        previous
          ? { ...previous, messages: previous.messages.filter((m) => m.id !== optimistic.id) }
          : previous,
      )
      setDraft(content)
    } finally {
      setBusy(false)
    }
  }

  // Sin personaje en la dirección (el botón "Chats"): se sigue con el último.
  if (!characterId) return <LastCharacter />

  if (loading) return <LoadingBox />
  if (error && !chat) return <Alert>{error}</Alert>
  if (!chat) return <LoadingBox />

  const { character, conversation, messages } = chat
  const config = character.config
  const face = avatarSrc(character.avatar)
  const lastReply = [...messages].reverse().find((message) => message.role === 'assistant')

  return (
    <div className="chat">
      <header className="chat-head">
        <Link className="icon-btn" to={`/personaje/${character.id}`} aria-label="Volver a la ficha">
          <Icon name="back" />
        </Link>
        <Face src={face} name={character.name} className="chat-face" />
        <div className="chat-id">
          <h1 className="chat-nm">{character.name}</h1>
          <p className={conversation.mode === 'train' ? 'chat-mode train' : 'chat-mode'}>
            {conversation.mode === 'train' ? 'Entrenando · práctica y ejercicios' : 'Conversación'}
          </p>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Otra charla"
          onClick={startNewConversation}
          disabled={busy}
        >
          <Icon name="pencil" />
        </button>
        {isSpeechSupported() && lastReply ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Escuchar la última respuesta"
            onClick={() => speak(lastReply.content, config.voice)}
          >
            <Icon name="volume" />
          </button>
        ) : null}
        <button type="button" className="icon-btn off" aria-disabled="true" title="Llamada: más adelante">
          <Icon name="phone" />
        </button>
      </header>

      <div className="chat-body">
        <div className="chat-col">
          <div className="chat-msgs" aria-live="polite" aria-busy={busy}>
            {messages.length === 0 ? (
              <div className="empty">
                {character.name} todavía no dijo nada. Escribe en inglés y empieza tú.
              </div>
            ) : (
              messages.map((message) =>
                message.role === 'user' ? (
                  <div key={message.id} className="msg-me">
                    {message.content}
                  </div>
                ) : (
                  <Fragment key={message.id}>
                    <div className="msg-bot">
                      <CharacterLine text={message.content} />
                    </div>
                    {message.corrections.slice(0, 2).map((correction) => (
                      <div key={correction.id} className="fix">
                        <b>Mejor:</b> {correction.correction}
                        <br />
                        {correction.explanation}
                      </div>
                    ))}
                    {isSpeechSupported() ? (
                      <div className="msg-actions">
                        <button
                          type="button"
                          className="link-btn"
                          onClick={() => speak(message.content, config.voice)}
                        >
                          Escuchar
                        </button>
                      </div>
                    ) : null}
                  </Fragment>
                ),
              )
            )}
            {busy ? <div className="msg-bot muted">escribiendo…</div> : null}
            <div ref={endRef} />
          </div>

          <form className="chat-composer" onSubmit={send}>
            <div className="composer-bar">
              <div className="composer-field">
                <span className="me-av" aria-hidden="true">
                  <Icon name="user" />
                </span>
                <input
                  value={draft}
                  maxLength={2000}
                  placeholder="Mensaje en inglés…"
                  aria-label="Mensaje"
                  onChange={(event) => setDraft(event.target.value)}
                />
              </div>
              <button
                type="submit"
                className="composer-send"
                aria-label="Enviar"
                disabled={busy || draft.trim().length === 0}
              >
                <Icon name="send" />
              </button>
            </div>
            <p className="disclaimer">Esto es una IA, no una persona real.</p>
          </form>

          {error ? <Alert>{error}</Alert> : null}
        </div>

        <aside className="chat-panel" aria-label="Ficha del profesor">
          <Face src={face} name={character.name} className="panel-face" />
          <h2>{character.name}</h2>
          <p>{character.tagline}</p>
          <div className="panel-k">Tu nivel</div>
          <div className="panel-v">{panel?.level ?? '—'}</div>
          <div className="panel-k">Errores recientes</div>
          <div className="panel-v">{panel?.errors || 'Todavía ninguno.'}</div>
          <Link className="link-btn panel-link" to={`/personaje/${character.id}`}>
            Ver la ficha completa
          </Link>
        </aside>
      </div>
    </div>
  )
}

/**
 * "Chats" sin personaje: sigue con el que usaste por última vez. Evita una
 * pantalla de lista que todavía no existe.
 */
function LastCharacter() {
  const [target, setTarget] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    api
      .get<{ data: CharacterCard[] }>('/api/characters')
      .then((result) => {
        const sorted = [...result.data].sort(
          (a, b) => (b.lastUsedAt ?? b.createdAt) - (a.lastUsedAt ?? a.createdAt),
        )
        setTarget(sorted[0]?.id ?? null)
      })
      .catch(() => setTarget(null))
  }, [])

  if (target === undefined) return <LoadingBox />
  if (target === null) return <Navigate to="/" replace />
  return <Navigate to={`/chat/${target}`} replace />
}

/** Los asteriscos del personaje (*acción*) se ven en cursiva, como en el plano. */
function CharacterLine({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*([^*]+)\*/g).map((part, index) =>
        index % 2 === 1 ? <em key={index}>{part}</em> : <span key={index}>{part}</span>,
      )}
    </>
  )
}

/** La cara del personaje: su dibujo, o su inicial si todavía no tiene imagen. */
function Face({ src, name, className }: { src: string | null; name: string; className: string }) {
  return (
    <div className={className} aria-hidden="true">
      {src ? <img src={src} alt="" /> : name.trim().charAt(0).toUpperCase()}
    </div>
  )
}
