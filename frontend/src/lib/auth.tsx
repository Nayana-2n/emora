import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, postJSON, putJSON, setToken, getToken, TOKEN_KEY } from './api'

export interface User {
  user_id: string
  email: string
  display_name?: string
  provider?: string
  created_at?: number
}

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, displayName?: string) => Promise<void>
  loginWithToken: (token: string) => Promise<void>
  updateProfile: (displayName: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

interface AuthResponse {
  access_token: string
  user: User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    api<User>('/api/me')
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('emora:unauth', handler)
    return () => window.removeEventListener('emora:unauth', handler)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await postJSON<AuthResponse>('/api/login', { email, password })
    setToken(res.access_token)
    setUser(res.user)
  }

  const signup = async (email: string, password: string, displayName?: string) => {
    const res = await postJSON<AuthResponse>('/api/signup', { email, password, display_name: displayName })
    setToken(res.access_token)
    setUser(res.user)
  }

  const loginWithToken = async (token: string) => {
    setToken(token)
    const me = await api<User>('/api/me')
    setUser(me)
  }

  const updateProfile = async (displayName: string) => {
    const me = await putJSON<User>('/api/profile', { display_name: displayName })
    setUser(me)
  }

  const logout = async () => {
    try {
      await api('/api/logout', { method: 'POST' })
    } catch {
      /* ignore */
    }
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithToken, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

export { TOKEN_KEY }
