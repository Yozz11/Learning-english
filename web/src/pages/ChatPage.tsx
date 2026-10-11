import type { ChatMessage, Conversation, SendMessageResponse } from '@english-coach/shared'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, LoadingBox } from '../components/ui'
import { api, errorMessage } from '../lib/api'

export function ChatPage() {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
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
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, busy])

  async function loadLatestConversation() {
    setLoading(true)
    setError(null)
    try {
      const list = await api.get<Conversation[]>('/api/conversations')
      const current = list[0] ?? (await api.post<Conversation>('/api/conversations'))
      await openConversation(current)
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
    } catch (caught) {
      setError(errorMessage(caught))
      setMessages((previous) => previous.filter((message) => message.id !== optimistic.id))
      setDraft(content)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBox />

  return (
    <>
      <Card>
        <div className="spread">
          <div>
            <h2>Charla</h2>
            <p className="tiny">{conversation?.title ?? 'Sin conversación'}</p>
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
        <div className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'user' ? 'bubble bubble-user' : 'bubble bubble-teacher'}
            >
              {message.content}
              {message.corrections.length > 0 ? (
                <div className="corrections">
                  {message.corrections.map((correction) => (
                    <div key={correction.id} className="correction">
                      <b>{correction.correction}</b> — {correction.explanation}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          {busy ? (
            <div className="bubble bubble-teacher">
              <span className="muted">escribiendo…</span>
            </div>
          ) : null}
        </div>
      )}

      {error ? <Alert>{error}</Alert> : null}

      <div className="composer">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type in English…"
          rows={2}
          disabled={busy}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
        />
        <Button variant="primary" className="btn-block" onClick={send} disabled={busy || draft.trim().length === 0}>
          {busy ? 'Pensando…' : 'Enviar'}
        </Button>
      </div>
      <div ref={endRef} />
    </>
  )
}
