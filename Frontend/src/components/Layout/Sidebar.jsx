import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  XMarkIcon,
  HomeIcon,
  UsersIcon,
  BuildingOfficeIcon,
  ClockIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  ChartPieIcon,
  ChartBarIcon,
  CogIcon,
  UserIcon,
  ArrowRightOnRectangleIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  FolderIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../utils/cn'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
  { name: 'Employees', href: '/employees', icon: UsersIcon, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { name: 'Departments', href: '/departments', icon: BuildingOfficeIcon, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { name: 'Attendance', href: '/attendance', icon: ClockIcon, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
  { name: 'Leave Requests', href: '/leave', icon: CalendarDaysIcon, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
  { name: 'Payroll', href: '/payroll', icon: CurrencyDollarIcon, roles: ['ADMIN', 'HR'] },
//  { name: 'Performance', href: '/performance', icon: ChartPieIcon, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
//  { name: 'Job Postings', href: '/job-postings', icon: BriefcaseIcon, roles: ['ADMIN', 'HR'] },
//  { name: 'Applications', href: '/job-applications', icon: DocumentTextIcon, roles: ['ADMIN', 'HR'] },
//  { name: 'Interviews', href: '/interviews', icon: UserPlusIcon, roles: ['ADMIN', 'HR'] },
//  { name: 'Training', href: '/training', icon: AcademicCapIcon, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
//  { name: 'Training Records', href: '/training-records', icon: AcademicCapIcon, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
//  { name: 'Onboarding', href: '/onboarding', icon: UserPlusIcon, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
//  { name: 'Documents', href: '/documents', icon: FolderIcon, roles: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'] },
//  { name: 'Reports', href: '/reports', icon: ChartBarIcon, roles: ['ADMIN', 'HR', 'MANAGER'] },
//  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon, roles: ['ADMIN', 'HR', 'MANAGER'] },
  { name: 'Settings', href: '/settings', icon: CogIcon, roles: ['ADMIN'] },
]

const Sidebar = ({ open, setOpen }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, hasPermission, logout } = useAuth()

  const filteredNavigation = navigation.filter(item => 
    hasPermission(item.roles)
  );
  
  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const SidebarContent = () => (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center justify-between">
        {!collapsed && (
          <div className="flex items-center">
            <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3">
              <UsersIcon className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">HRMS Pro</h1>
          </div>
        )}
        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        >
          {collapsed ? (
            <ChevronDoubleRightIcon className="h-5 w-5" />
          ) : (
            <ChevronDoubleLeftIcon className="h-5 w-5" />
          )}
        </button>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-2">
          <li>
            <ul role="list" className="space-y-1">
              {filteredNavigation.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={cn(
                      location.pathname === item.href
                        ? 'bg-indigo-50 text-indigo-600 border-r-2 border-indigo-600'
                        : 'text-gray-700 hover:text-indigo-600 hover:bg-gray-50',
                      'group flex gap-x-3 rounded-l-md p-3 text-sm leading-6 font-medium transition-all duration-200',
                      collapsed ? 'justify-center' : ''
                    )}
                    title={collapsed ? item.name : ''}
                  >
                    <item.icon
                      className={cn(
                        location.pathname === item.href ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600',
                        'h-5 w-5 shrink-0'
                      )}
                      aria-hidden="true"
                    />
                    {!collapsed && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
          <li className="mt-auto">
            <div className="border-t border-gray-200 pt-6">
            <button
              onClick={handleLogout}
              className={cn(
                'group flex gap-x-3 rounded-md p-3 text-sm font-medium leading-6 text-gray-700 hover:bg-red-50 hover:text-red-600 w-full transition-colors mt-1',
                collapsed ? 'justify-center' : ''
              )}
              title={collapsed ? 'Sign Out' : ''}
            >
              <ArrowRightOnRectangleIcon
                className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-red-600"
                aria-hidden="true"
              />
              {!collapsed && <span>Sign Out</span>}
            </button>
            </div>
          </li>
        </ul>
      </nav>
    </div>
  )

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button type="button" className="-m-2.5 p-2.5" onClick={() => setOpen(false)}>
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>
                <SidebarContent />
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col",
        "transition-all duration-300 ease-in-out",
        collapsed ? "lg:w-20" : "lg:w-72"
      )}>
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white shadow-sm">
          <SidebarContent />
        </div>
      </div>
    </>
  )
}

export default Sidebar