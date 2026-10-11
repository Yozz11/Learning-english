import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Icon, type IconName } from './icons'

/*
 * Estructura de la app: barra inferior en el móvil, barra lateral en el
 * escritorio. Las dos usan la misma lista, así no se separan nunca.
 *
 * Hoy existen cinco secciones. "Biblioteca" todavía no existe, así que no se
 * muestra: no se enseña un botón que no lleva a nada.
 */
type NavEntry = { to: string; label: string; icon: IconName; end?: boolean; profile?: boolean }

const NAV: NavEntry[] = [
  { to: '/', label: 'Inicio', icon: 'home', end: true },
  { to: '/chat', label: 'Chats', icon: 'chat' },
  { to: '/crear', label: 'Crear', icon: 'plus' },
  { to: '/test', label: 'Curso', icon: 'layers' },
  { to: '/perfil', label: 'Perfil', icon: 'user', profile: true },
]

/** El chat ocupa la pantalla entera: en el móvil no lleva barra inferior. */
function isFullScreen(pathname: string): boolean {
  return pathname === '/chat' || pathname.startsWith('/chat/')
}

export function AppShell() {
  const { pathname } = useLocation()
  const fullScreen = isFullScreen(pathname)

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Secciones">
        <div className="brand">
          english
          <span>Aprende inglés con tu personaje</span>
        </div>
        {NAV.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.end}
            className={({ isActive }) => (isActive ? 'side-item active' : 'side-item')}
          >
            <Icon name={entry.icon} />
            {entry.label}
          </NavLink>
        ))}
      </nav>

      <div className="main">
        <div className={fullScreen ? 'page page-flat' : 'page'}>
          <Outlet />
        </div>

        {fullScreen ? null : (
          <nav className="bottom-nav" aria-label="Secciones">
            {NAV.map((entry) => (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.end}
                aria-label={entry.label}
                className={({ isActive }) =>
                  [entry.profile ? 'nav-item profile' : 'nav-item', isActive ? 'active' : '']
                    .filter(Boolean)
                    .join(' ')
                }
              >
                <Icon name={entry.icon} className={entry.to === '/crear' ? 'i plus-lg' : 'i'} />
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
