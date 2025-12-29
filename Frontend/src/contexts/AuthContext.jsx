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
    const storedUser = localStorage.getItem('user')
    
    if (token && storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        setUser(userData)
      } catch {
        localStorage.removeItem('user')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
    setLoading(false)
  }, [])

  const fetchUser = async () => {
    try {
      const response = await authAPI.me()
      const payload = response.data?.data || response.data
      const userData = payload?.user || null
      
      if (userData) {
        setUser(userData)
        localStorage.setItem('user', JSON.stringify(userData))
      }
    } catch {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (credentials) => {
    try {
      // Call real backend API
      const response = await authAPI.login(credentials)
      const payload = response?.data || response
      const userData = payload?.data?.user || payload?.user
      const accessToken = payload?.data?.accessToken || payload?.accessToken
      const refreshToken = payload?.data?.refreshToken || payload?.refreshToken

      if (!userData || !accessToken) {
        throw new Error('Invalid response from server')
      }

      // Normalize role to lowercase for consistency
      const userWithRole = {
        ...userData,
        role: (userData.role || 'employee').toLowerCase()
      }

      // Store tokens and user info
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      localStorage.setItem('user', JSON.stringify(userWithRole))
      setUser(userWithRole)

      toast.success('Login successful')
      return { success: true }
    } catch (error) {
      const message = error?.message || error?.response?.data?.message || 'Login failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    setUser(null)
    toast.success('Logged out successfully')
  }

  const hasPermission = (requiredRoles) => {
    if (!user) return false
    if (!requiredRoles || requiredRoles.length === 0) return true
    const userRole = (user.role || '').toLowerCase()
    return requiredRoles.map(r => r.toLowerCase()).includes(userRole)
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