import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('pms_user')
    const token = localStorage.getItem('pms_token')
    if (stored && token) {
      setUser(JSON.parse(stored))
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('pms_token', data.token)
    localStorage.setItem('pms_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const register = async (form) => {
    const { data } = await api.post('/auth/register', form)
    localStorage.setItem('pms_token', data.token)
    localStorage.setItem('pms_user', JSON.stringify(data.user))
    setUser(data.user)
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('pms_token')
    localStorage.removeItem('pms_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
