import type { ChatMessage, Conversation, SendMessageResponse, TeacherConfig } from '@english-coach/shared'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Alert, Button, Card, LoadingBox } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { isSpeechSupported, speak, stopSpeaking } from '../lib/voice'

export function ChatPage() {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [teacher, setTeacher] = useState<TeacherConfig | null>(null)
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const bootstrapped = useRef(false)

  useEffect(() => {
    // StrictMode monta dos veces en desarrollo; sin esto se crearían charlas de más.
    if (bootstrapped.current) return
    bootstrapped.current = true
    void loadLatestConversation()
    api
      .get<TeacherConfig>('/api/teacher')
      .then(setTeacher)
      .catch(() => {
        // Sin la configuración la charla funciona igual: solo se pierde el avatar y la voz.
      })
    return () => {
      stopSpeaking()
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function loadLatestConversation() {
    try {
      const conversations = await api.get<Conversation[]>('/api/conversations')
      const latest = conversations[0] ?? (await api.post<Conversation>('/api/conversations'))
      await openConversation(latest)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setLoading(false)
    }
  }

  async function openConversation(target: Conversation) {
    const history = await api.get<ChatMessage[]>(`/api/conversations/${target.id}/messages`)
    setConversation(target)
    setMessages(history)
  }

  async function startNewConversation() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await openConversation(await api.post<Conversation>('/api/conversations'))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    const content = draft.trim()
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
    setMessages((previous) => [...previous, optimistic])

    try {
      const response = await api.post<SendMessageResponse>(
        `/api/conversations/${conversation.id}/messages`,
        { content },
      )
      setMessages((previous) => [
        ...previous.filter((message) => message.id !== optimistic.id),
        response.userMessage,
        response.reply,
      ])
      if (teacher?.autoSpeak) speak(response.reply.content, teacher.voice)
    } catch (caught) {
      setError(errorMessage(caught))
      setMessages((previous) => previous.filter((message) => message.id !== optimistic.id))
      setDraft(content)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBox />

  const avatar = teacher?.avatar ?? null
  const teacherName = teacher?.name ?? 'Profe'

  return (
    <>
      <Card>
        <div className="spread">
          <div className="row">
            <Avatar avatar={avatar} name={teacherName} size={34} />
            <div>
              <h2>Charla</h2>
              <p className="tiny">{teacherName} · {conversation?.title ?? 'Sin conversación'}</p>
            </div>
          </div>
          <Button className="btn-small" variant="ghost" onClick={startNewConversation} disabled={busy}>
            Nueva
          </Button>
        </div>
      </Card>

      {messages.length === 0 ? (
        <div className="empty">
          Escribe en inglés lo que quieras. Si te equivocas, el profe te corrige lo importante.
        </div>
      ) : (
        <div className="messages" aria-live="polite" aria-busy={busy}>
          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className="bubble bubble-user">
                {message.content}
              </div>
            ) : (
              <div key={message.id} className="teach-row">
                <Avatar avatar={avatar} name={teacherName} size={30} />
                <div className="bubble bubble-teacher">
                  {message.content}
                  {message.corrections.length > 0 ? (
                    <div className="corrections">
                      {message.corrections.map((correction) => (
                        <div key={correction.id} className="correction">
                          <b>{correction.correction}</b>
                          <div className="tiny">
                            En vez de “{correction.original}” · {correction.explanation}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {isSpeechSupported() ? (
                    <div className="bubble-tools">
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => speak(message.content, teacher?.voice ?? null)}
                      >
                        Escuchar
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ),
          )}
          {busy ? (
            <div className="teach-row">
              <Avatar avatar={avatar} name={teacherName} size={30} />
              <div className="bubble bubble-teacher muted">escribiendo…</div>
            </div>
          ) : null}
        </div>
      )}

      {error ? <Alert>{error}</Alert> : null}

      <div className="composer">
        <textarea
          value={draft}
          maxLength={2000}
          placeholder="Write in English…"
          rows={2}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
        />
        <div className="spread">
          <span className="tiny">
            {teacher?.autoSpeak ? 'Te leo las respuestas en voz alta' : 'Enter para enviar'}
          </span>
          <Button variant="primary" onClick={send} disabled={busy || draft.trim().length === 0}>
            {busy ? 'Escribiendo…' : 'Enviar'}
          </Button>
        </div>
      </div>

      <div ref={endRef} />
    </>
  )
}
