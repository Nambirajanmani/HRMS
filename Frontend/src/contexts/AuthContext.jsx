import { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      fetchUser()
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async () => {
    try {
      const response = await authAPI.me()
      const payload = response.data?.data || response.data
      setUser(payload?.user || null)
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      const payload = response.data?.data || response.data
      const { user, accessToken, refreshToken } = payload || {}

      if (!accessToken || !refreshToken || !user) {
        throw new Error('Invalid login response')
      }

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      setUser(user)

      toast.success('Login successful!')
      return { success: true }
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
    toast.success('Logged out successfully')
  }

  const hasPermission = (requiredRoles) => {
    if (!user) return false
    if (!requiredRoles || requiredRoles.length === 0) return true
    return requiredRoles.includes(user.role)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        hasPermission,
        refetchUser: fetchUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
