/**
 * AuthContext - keeps track of WHO is logged in, for the whole app.
 *
 * Any component can call useAuth() to get { user, login, logout, ... }.
 * On page load, if a token is saved, we ask the backend "/auth/me" who it belongs to.
 * The role shown in the UI always comes from the backend, never from user input.
 */
import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { tokenStorage } from '../services/api'
import * as authService from '../services/authService'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true) // true while we check a saved token

  const refreshUser = useCallback(async () => {
    if (!tokenStorage.get()) {
      setUser(null)
      return null
    }
    try {
      const me = await authService.getMe()
      setUser(me)
      return me
    } catch {
      tokenStorage.clear()
      setUser(null)
      return null
    }
  }, [])

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false))
    // The API layer fires this event when the backend rejects our token.
    const handleForcedLogout = () => setUser(null)
    window.addEventListener('foodconnect:logout', handleForcedLogout)
    return () => window.removeEventListener('foodconnect:logout', handleForcedLogout)
  }, [refreshUser])

  const login = async (email, password) => {
    const { data, message } = await authService.login(email, password)
    tokenStorage.set(data.token)
    const me = await refreshUser()
    return { user: me || data.user, message }
  }

  const register = async (form) => {
    const { data, message } = await authService.register(form)
    tokenStorage.set(data.token)
    const me = await refreshUser()
    return { user: me || data.user, message }
  }

  const logout = async () => {
    try {
      await authService.logout() // server blocks this token from future use
    } catch {
      // Even if the server is unreachable we still log out locally.
    }
    tokenStorage.clear()
    setUser(null)
  }

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, refreshUser, setUser }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isLoading, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** The home page for each role after login. */
export function dashboardPathFor(role) {
  if (role === 'admin') return '/admin'
  if (role === 'ngo') return '/ngo'
  return '/donor'
}
