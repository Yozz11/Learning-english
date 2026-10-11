import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Icon } from '../components/icons'
import { Alert, Button } from '../components/ui'
import { errorMessage } from '../lib/api'
import { useSession } from '../lib/session'

export function LoginPage() {
  const { session, loading, login } = useSession()
  const navigate = useNavigate()
  const [passphrase, setPassphrase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loading && session?.authenticated) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (busy || passphrase.trim().length === 0) return

    setBusy(true)
    setError(null)
    try {
      await login(passphrase.trim())
      navigate('/', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
      setPassphrase('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="center">
      <form className="login-card" onSubmit={handleSubmit}>
        <Link className="link-btn" to="/bienvenida">
          <Icon name="back" size={18} />
          Volver
        </Link>

        <h1 className="login-title">Entrar</h1>
        <p className="muted">Pon la contraseña de tu app y seguimos donde lo dejaste.</p>

        <label>
          Contraseña
          <input
            type="password"
            value={passphrase}
            autoFocus
            autoComplete="current-password"
            onChange={(event) => setPassphrase(event.target.value)}
            placeholder="••••••"
          />
        </label>

        {error ? <Alert>{error}</Alert> : null}

        <Button type="submit" variant="primary" className="btn-block btn-lg" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
