import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { LoadingBox } from './components/ui'
import { SessionProvider, useSession } from './lib/session'
import { AssessmentPage } from './pages/AssessmentPage'
import { CharacterEditorPage } from './pages/CharacterEditorPage'
import { CharacterPage } from './pages/CharacterPage'
import { ChatPage } from './pages/ChatPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { NovedadesPage } from './pages/NovedadesPage'
import { ProfilePage } from './pages/ProfilePage'
import { UploadPage } from './pages/UploadPage'
import { WelcomePage } from './pages/WelcomePage'

/** Si no hay sesión, todo lleva al login. */
function ProtectedLayout() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="center">
        <LoadingBox />
      </div>
    )
  }
  if (!session?.authenticated) return <Navigate to="/bienvenida" replace />
  return <AppShell />
}

export function App() {
  return (
    <SessionProvider>
      <Routes>
        {/* Las dos pantallas de entrada se ven a pantalla completa, sin barra. */}
        <Route path="/bienvenida" element={<WelcomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/personaje/:characterId" element={<CharacterPage />} />
          <Route path="/test" element={<AssessmentPage />} />
          <Route path="/novedades" element={<NovedadesPage />} />
          {/* "Subir": archivos para transcribir o traducir. El editor de la ficha
              del personaje se queda, pero solo para editar: se entra desde la ficha. */}
          <Route path="/subir" element={<UploadPage />} />
          {/* El chat va por personaje: /chat solo redirige al último que usaste. */}
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:characterId" element={<ChatPage />} />
          {/* El editor de la ficha del personaje: solo edita, y se entra desde la
              propia ficha con "Editar". Crear personajes ya no se hace desde la app. */}
          <Route path="/editar/:characterId" element={<CharacterEditorPage />} />
          {/* El editor del profe global que había en /profesor ya no existe: cada
              charla usa la ficha de su personaje, y esa ficha se edita desde ella. */}
          <Route path="/profesor" element={<Navigate to="/" replace />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SessionProvider>
  )
}
