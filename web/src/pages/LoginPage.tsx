import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
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
      <form className="login-card card" onSubmit={handleSubmit}>
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          English Coach
        </div>
        <p className="muted">Tu profesor de inglés. Pon la contraseña y entramos.</p>

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

        <Button type="submit" variant="primary" className="btn-block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
