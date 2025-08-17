import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  UserIcon, 
  PencilIcon, 
  KeyIcon,
  BellIcon,
  ShieldCheckIcon 
} from '@heroicons/react/24/outline'
import { userAPI } from '../../services/api'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const Profile = () => {
  const [activeTab, setActiveTab] = useState('profile')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const { user, refetchUser } = useAuth()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm()

  const tabs = [
    { id: 'profile', name: 'Profile', icon: UserIcon },
    { id: 'security', name: 'Security', icon: ShieldCheckIcon },
    { id: 'notifications', name: 'Notifications', icon: BellIcon },
  ]

  const { data: profileData, isLoading } = useQuery(
    ['profile', user?.id],
    () => userAPI.getById(user.id),
    {
      enabled: !!user?.id
    }
  )

  const updateProfileMutation = useMutation(
    (data) => userAPI.update(user.id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['profile', user.id])
        refetchUser()
        toast.success('Profile updated successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update profile')
      }
    }
  )

  const changePasswordMutation = useMutation(
    (data) => userAPI.changePassword(data),
    {
      onSuccess: () => {
        toast.success('Password changed successfully!')
        setShowPasswordModal(false)
        reset()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to change password')
      }
    }
  )

  const profile = profileData?.data?.user

  const onPasswordSubmit = (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    })
  }

  const renderProfileTab = () => {
    if (isLoading) return <LoadingSpinner size="lg" />

    return (
      <div className="space-y-6">
        {/* Profile Header */}
        <div className="card">
          <div className="card-content">
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0">
                <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-2xl font-medium text-gray-700">
                    {profile?.employee?.firstName?.[0] || user?.email[0].toUpperCase()}
                    {profile?.employee?.lastName?.[0] || ''}
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {profile?.employee ? 
                    `${profile.employee.firstName} ${profile.employee.lastName}` : 
                    'User Profile'
                  }
                </h2>
                <p className="text-sm text-gray-500">{profile?.email}</p>
                <p className="text-sm text-gray-500">
                  Role: <span className="font-medium">{profile?.role}</span>
                </p>
                {profile?.employee?.employeeId && (
                  <p className="text-sm text-gray-500">
                    Employee ID: <span className="font-medium">{profile.employee.employeeId}</span>
                  </p>
                )}
              </div>
              <div>
                <button className="btn-outline">
                  <PencilIcon className="h-5 w-5 mr-2" />
                  Edit Profile
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        {profile?.employee && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-500">First Name</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.employee.firstName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Last Name</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.employee.lastName}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Email</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.employee.email}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Phone</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.employee.phone || 'N/A'}</p>
                </div>
                {profile.employee.dateOfBirth && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Date of Birth</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {format(new Date(profile.employee.dateOfBirth), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-500">Gender</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.employee.gender || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Employment Information */}
        {profile?.employee && (
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Employment Information</h3>
            </div>
            <div className="card-content">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Department</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.employee.department?.name || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Position</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.employee.position?.title || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Employment Type</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.employee.employmentType?.replace('_', ' ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Hire Date</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {format(new Date(profile.employee.hireDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Manager</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile.employee.manager ? 
                      `${profile.employee.manager.firstName} ${profile.employee.manager.lastName}` : 
                      'N/A'
                    }
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500">Employment Status</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.employee.employmentStatus}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Account Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-500">Account Status</label>
                <p className="mt-1 text-sm text-gray-900">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    profile?.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {profile?.isActive ? 'Active' : 'Inactive'}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Last Login</label>
                <p className="mt-1 text-sm text-gray-900">
                  {profile?.lastLoginAt ? 
                    format(new Date(profile.lastLoginAt), 'MMM dd, yyyy HH:mm') : 
                    'Never'
                  }
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Account Created</label>
                <p className="mt-1 text-sm text-gray-900">
                  {format(new Date(profile?.createdAt), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Password & Security</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Password</h4>
                <p className="text-sm text-gray-500">Last changed 30 days ago</p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="btn-outline"
              >
                <KeyIcon className="h-4 w-4 mr-2" />
                Change Password
              </button>
            </div>
            <hr />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
                  <p className="text-sm text-gray-500">Add an extra layer of security</p>
                </div>
                <button className="btn-outline">Enable</button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Login Notifications</h4>
                  <p className="text-sm text-gray-500">Get notified of new sign-ins</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        </div>
        <div className="card-content">
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                  <ShieldCheckIcon className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">Successful login</p>
                <p className="text-xs text-gray-500">Today at 9:00 AM from Chrome on Windows</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <KeyIcon className="h-4 w-4 text-blue-600" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">Password changed</p>
                <p className="text-xs text-gray-500">30 days ago</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Email Notifications</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Leave Request Updates</h4>
                <p className="text-sm text-gray-500">Get notified when your leave requests are approved or rejected</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Payroll Notifications</h4>
                <p className="text-sm text-gray-500">Get notified when your payslip is ready</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Performance Reviews</h4>
                <p className="text-sm text-gray-500">Get notified about upcoming performance reviews</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">System Notifications</h3>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">System Maintenance</h4>
                <p className="text-sm text-gray-500">Get notified about scheduled maintenance</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Security Alerts</h4>
                <p className="text-sm text-gray-500">Get notified about security-related events</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your personal information and account settings
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
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'security' && renderSecurityTab()}
          {activeTab === 'notifications' && renderNotificationsTab()}
        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        open={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false)
          reset()
        }}
        title="Change Password"
      >
        <form onSubmit={handleSubmit(onPasswordSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Current Password *
            </label>
            <input
              {...register('currentPassword', { required: 'Current password is required' })}
              type="password"
              className="input mt-1"
              placeholder="Enter current password"
            />
            {errors.currentPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.currentPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              New Password *
            </label>
            <input
              {...register('newPassword', {
                required: 'New password is required',
                minLength: {
                  value: 8,
                  message: 'Password must be at least 8 characters'
                }
              })}
              type="password"
              className="input mt-1"
              placeholder="Enter new password"
            />
            {errors.newPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Confirm New Password *
            </label>
            <input
              {...register('confirmPassword', { required: 'Please confirm your password' })}
              type="password"
              className="input mt-1"
              placeholder="Confirm new password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowPasswordModal(false)
                reset()
              }}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={changePasswordMutation.isLoading}
              className="btn-primary flex items-center"
            >
              {changePasswordMutation.isLoading && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              Change Password
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Profile