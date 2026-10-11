import type { SpanishUsage, TeacherConfig } from '@english-coach/shared'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, LoadingBox, Note, Slider } from '../components/ui'
import { api, errorMessage } from '../lib/api'

const SPANISH_LABELS: Record<SpanishUsage, string> = {
  never: 'Solo inglés, siempre',
  when_needed: 'Español solo si me trabo',
  often: 'Puede explicar en español',
}

export function TeacherPage() {
  const [config, setConfig] = useState<TeacherConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .get<TeacherConfig>('/api/teacher')
      .then((result) => {
        if (active) setConfig(result)
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
      })
    return () => {
      active = false
    }
  }, [])

  function update<K extends keyof TeacherConfig>(key: K, value: TeacherConfig[K]) {
    setSaved(false)
    setConfig((previous) => (previous ? { ...previous, [key]: value } : previous))
  }

  async function save() {
    if (!config || busy) return
    setBusy(true)
    setError(null)
    try {
      setConfig(await api.put<TeacherConfig>('/api/teacher', config))
      setSaved(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (error && !config) return <Alert>{error}</Alert>
  if (!config) return <LoadingBox />

  return (
    <>
      <Card>
        <div className="card-head">
          <h2>Mi profesor</h2>
          {saved ? <span className="tiny">guardado</span> : null}
        </div>
        <p className="muted">
          Todo esto se guarda tal cual y entra en el prompt del profesor. Nada de esto está escrito en el
          código.
        </p>
      </Card>

      <Card>
        <div className="stack" style={{ paddingTop: 0 }}>
          <label>
            Nombre
            <input
              value={config.name}
              maxLength={40}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>

          <label>
            Personalidad
            <textarea
              value={config.personality}
              maxLength={400}
              rows={3}
              onChange={(event) => update('personality', event.target.value)}
            />
            <span className="field-hint">Cómo es, qué le interesa, cómo te habla.</span>
          </label>

          <Slider
            label="Humor"
            value={config.humor}
            onChange={(value) => update('humor', value)}
            hint="0 = serio · 10 = bromista"
          />
          <Slider
            label="Formalidad"
            value={config.formality}
            onChange={(value) => update('formality', value)}
            hint="0 = relajado · 10 = formal"
          />
          <Slider
            label="Severidad al corregir"
            value={config.severity}
            onChange={(value) => update('severity', value)}
            hint="0 = suave · 10 = estricto"
          />

          <label>
            Cómo corrige
            <textarea
              value={config.correctionStyle}
              maxLength={400}
              rows={3}
              onChange={(event) => update('correctionStyle', event.target.value)}
            />
          </label>

          <label>
            Nivel de inglés
            <select
              value={config.englishLevelMode}
              onChange={(event) => update('englishLevelMode', event.target.value as TeacherConfig['englishLevelMode'])}
            >
              <option value="auto">Automático, según mi nivel medido</option>
              <option value="fixed">Fijo, yo lo decido más adelante</option>
            </select>
          </label>

          <label>
            Uso del español
            <select
              value={config.spanishUsage}
              onChange={(event) => update('spanishUsage', event.target.value as SpanishUsage)}
            >
              {(Object.keys(SPANISH_LABELS) as SpanishUsage[]).map((usage) => (
                <option key={usage} value={usage}>
                  {SPANISH_LABELS[usage]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Modo debate
            <select
              value={config.debateEnabled === null ? 'sin_decidir' : config.debateEnabled ? 'si' : 'no'}
              onChange={(event) =>
                update(
                  'debateEnabled',
                  event.target.value === 'sin_decidir' ? null : event.target.value === 'si',
                )
              }
            >
              <option value="sin_decidir">Sin decidir (lo dejo para después)</option>
              <option value="si">Sí, que me discuta</option>
              <option value="no">No, por ahora no</option>
            </select>
          </label>

          <label>
            Personaje
            <input
              value={config.character ?? ''}
              maxLength={60}
              placeholder="Sin definir"
              onChange={(event) => update('character', event.target.value || null)}
            />
            <span className="field-hint">
              Opcional. Si algún día quieres que el profe tenga un personaje concreto, se pone aquí.
            </span>
          </label>

          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </Card>

      {error ? <Alert>{error}</Alert> : null}

      <Note>
        El profesor corrige como máximo 1 o 2 errores por mensaje y anota lo que repites para insistir
        menos la próxima vez.
      </Note>
    </>
  )
}
