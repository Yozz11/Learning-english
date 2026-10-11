import type { UploadMode, UploadRecord } from '@english-coach/shared'
import { UPLOAD_MODE_LABELS } from '@english-coach/shared'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '../components/icons'
import { Alert, Button, Card, LoadingBox, Note, Spinner } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { formatRelative } from '../lib/format'
import { isSpeechSupported, speak, stopSpeaking } from '../lib/voice'

/*
 * "Subir": mandar un audio, un PDF o una foto y recibir el texto.
 *
 * El archivo no se guarda en ningún sitio: va a la IA en la misma petición y se
 * tira. Lo que sí queda es el texto, en el historial de abajo, para releerlo sin
 * volver a gastar la cuota del día.
 */

/** El mismo tope que la API: 12 MB. Se avisa antes de gastar la subida. */
const MAX_BYTES = 12 * 1024 * 1024

const ACCEPT = [
  'audio/*',
  'image/*',
  'application/pdf',
  '.txt',
  '.md',
  '.csv',
  '.m4a',
].join(',')

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<UploadMode>('translate')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<UploadRecord | null>(null)
  const [history, setHistory] = useState<UploadRecord[] | null>(null)
  const [copied, setCopied] = useState(false)

  const loadHistory = useCallback(async () => {
    try {
      const result = await api.get<{ data: UploadRecord[] }>('/api/uploads')
      setHistory(result.data)
    } catch (caught) {
      setError(errorMessage(caught))
      setHistory([])
    }
  }, [])

  useEffect(() => {
    void loadHistory()
    return () => stopSpeaking()
  }, [loadHistory])

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" pesa ${formatSize(file.size)}. El máximo es 12 MB: recórtalo o mándalo en partes.`)
      return
    }

    setBusy(true)
    setError(null)
    setCopied(false)

    const form = new FormData()
    form.set('file', file)
    form.set('mode', mode)

    try {
      const result = await api.upload<{ data: UploadRecord }>('/api/uploads', form)
      setCurrent(result.data)
      await loadHistory()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function remove(item: UploadRecord) {
    if (!confirm(`¿Borrar "${item.result.title}" del historial?`)) return
    setError(null)
    try {
      await api.delete(`/api/uploads/${encodeURIComponent(item.id)}`)
      if (current?.id === item.id) setCurrent(null)
      await loadHistory()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Tu navegador no me dejó copiar. Selecciona el texto a mano.')
    }
  }

  return (
    <div className="pantalla">
      <header className="editor-head">
        <h1 className="editor-title">Subir</h1>
        <span className="tiny">Audio, PDF, foto o texto</span>
      </header>

      <Card>
        <p className="muted">
          Mándame un archivo y te devuelvo lo que dice, escrito. Sirve para un audio en inglés, un PDF de
          clase o la foto de un cartel. El archivo no se guarda: solo el texto que saco de él.
        </p>

        <div className="stack" style={{ marginTop: 14 }}>
          <span className="field-hint">Qué quieres que haga</span>
          <div className="row">
            {(Object.keys(UPLOAD_MODE_LABELS) as UploadMode[]).map((option) => (
              <Button
                key={option}
                className="btn-small"
                variant={mode === option ? 'primary' : 'ghost'}
                aria-pressed={mode === option}
                disabled={busy}
                onClick={() => setMode(option)}
              >
                {UPLOAD_MODE_LABELS[option]}
              </Button>
            ))}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={onPick}
            disabled={busy}
            hidden
          />
          <Button
            variant="primary"
            className="btn-lg btn-block"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Leyendo el archivo…' : 'Elegir archivo'}
          </Button>
          <span className="field-hint">
            Hasta 12 MB. El plan gratis no acepta más: si el audio es largo, córtalo en partes.
          </span>
        </div>
      </Card>

      {busy ? (
        <Card>
          <div className="center-box">
            <Spinner />
            <p className="muted" style={{ marginTop: 10, textAlign: 'center' }}>
              Escuchando y escribiendo. Con un audio largo puede tardar medio minuto.
            </p>
          </div>
        </Card>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}

      {current ? (
        <Card>
          <div className="box-head">
            <h2>{current.result.title}</h2>
          </div>
          <p className="tiny">
            {current.fileName} · {formatSize(current.size)} · {UPLOAD_MODE_LABELS[current.mode].toLowerCase()}
          </p>

          <div className="stack" style={{ marginTop: 12 }}>
            <div className="spread">
              <strong>Lo que dice</strong>
              <div className="row">
                {isSpeechSupported() ? (
                  <Button
                    className="btn-small btn-ghost"
                    onClick={() => speak(current.result.transcript)}
                  >
                    <Icon name="volume" size={16} />
                    Escuchar
                  </Button>
                ) : null}
                <Button className="btn-small btn-ghost" onClick={() => copy(current.result.transcript)}>
                  <Icon name="book" size={16} />
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
              </div>
            </div>
            <p className="resultado">{current.result.transcript}</p>

            {current.result.translation ? (
              <>
                <strong>En español</strong>
                <p className="resultado">{current.result.translation}</p>
              </>
            ) : null}

            {current.result.notes.length > 0 ? (
              <>
                <strong>Para mirar con calma</strong>
                <ul className="notas">
                  {current.result.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="box-head">
          <h2>Lo que ya subiste</h2>
        </div>

        {history === null ? (
          <LoadingBox />
        ) : history.length === 0 ? (
          <p className="empty">Todavía no has subido nada. Elige un archivo y empieza.</p>
        ) : (
          <div className="stack">
            {history.map((item) => (
              <div key={item.id} className="upload-item">
                <button
                  type="button"
                  className="upload-open"
                  onClick={() => {
                    setCurrent(item)
                    setCopied(false)
                    setError(null)
                  }}
                >
                  <strong>{item.result.title}</strong>
                  <span className="tiny">
                    {item.fileName} · {formatRelative(item.createdAt)}
                  </span>
                </button>
                <Button className="btn-small btn-ghost" onClick={() => void remove(item)}>
                  Borrar
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Note>
        Un archivo, una llamada de tu cuota diaria de IA. Si el tope del día se agota, vuelve mañana.
      </Note>
    </div>
  )
}
