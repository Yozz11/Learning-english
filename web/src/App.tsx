import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { LoadingBox } from './components/ui'
import { SessionProvider, useSession } from './lib/session'
import { AssessmentPage } from './pages/AssessmentPage'
import { ChatPage } from './pages/ChatPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProfilePage } from './pages/ProfilePage'
import { TeacherPage } from './pages/TeacherPage'

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
  if (!session?.authenticated) return <Navigate to="/login" replace />
  return <Layout />
}

export function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/test" element={<AssessmentPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/profesor" element={<TeacherPage />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </SessionProvider>
  )
}
