import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Link, useNavigate } from 'react-router-dom'
import { 
  Bars3Icon, 
  BellIcon, 
  UserCircleIcon, 
  ArrowRightOnRectangleIcon,
  CogIcon,
  MagnifyingGlassIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../utils/cn'

const Header = ({ setSidebarOpen, sidebarCollapsed }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const userNavigation = [
    { name: 'Your Profile', href: '/profile', icon: UserCircleIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
    { name: 'Sign Out', onClick: handleLogout, icon: ArrowRightOnRectangleIcon },
  ]

  const getInitials = () => {
    if (user?.employee?.firstName && user?.employee?.lastName) {
      return `${user.employee.firstName[0]}${user.employee.lastName[0]}`.toUpperCase()
    }
    if (user?.employee?.firstName) {
      return user.employee.firstName[0].toUpperCase()
    }
    if (user?.email) {
      return user.email[0].toUpperCase()
    }
    return 'U'
  }

  const getDisplayName = () => {
    if (user?.employee?.firstName && user?.employee?.lastName) {
      return `${user.employee.firstName} ${user.employee.lastName}`
    }
    if (user?.employee?.firstName) {
      return user.employee.firstName
    }
    return user?.email || 'User'
  }

  const getRoleDisplay = () => {
    if (!user?.role) return 'Employee'
    return user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()
  }

  return (
    <div className={cn(
      "sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 transition-all duration-300",
      sidebarCollapsed ? "lg:ml-20" : "lg:ml-72"
    )}>
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden hover:bg-gray-100 rounded-md transition-colors"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Open sidebar</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator for mobile */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        {/* Search bar */}
        <div className="relative flex flex-1 items-center max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            placeholder="Search employees, departments..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
          />
        </div>

        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <Menu as="div" className="relative">
            <Menu.Button className="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
              <span className="sr-only">View notifications</span>
              <BellIcon className="h-6 w-6" aria-hidden="true" />
              {/* Notification badge */}
              <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {/* Sample notifications */}
                  <div className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 bg-blue-500 rounded-full"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          New leave request submitted
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          John Doe requested leave for Dec 25-26
                        </p>
                        <p className="text-xs text-gray-400 mt-1">2 hours ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50 border-b border-gray-100">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 bg-green-500 rounded-full"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          Attendance marked
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          You checked in at 9:00 AM today
                        </p>
                        <p className="text-xs text-gray-400 mt-1">4 hours ago</p>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 hover:bg-gray-50">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 mt-2 bg-yellow-500 rounded-full"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          Payroll processed
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          December payroll has been processed
                        </p>
                        <p className="text-xs text-gray-400 mt-1">1 day ago</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 border-t border-gray-100">
                  <Link
                    to="/notifications"
                    className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-500"
                  >
                    View all notifications
                  </Link>
                </div>
              </Menu.Items>
            </Transition>
          </Menu>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" aria-hidden="true" />

          {/* Profile dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center max-w-xs text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 hover:bg-gray-100 p-1.5 transition-colors">
              <span className="sr-only">Open user menu</span>
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <span className="text-sm font-semibold text-white">
                    {getInitials()}
                  </span>
                </div>
                <div className="hidden lg:flex lg:flex-col lg:items-start">
                  <span className="text-sm font-semibold text-gray-900 leading-none">
                    {getDisplayName()}
                  </span>
                  <span className="text-xs text-gray-500 mt-1 capitalize">
                    {getRoleDisplay()}
                  </span>
                </div>
                <ChevronDownIcon className="hidden lg:block h-4 w-4 text-gray-400" aria-hidden="true" />
              </div>
            </Menu.Button>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                      <span className="text-sm font-semibold text-white">
                        {getInitials()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {getDisplayName()}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                      <p className="text-xs text-gray-500 capitalize mt-0.5">
                        {getRoleDisplay()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Navigation items */}
                {userNavigation.map((item) => (
                  <Menu.Item key={item.name}>
                    {({ active }) => (
                      item.href ? (
                        <Link
                          to={item.href}
                          className={cn(
                            active ? 'bg-gray-50' : '',
                            'flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors'
                          )}
                        >
                          {item.icon && (
                            <item.icon className="h-4 w-4 mr-3 text-gray-400" aria-hidden="true" />
                          )}
                          {item.name}
                        </Link>
                      ) : (
                        <button
                          onClick={item.onClick}
                          className={cn(
                            active ? 'bg-gray-50' : '',
                            'flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors'
                          )}
                        >
                          {item.icon && (
                            <item.icon className="h-4 w-4 mr-3 text-gray-400" aria-hidden="true" />
                          )}
                          {item.name}
                        </button>
                      )
                    )}
                  </Menu.Item>
                ))}
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </div>
  )
}

export default Header