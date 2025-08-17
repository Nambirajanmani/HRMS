import { useQuery } from 'react-query'
import { 
  UsersIcon, 
  BuildingOfficeIcon, 
  ClockIcon, 
  CalendarDaysIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  PlusIcon
} from '@heroicons/react/24/outline'
import { reportsAPI } from '../../services/api'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Card from '../../components/UI/Card'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'

const Dashboard = () => {
  const { user } = useAuth()

  const { data: employeeStats, isLoading } = useQuery(
    'employee-stats',
    () => reportsAPI.getEmployeeStats(),
    {
      enabled: user?.role !== 'EMPLOYEE',
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  )

  const stats = employeeStats?.data?.stats

  const dashboardCards = [
    {
      title: 'Total Employees',
      value: stats?.overview?.totalEmployees || 0,
      icon: UsersIcon,
      color: 'bg-blue-500',
      change: '+12%',
      changeType: 'increase',
      href: '/employees'
    },
    {
      title: 'Active Employees',
      value: stats?.overview?.activeEmployees || 0,
      icon: ArrowTrendingUpIcon,
      color: 'bg-green-500',
      change: '+2%',
      changeType: 'increase',
      href: '/employees?status=ACTIVE'
    },
    {
      title: 'Departments',
      value: stats?.byDepartment?.length || 0,
      icon: BuildingOfficeIcon,
      color: 'bg-purple-500',
      change: '0%',
      changeType: 'neutral',
      href: '/departments'
    },
    {
      title: 'On Leave',
      value: stats?.overview?.onLeaveEmployees || 0,
      icon: CalendarDaysIcon,
      color: 'bg-yellow-500',
      change: '-5%',
      changeType: 'decrease',
      href: '/leave'
    }
  ]

  const quickActions = [
    {
      title: 'Clock In/Out',
      description: 'Mark your attendance for today',
      icon: ClockIcon,
      href: '/attendance',
      color: 'bg-blue-500',
      roles: ['EMPLOYEE']
    },
    {
      title: 'Request Leave',
      description: 'Submit a new leave request',
      icon: CalendarDaysIcon,
      href: '/leave',
      color: 'bg-green-500',
      roles: ['EMPLOYEE']
    },
    {
      title: 'Add Employee',
      description: 'Register a new employee',
      icon: PlusIcon,
      href: '/employees/create',
      color: 'bg-indigo-500',
      roles: ['ADMIN', 'HR']
    },
    {
      title: 'View Reports',
      description: 'Access analytics and reports',
      icon: ChartBarIcon,
      href: '/reports',
      color: 'bg-purple-500',
      roles: ['ADMIN', 'HR', 'MANAGER']
    }
  ]

  const filteredQuickActions = quickActions.filter(action => 
    action.roles.includes(user?.role)
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
              Welcome back, {user?.employee?.firstName || user?.email}
        </p>
            <p className="text-xs text-gray-400 mt-1">
              {format(new Date(), 'EEEE, MMMM dd, yyyy')}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Time</p>
            <p className="text-lg font-semibold text-gray-900">
              {format(new Date(), 'HH:mm')}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {user?.role !== 'EMPLOYEE' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {dashboardCards.map((card) => (
            <Link key={card.title} to={card.href} className="group">
              <Card className="hover:shadow-md transition-all duration-200 group-hover:border-indigo-300">
                <Card.Content className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                      <div className={`${card.color} p-3 rounded-lg shadow-sm`}>
                      <card.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {card.title}
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {card.value}
                        </div>
                        <div
                          className={`ml-2 flex items-baseline text-sm font-semibold ${
                            card.changeType === 'increase'
                              ? 'text-green-600'
                              : card.changeType === 'decrease'
                              ? 'text-red-600'
                              : 'text-gray-500'
                          }`}
                        >
                          {card.change}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
                </Card.Content>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-3">
              {filteredQuickActions.map((action) => (
                <Link
                  key={action.title}
                  to={action.href}
                  className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all duration-200 group"
                >
                  <div className={`${action.color} p-2 rounded-md mr-4 group-hover:scale-110 transition-transform`}>
                    <action.icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{action.title}</h4>
                    <p className="text-xs text-gray-500">{action.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </Card.Content>
        </Card>

        <Card>
          <Card.Header>
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </Card.Header>
          <Card.Content>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                    <ClockIcon className="h-4 w-4 text-green-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">Clocked in at 9:00 AM</p>
                  <p className="text-xs text-gray-500">{format(new Date(), 'MMM dd, yyyy')}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <CalendarDaysIcon className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">Leave request approved</p>
                  <p className="text-xs text-gray-500">Yesterday</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <UsersIcon className="h-4 w-4 text-purple-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">New employee onboarded</p>
                  <p className="text-xs text-gray-500">2 days ago</p>
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>
      </div>

      {/* Department Overview */}
      {user?.role !== 'EMPLOYEE' && stats?.byDepartment && (
        <Card>
          <Card.Header>
            <h3 className="text-lg font-medium text-gray-900">Department Overview</h3>
            <p className="text-sm text-gray-500">Employee distribution across departments</p>
          </Card.Header>
          <Card.Content>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stats.byDepartment.map((dept) => (
                <Link
                  key={dept.departmentName}
                  to="/departments"
                  className="bg-gray-50 p-4 rounded-lg hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {dept.departmentName}
                      </p>
                      <p className="text-xl font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {dept.count}
                      </p>
                      <p className="text-xs text-gray-500">employees</p>
                    </div>
                    <BuildingOfficeIcon className="h-8 w-8 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Employee-specific dashboard */}
      {user?.role === 'EMPLOYEE' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <Card.Header>
              <h3 className="text-lg font-medium text-gray-900">My Information</h3>
            </Card.Header>
            <Card.Content>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Employee ID:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {user?.employee?.employeeId || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Department:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {user?.employee?.department?.name || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Position:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {user?.employee?.position?.title || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Manager:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {user?.employee?.manager 
                      ? `${user.employee.manager.firstName} ${user.employee.manager.lastName}`
                      : 'N/A'
                    }
                  </span>
                </div>
              </div>
            </Card.Content>
          </Card>

          <Card>
            <Card.Header>
              <h3 className="text-lg font-medium text-gray-900">Leave Balance</h3>
            </Card.Header>
            <Card.Content>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Annual Leave:</span>
                  <span className="text-sm font-medium text-gray-900">15 days remaining</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Sick Leave:</span>
                  <span className="text-sm font-medium text-gray-900">8 days remaining</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Personal Leave:</span>
                  <span className="text-sm font-medium text-gray-900">3 days remaining</span>
                </div>
                <Link
                  to="/leave"
                  className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500 font-medium"
                >
                  View all balances →
                </Link>
              </div>
            </Card.Content>
          </Card>
        </div>
      )}
    </div>
  )
}

export default Dashboard
