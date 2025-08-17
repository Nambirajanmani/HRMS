import { useAuth } from '../contexts/AuthContext'

/**
 * Custom hook for checking user permissions
 * @returns {object} - Permission checking functions
 */
export const usePermissions = () => {
  const { user } = useAuth()

  /**
   * Check if user has any of the required roles
   * @param {string[]} requiredRoles - Array of required roles
   * @returns {boolean} - Whether user has permission
   */
  const hasRole = (requiredRoles) => {
    if (!user || !requiredRoles || requiredRoles.length === 0) return false
    return requiredRoles.includes(user.role)
  }

  /**
   * Check if user is admin
   * @returns {boolean} - Whether user is admin
   */
  const isAdmin = () => {
    return user?.role === 'ADMIN'
  }

  /**
   * Check if user is HR
   * @returns {boolean} - Whether user is HR
   */
  const isHR = () => {
    return user?.role === 'HR'
  }

  /**
   * Check if user is manager
   * @returns {boolean} - Whether user is manager
   */
  const isManager = () => {
    return user?.role === 'MANAGER'
  }

  /**
   * Check if user is employee
   * @returns {boolean} - Whether user is employee
   */
  const isEmployee = () => {
    return user?.role === 'EMPLOYEE'
  }

  /**
   * Check if user can manage employees
   * @returns {boolean} - Whether user can manage employees
   */
  const canManageEmployees = () => {
    return hasRole(['ADMIN', 'HR'])
  }

  /**
   * Check if user can view reports
   * @returns {boolean} - Whether user can view reports
   */
  const canViewReports = () => {
    return hasRole(['ADMIN', 'HR', 'MANAGER'])
  }

  /**
   * Check if user can manage payroll
   * @returns {boolean} - Whether user can manage payroll
   */
  const canManagePayroll = () => {
    return hasRole(['ADMIN', 'HR'])
  }

  /**
   * Check if user can approve leave requests
   * @returns {boolean} - Whether user can approve leave requests
   */
  const canApproveLeave = () => {
    return hasRole(['ADMIN', 'HR', 'MANAGER'])
  }

  /**
   * Check if user can access system settings
   * @returns {boolean} - Whether user can access settings
   */
  const canAccessSettings = () => {
    return hasRole(['ADMIN'])
  }

  return {
    hasRole,
    isAdmin,
    isHR,
    isManager,
    isEmployee,
    canManageEmployees,
    canViewReports,
    canManagePayroll,
    canApproveLeave,
    canAccessSettings,
  }
}

export default usePermissions