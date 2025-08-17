import { Fragment } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { Link } from 'react-router-dom'
import { 
  Bars3Icon, 
  BellIcon, 
  UserCircleIcon, 
  ArrowRightOnRectangleIcon,
  CogIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../utils/cn'

const Header = ({ setSidebarOpen }) => {
  const { user, logout } = useAuth()

  const userNavigation = [
    { name: 'Your profile', href: '/profile', icon: UserCircleIcon },
    { name: 'Settings', href: '/settings', icon: CogIcon },
    { name: 'Sign out', onClick: logout, icon: ArrowRightOnRectangleIcon },
  ]

  return (
    <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <button
        type="button"
        className="-m-2.5 p-2.5 text-gray-700 lg:hidden hover:bg-gray-100 rounded-md transition-colors"
        onClick={() => setSidebarOpen(true)}
      >
        <span className="sr-only">Open sidebar</span>
        <Bars3Icon className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200 lg:hidden" aria-hidden="true" />

      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="relative flex flex-1 items-center max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search..."
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* Notifications */}
          <button
            type="button"
            className="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
          >
            <span className="sr-only">View notifications</span>
            <BellIcon className="h-6 w-6" aria-hidden="true" />
            {/* Notification badge */}
            <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" />
          </button>

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200" aria-hidden="true" />

          {/* Profile dropdown */}
          <Menu as="div" className="relative">
            <Menu.Button className="-m-1.5 flex items-center p-1.5 hover:bg-gray-100 rounded-md transition-colors">
              <span className="sr-only">Open user menu</span>
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-sm font-medium text-indigo-800">
                  {user?.employee?.firstName?.[0] || user?.email[0].toUpperCase()}
                  {user?.employee?.lastName?.[0] || ''}
                </span>
              </div>
              <span className="hidden lg:flex lg:items-center">
                <span className="ml-4 text-sm font-semibold leading-6 text-gray-900" aria-hidden="true">
                  {user?.employee?.firstName && user?.employee?.lastName 
                    ? `${user.employee.firstName} ${user.employee.lastName}`
                    : user?.email
                  }
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {user?.role}
                </span>
              </span>
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
              <Menu.Items className="absolute right-0 z-10 mt-2.5 w-56 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">
                    {user?.employee?.firstName && user?.employee?.lastName 
                      ? `${user.employee.firstName} ${user.employee.lastName}`
                      : user?.email
                    }
                  </p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role?.toLowerCase()}</p>
                </div>
                {userNavigation.map((item) => (
                  <Menu.Item key={item.name}>
                    {({ active }) => (
                      item.href ? (
                        <Link
                          to={item.href}
                          className={cn(
                            active ? 'bg-gray-50' : '',
                            'flex items-center w-full px-4 py-2 text-left text-sm leading-6 text-gray-900 hover:bg-gray-50'
                          )}
                        >
                          {item.icon && (
                            <item.icon className="h-5 w-5 mr-3 text-gray-400" aria-hidden="true" />
                          )}
                          {item.name}
                        </Link>
                      ) : (
                        <button
                          onClick={item.onClick}
                          className={cn(
                            active ? 'bg-gray-50' : '',
                            'flex items-center w-full px-4 py-2 text-left text-sm leading-6 text-gray-900 hover:bg-gray-50'
                          )}
                        >
                          {item.icon && (
                            <item.icon className="h-5 w-5 mr-3 text-gray-400" aria-hidden="true" />
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