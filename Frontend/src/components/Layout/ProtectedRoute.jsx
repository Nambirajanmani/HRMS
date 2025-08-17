import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import LoadingSpinner from '../UI/LoadingSpinner'

const ProtectedRoute = ({ children, requiredRoles = [] }) => {
  const { user, loading, hasPermission } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRoles.length > 0 && !hasPermission(requiredRoles)) {
    // Redirect to unauthorized page or dashboard
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute