import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../lib/session'

const LINKS = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/test', label: 'Test', end: false },
  { to: '/chat', label: 'Charla', end: false },
  { to: '/profesor', label: 'Profe', end: false },
  { to: '/perfil', label: 'Perfil', end: false },
]

export function Layout() {
  const { logout } = useSession()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          English Coach
        </div>
        <button type="button" className="btn btn-ghost btn-small" onClick={handleLogout}>
          Salir
        </button>
      </header>

      <main className="stack">
        <Outlet />
      </main>

      <nav className="nav">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
