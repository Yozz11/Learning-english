import type { SessionInfo } from '@english-coach/shared'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'

interface SessionValue {
  session: SessionInfo | null
  loading: boolean
  refresh: () => Promise<void>
  login: (passphrase: string) => Promise<void>
  logout: () => Promise<void>
}

const ANONYMOUS: SessionInfo = { authenticated: false, userId: null, displayName: null }

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      setSession(await api.get<SessionInfo>('/api/auth/me'))
    } catch {
      setSession(ANONYMOUS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (passphrase: string) => {
    setSession(await api.post<SessionInfo>('/api/auth/login', { passphrase }))
  }, [])

  const logout = useCallback(async () => {
    setSession(await api.post<SessionInfo>('/api/auth/logout'))
  }, [])

  const value = useMemo<SessionValue>(
    () => ({ session, loading, refresh, login, logout }),
    [session, loading, refresh, login, logout],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession tiene que usarse dentro de SessionProvider')
  return value
}
