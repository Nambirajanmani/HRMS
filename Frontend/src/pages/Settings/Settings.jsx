import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  CogIcon, 
  UserIcon, 
  BuildingOfficeIcon, 
  ClockIcon,
  BellIcon,
  ShieldCheckIcon 
} from '@heroicons/react/24/outline'
import { userAPI } from '../../services/api'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'

const Settings = () => {
  const [activeTab, setActiveTab] = useState('general')
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm()

  const tabs = [
    { id: 'general', name: 'General', icon: CogIcon },
    { id: 'users', name: 'User Management', icon: UserIcon },
    { id: 'company', name: 'Company Settings', icon: BuildingOfficeIcon },
    { id: 'attendance', name: 'Attendance Settings', icon: ClockIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
  ]

  const { data: users, isLoading: usersLoading } = useQuery(
    'users',
    () => userAPI.getAll({ limit: 100 }),
    {
      enabled: activeTab === 'users'
    }
  )

  const updateUserMutation = useMutation(
    ({ id, data }) => userAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users')
        toast.success('User updated successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update user')
      }
    }
  )

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">System Settings</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                System Name
              </label>
              <input
                type="text"
                className="input mt-1"
                defaultValue="HRMS - Human Resource Management System"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Time Zone
              </label>
              <select className="input mt-1">
                <option>UTC-5 (Eastern Time)</option>
                <option>UTC-6 (Central Time)</option>
                <option>UTC-7 (Mountain Time)</option>
                <option>UTC-8 (Pacific Time)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date Format
              </label>
              <select className="input mt-1">
                <option>MM/DD/YYYY</option>
                <option>DD/MM/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                defaultChecked
              />
              <label className="ml-2 block text-sm text-gray-900">
                Enable email notifications
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderUserManagement = () => {
    if (usersLoading) return <LoadingSpinner size="lg" />

    const usersList = users?.data?.users || []

    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">User Management</h3>
          </div>
          <div className="card-content p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usersList.map((user) => (
                    <tr key={user.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {user.employee?.firstName?.[0] || user.email[0].toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.employee ? 
                                `${user.employee.firstName} ${user.employee.lastName}` : 
                                user.email
                              }
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          className="text-sm border-gray-300 rounded-md"
                          defaultValue={user.role}
                          onChange={(e) => updateUserMutation.mutate({
                            id: user.id,
                            data: { role: e.target.value }
                          })}
                        >
                          <option value="EMPLOYEE">Employee</option>
                          <option value="MANAGER">Manager</option>
                          <option value="HR">HR</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => updateUserMutation.mutate({
                            id: user.id,
                            data: { isActive: !user.isActive }
                          })}
                          className={`${
                            user.isActive 
                              ? 'text-red-600 hover:text-red-900' 
                              : 'text-green-600 hover:text-green-900'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderCompanySettings = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Company Information</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Company Name
              </label>
              <input
                type="text"
                className="input mt-1"
                defaultValue="Acme Corporation"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Company Address
              </label>
              <textarea
                rows={3}
                className="input mt-1"
                defaultValue="123 Business Street, Suite 100, City, State 12345"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  className="input mt-1"
                  defaultValue="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  className="input mt-1"
                  defaultValue="info@acmecorp.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Website
              </label>
              <input
                type="url"
                className="input mt-1"
                defaultValue="https://www.acmecorp.com"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAttendanceSettings = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Attendance Configuration</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Work Start Time
                </label>
                <input
                  type="time"
                  className="input mt-1"
                  defaultValue="09:00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Work End Time
                </label>
                <input
                  type="time"
                  className="input mt-1"
                  defaultValue="17:00"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Late Threshold (minutes)
                </label>
                <input
                  type="number"
                  className="input mt-1"
                  defaultValue="15"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Break Duration (minutes)
                </label>
                <input
                  type="number"
                  className="input mt-1"
                  defaultValue="60"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Allow remote clock-in
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Require location verification
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  defaultChecked
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Send late arrival notifications
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Email Notifications</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    New employee registrations
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Leave request submissions
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Attendance anomalies
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Payroll processing updates
                  </label>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">System Notifications</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    System maintenance alerts
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Security alerts
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Security Configuration</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Password Policy
              </label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Minimum 8 characters
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Require uppercase letters
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    defaultChecked
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Require numbers
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-900">
                    Require special characters
                  </label>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Session Timeout (minutes)
                </label>
                <input
                  type="number"
                  className="input mt-1"
                  defaultValue="30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Max Login Attempts
                </label>
                <input
                  type="number"
                  className="input mt-1"
                  defaultValue="5"
                />
              </div>
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                defaultChecked
              />
              <label className="ml-2 block text-sm text-gray-900">
                Enable two-factor authentication
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  if (!hasPermission(['ADMIN'])) {
    return (
      <div className="text-center py-12">
        <CogIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">
          You don't have permission to access system settings.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage system settings and configurations
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:space-x-8">
        {/* Sidebar */}
        <div className="lg:w-64 lg:flex-shrink-0">
          <div className="card">
            <div className="card-content p-0">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                      activeTab === tab.id
                        ? 'bg-primary-100 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <tab.icon className="h-5 w-5 mr-3" />
                    {tab.name}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 mt-6 lg:mt-0">
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'users' && renderUserManagement()}
          {activeTab === 'company' && renderCompanySettings()}
          {activeTab === 'attendance' && renderAttendanceSettings()}
          {activeTab === 'notifications' && renderNotificationSettings()}
          {activeTab === 'security' && renderSecuritySettings()}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="btn-primary">
          Save Changes
        </button>
      </div>
    </div>
  )
}

export default Settings