import type { Profile } from '@english-coach/shared'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, LoadingBox } from '../components/ui'
import { api, errorMessage } from '../lib/api'

const EMPTY: Profile = {
  displayName: '',
  nativeLanguage: 'es',
  goals: [],
  correctionPreference: '',
  onboardedAt: null,
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [goalsText, setGoalsText] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .get<Profile>('/api/profile')
      .then((result) => {
        if (!active) return
        setProfile(result ?? EMPTY)
        setGoalsText(result?.goals.join('\n') ?? '')
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught))
      })
    return () => {
      active = false
    }
  }, [])

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setSaved(false)
    setProfile((previous) => (previous ? { ...previous, [key]: value } : previous))
  }

  async function save() {
    if (!profile || busy) return
    setBusy(true)
    setError(null)

    const goals = goalsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 6)

    try {
      const payload: Profile = { ...profile, goals }
      setProfile(await api.put<Profile>('/api/profile', payload))
      setSaved(true)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (error && !profile) return <Alert>{error}</Alert>
  if (!profile) return <LoadingBox />

  return (
    <>
      <Card>
        <div className="card-head">
          <h2>Mi perfil</h2>
          {saved ? <span className="tiny">guardado</span> : null}
        </div>
        <p className="muted">
          Cuanto menos genérico sea esto, mejor te va a hablar el profesor. Es lo único que se guarda de ti.
        </p>
      </Card>

      <Card>
        <div className="stack" style={{ paddingTop: 0 }}>
          <label>
            Cómo te llamas
            <input
              value={profile.displayName}
              maxLength={60}
              placeholder="Tu nombre"
              onChange={(event) => update('displayName', event.target.value)}
            />
          </label>

          <label>
            Tu idioma
            <select
              value={profile.nativeLanguage}
              onChange={(event) => update('nativeLanguage', event.target.value)}
            >
              <option value="es">Español</option>
              <option value="pt">Portugués</option>
              <option value="en">Inglés</option>
            </select>
          </label>

          <label>
            Para qué quieres el inglés
            <textarea
              value={goalsText}
              rows={3}
              placeholder={'Una por línea, por ejemplo:\nTrabajar en inglés\nEntender series sin subtítulos'}
              onChange={(event) => {
                setSaved(false)
                setGoalsText(event.target.value)
              }}
            />
            <span className="field-hint">Máximo 6, una por línea.</span>
          </label>

          <label>
            Cómo te gusta que te corrijan
            <textarea
              value={profile.correctionPreference}
              maxLength={400}
              rows={3}
              placeholder="Por ejemplo: corrígeme lo importante, no cada coma."
              onChange={(event) => update('correctionPreference', event.target.value)}
            />
          </label>

          <Button variant="primary" onClick={save} disabled={busy || profile.displayName.trim().length === 0}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </Card>

      {error ? <Alert>{error}</Alert> : null}
    </>
  )
}
