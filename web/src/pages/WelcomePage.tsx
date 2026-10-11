import type { AvatarPresetId } from '@english-coach/shared'
import { Navigate, Link } from 'react-router-dom'
import { useSession } from '../lib/session'

/** Los dibujos que dan vueltas sobre las órbitas: son de la app, no de nadie más. */
const ORBITING: { id: AvatarPresetId; left: number; top: number }[] = [
  { id: 'coach', left: 170, top: 8 },
  { id: 'brit', left: 30, top: 470 },
  { id: 'detective', left: 300, top: 560 },
]

export function WelcomePage() {
  const { session, loading } = useSession()

  if (!loading && session?.authenticated) return <Navigate to="/" replace />

  return (
    <div className="welcome">
      <div className="orbits" aria-hidden>
        <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
          <circle cx="195" cy="330" r="190" />
          <circle cx="195" cy="330" r="320" />
        </svg>

        {/* Giran despacio; con "reducir movimiento" activado se quedan quietos. */}
        <div className="orbit-spin">
          {ORBITING.map((avatar) => (
            <span
              key={avatar.id}
              className="avatar-orb"
              style={{ left: `${avatar.left}px`, top: `${avatar.top}px` }}
            >
              <img src={`/avatars/${avatar.id}.svg`} alt="" />
            </span>
          ))}
        </div>
      </div>

      <h1>Aprende inglés con tu personaje</h1>

      <div className="sheet">
        <Link className="btn btn-primary btn-block btn-lg" to="/login">
          Entrar
        </Link>
        <p className="legal">Tu progreso se guarda en tu cuenta. Esto es una IA, no una persona real.</p>
      </div>
    </div>
  )
}
