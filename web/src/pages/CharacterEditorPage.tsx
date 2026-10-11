import type { CharacterDetail, SpanishUsage, TeacherConfig, TeacherPersona } from '@english-coach/shared'
import {
  AVATAR_PRESET_IDS,
  AVATAR_PRESET_LABELS,
  DEFAULT_TEACHER_CONFIG,
  SPANISH_USAGE_LABELS,
  TEACHER_PERSONAS,
  avatarSrc,
} from '@english-coach/shared'
import type { ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/icons'
import { Alert, Button, Card, LoadingBox, Note, Slider } from '../components/ui'
import { api, errorMessage } from '../lib/api'
import { fileToAvatarDataUrl } from '../lib/image'
import {
  englishVoices,
  isSpeechSupported,
  onVoicesChanged,
  speak,
  stopSpeaking,
  suggestVoice,
  type VoiceOption,
} from '../lib/voice'

/*
 * El editor de la ficha del personaje. Antes también creaba personajes; ahora
 * solo edita: se entra desde la ficha, con "Editar". Crear personajes nuevos se
 * hace cargando tu propio archivo (ver `private/cargar-personajes.mjs`).
 *
 * El plano no trae pantalla de editor: esta sigue su tono y sus tokens, pero no
 * se copian medidas de ningún marco.
 */

export function CharacterEditorPage() {
  const { characterId } = useParams<{ characterId: string }>()

  const [config, setConfig] = useState<TeacherConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<VoiceOption[]>([])

  useEffect(() => {
    let active = true
    setConfig(null)
    api
      .get<{ data: CharacterDetail }>(`/api/characters/${encodeURIComponent(characterId ?? '')}`)
      .then((result) => {
        if (active) setConfig(result.data.config)
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
      })
    return () => {
      active = false
    }
  }, [characterId])

  useEffect(() => {
    // En iOS la lista llega vacía hasta que el sistema avisa; hay que releerla.
    const refresh = () => setVoices(englishVoices())
    refresh()
    const stop = onVoicesChanged(refresh)
    return () => {
      stop()
      stopSpeaking()
    }
  }, [])

  function update<K extends keyof TeacherConfig>(key: K, value: TeacherConfig[K]) {
    setSaved(false)
    setConfig((previous) => (previous ? { ...previous, [key]: value } : previous))
  }

  /** Un arquetipo rellena todo de una vez; después lo puedes tocar a mano. */
  function applyPersona(persona: TeacherPersona | null) {
    setSaved(false)
    setConfig((previous) => {
      if (!previous) return previous
      if (!persona) {
        return { ...previous, personaId: null, character: null, tagline: null, speechStyle: null, greeting: null }
      }
      return {
        ...previous,
        personaId: persona.id,
        name: persona.teacherName,
        personality: persona.personality,
        character: persona.character,
        tagline: persona.tagline,
        speechStyle: persona.speechStyle,
        greeting: persona.greeting,
        humor: persona.humor,
        formality: persona.formality,
        severity: persona.severity,
        correctionStyle: persona.correctionStyle,
        spanishUsage: persona.spanishUsage,
        avatar: persona.avatar,
        voice: previous.voice ?? suggestVoice(englishVoices(), persona.voiceHint),
      }
    })
  }

  async function onPickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setImageBusy(true)
    setError(null)
    try {
      update('avatar', await fileToAvatarDataUrl(file))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setImageBusy(false)
    }
  }

  function tryVoice() {
    const name = config?.name.trim() || 'your teacher'
    speak(`Hi! I am ${name}. Let us practise English together.`, config?.voice ?? null)
    // Después de hablar, el sistema ya suele tener las voces cargadas.
    setVoices(englishVoices())
  }

  function pickSuggestedVoice() {
    const available = englishVoices()
    setVoices(available)
    const persona = TEACHER_PERSONAS.find((item) => item.id === config?.personaId)
    const suggestion = suggestVoice(available, persona?.voiceHint ?? { lang: null, gender: 'any' })
    if (suggestion) update('voice', suggestion)
    else setError('Todavía no veo las voces del dispositivo. Toca «Probar» una vez y vuelve a intentar.')
  }

  async function save() {
    if (!config || busy) return
    // El nombre y cómo es son obligatorios: sin ellos el personaje no tiene voz.
    if (!config.name.trim()) {
      setError('Ponle un nombre: es el que se ve en la tarjeta.')
      return
    }
    if (!config.personality.trim()) {
      setError('Escribe cómo es: es lo que le da carácter en la charla.')
      return
    }

    setBusy(true)
    setError(null)
    const payload: TeacherConfig = {
      ...config,
      name: config.name.trim(),
      personality: config.personality.trim(),
      // Cómo corrige nunca puede quedar vacío: sin él, el servidor lo rechaza.
      correctionStyle: config.correctionStyle.trim() || DEFAULT_TEACHER_CONFIG.correctionStyle,
    }

    try {
      const result = await api.put<{ data: CharacterDetail }>(
        `/api/characters/${encodeURIComponent(characterId ?? '')}`,
        payload,
      )
      setConfig(result.data.config)
      setSaved(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (error && !config) return <Alert>{error}</Alert>
  if (!config) return <LoadingBox />

  const persona = TEACHER_PERSONAS.find((item) => item.id === config.personaId) ?? null
  const preview = avatarSrc(config.avatar)

  return (
    <div className="pantalla">
      <div className="editor-head">
        <Link className="link-btn back-link" to={`/personaje/${characterId}`}>
          <Icon name="back" size={18} />
          Volver
        </Link>
        {saved ? <span className="tiny">guardado</span> : null}
      </div>

      <h1 className="editor-title">Editar personaje</h1>

      <Card>
        <div className="editor-preview">
          <span className="ficha-img editor-face">
            {preview ? <img src={preview} alt="" /> : config.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <div>
            <strong>{config.name.trim() || 'Sin nombre'}</strong>
            <p className="tiny">{config.tagline?.trim() || persona?.tagline || 'Sin frase todavía'}</p>
          </div>
        </div>
        <p className="muted">
          Todo esto es lo que el personaje usa de verdad en la charla: cómo te habla, qué te pregunta y cómo
          te corrige. Nada de esto está escrito en el código.
        </p>
      </Card>

      <Card>
        <div className="box-head">
          <h2>Elige un arquetipo</h2>
        </div>
        <p className="muted">
          Un arquetipo rellena el nombre, la personalidad y el dibujo de una vez. Son inventados para esta
          app: si prefieres otro, descríbelo abajo con tus palabras.
        </p>
        <div className="persona-row">
          {TEACHER_PERSONAS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === config.personaId ? 'persona-card selected' : 'persona-card'}
              onClick={() => applyPersona(item)}
            >
              <img src={`/avatars/${item.avatar}.svg`} alt="" width={44} height={44} />
              <strong>{item.label}</strong>
              <span className="tiny">{item.tagline}</span>
            </button>
          ))}
        </div>
        {config.personaId ? (
          <div style={{ marginTop: 12 }}>
            <Button className="btn-small" variant="ghost" onClick={() => applyPersona(null)}>
              Quitar arquetipo
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="box-head">
          <h2>La ficha</h2>
        </div>
        <div className="stack">
          <div>
            <span className="field-hint">Su cara</span>
            <div className="avatar-grid">
              {AVATAR_PRESET_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  title={AVATAR_PRESET_LABELS[id]}
                  className={config.avatar === id ? 'avatar-option selected' : 'avatar-option'}
                  onClick={() => update('avatar', id)}
                >
                  <img src={`/avatars/${id}.svg`} alt={AVATAR_PRESET_LABELS[id]} />
                </button>
              ))}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="btn btn-small btn-ghost avatar-upload">
                {imageBusy ? 'Procesando…' : 'Subir mi imagen'}
                <input type="file" accept="image/*" onChange={onPickImage} disabled={imageBusy} />
              </label>
              {config.avatar ? (
                <Button className="btn-small" variant="ghost" onClick={() => update('avatar', null)}>
                  Quitar imagen
                </Button>
              ) : null}
            </div>
            <span className="field-hint">
              La imagen se recorta cuadrada y se reduce en tu teléfono antes de guardarse.
            </span>
          </div>

          <label>
            Nombre
            <input
              value={config.name}
              maxLength={40}
              placeholder="Ej.: Max"
              onChange={(event) => update('name', event.target.value)}
            />
          </label>

          <label>
            Frase
            <input
              value={config.tagline ?? ''}
              maxLength={120}
              placeholder="Ej.: Entrenador que te exige, pero siempre está de tu lado."
              onChange={(event) => update('tagline', event.target.value || null)}
            />
            <span className="field-hint">Una línea que lo resume, la que se ve en la tarjeta.</span>
          </label>

          <label>
            Personaje
            <textarea
              value={config.character ?? ''}
              maxLength={300}
              rows={3}
              placeholder="Ej.: un pirata bromista que habla del mar y niega haber robado nada."
              onChange={(event) => update('character', event.target.value || null)}
            />
            <span className="field-hint">
              Descríbelo con tus palabras (quién es, cómo habla, qué le interesa). Sale mejor que poner el
              nombre de un personaje famoso, y es el rol que interpreta en la charla.
            </span>
          </label>

          <label>
            Cómo es (obligatorio)
            <textarea
              value={config.personality}
              maxLength={400}
              rows={3}
              onChange={(event) => update('personality', event.target.value)}
            />
            <span className="field-hint">Cómo es, qué le interesa, cómo te habla.</span>
          </label>

          <label>
            Cómo habla
            <textarea
              value={config.speechStyle ?? ''}
              maxLength={400}
              rows={3}
              placeholder="Ej.: frases cortas, energía alta, usa «Let's go!» y compara el inglés con entrenar."
              onChange={(event) => update('speechStyle', event.target.value || null)}
            />
            <span className="field-hint">Ritmo, muletillas, jergas o exclamaciones. Máximo tres líneas.</span>
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
            <span className="field-hint">
              Si lo dejas vacío se usa el de siempre: corrige solo lo importante y te pide intentarlo otra vez.
            </span>
          </label>

          <label>
            Errores por mensaje
            <select
              value={config.maxCorrections === null ? 'auto' : String(config.maxCorrections)}
              onChange={(event) =>
                update('maxCorrections', event.target.value === 'auto' ? null : Number(event.target.value))
              }
            >
              <option value="auto">Automático (1 o 2, lo que más importe)</option>
              <option value="1">Solo 1, el más importante</option>
              <option value="2">Hasta 2</option>
            </select>
          </label>

          <label>
            Mensaje inicial
            <textarea
              value={config.greeting ?? ''}
              maxLength={300}
              rows={2}
              placeholder="Ej.: Hey! Warm-up time. Tell me one thing you did today."
              onChange={(event) => update('greeting', event.target.value || null)}
            />
            <span className="field-hint">Con esto abre cada charla nueva.</span>
          </label>

          <label>
            Diálogos de ejemplo
            <textarea
              value={config.examples ?? ''}
              maxLength={1200}
              rows={5}
              placeholder={
                'Yo: Yesterday I go to the gym.\nÉl: Almost! Yesterday I went to the gym. Say it again, champ.'
              }
              onChange={(event) => update('examples', event.target.value || null)}
            />
            <span className="field-hint">
              Tres o cuatro intercambios cortos: es lo que más ayuda a que suene como él.
            </span>
          </label>

          <label>
            Cosas que nunca hace
            <textarea
              value={config.neverDoes ?? ''}
              maxLength={400}
              rows={2}
              placeholder="Ej.: no se burla de mis errores, no traduce todo, no se sale del personaje."
              onChange={(event) => update('neverDoes', event.target.value || null)}
            />
          </label>

          <label>
            Escenarios favoritos
            <textarea
              value={config.scenarios ?? ''}
              maxLength={400}
              rows={2}
              placeholder="Ej.: entrevista de trabajo, hablar de deportes, retos de vocabulario."
              onChange={(event) => update('scenarios', event.target.value || null)}
            />
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
            Nivel de inglés
            <select
              value={config.englishLevelMode}
              onChange={(event) =>
                update('englishLevelMode', event.target.value === 'fixed' ? 'fixed' : 'auto')
              }
            >
              <option value="auto">Automático (según lo que mida el test)</option>
              <option value="fixed">Fijo en el nivel que ya tengo</option>
            </select>
          </label>

          <label>
            Español
            <select
              value={config.spanishUsage}
              onChange={(event) => update('spanishUsage', event.target.value as SpanishUsage)}
            >
              {(Object.keys(SPANISH_USAGE_LABELS) as SpanishUsage[]).map((usage) => (
                <option key={usage} value={usage}>
                  {SPANISH_USAGE_LABELS[usage]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card>
        <div className="box-head">
          <h2>Su voz</h2>
        </div>
        {isSpeechSupported() ? (
          <div className="stack">
            <label>
              Voz del dispositivo
              <select
                value={config.voice ?? ''}
                onChange={(event) => update('voice', event.target.value || null)}
              >
                <option value="">La que trae el sistema</option>
                {voices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} · {voice.lang}
                  </option>
                ))}
              </select>
            </label>
            {voices.length === 0 ? (
              <span className="field-hint">
                Todavía no veo las voces: el teléfono las suelta en cuanto tocas algo. Toca «Probar» y
                vuelve a abrir esta lista.
              </span>
            ) : null}
            <label className="switch-row">
              <input
                type="checkbox"
                checked={config.autoSpeak}
                onChange={(event) => update('autoSpeak', event.target.checked)}
              />
              <span>Leerme en voz alta lo que responde</span>
            </label>
            <div className="row">
              <Button className="btn-small" onClick={tryVoice}>
                Probar
              </Button>
              <Button className="btn-small" variant="ghost" onClick={pickSuggestedVoice}>
                Buscar una parecida al personaje
              </Button>
            </div>
            <span className="field-hint">
              Son las voces que ya tiene tu teléfono: no se descarga nada. Las marcadas como «Enhanced»
              suenan mejor.
            </span>
          </div>
        ) : (
          <p className="muted">Este navegador no puede leer en voz alta.</p>
        )}
      </Card>

      {error ? <Alert>{error}</Alert> : null}

      <div className="row">
        <Button variant="primary" onClick={save} disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Link className="btn btn-small" to={`/personaje/${characterId}`}>
          Ver la ficha
        </Link>
        <span className="tiny">Los cambios no se guardan solos.</span>
      </div>

      <Note>
        El personaje corrige 1 o 2 errores por respuesta y apunta los que repites. El personaje cambia cómo te
        habla, nunca las reglas de corrección.
      </Note>
    </div>
  )
}
