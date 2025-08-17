import { useState, useMemo } from 'react'
import { useQuery } from 'react-query'
import { 
  ChartBarIcon, 
  UsersIcon, 
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import { reportsAPI } from '../../services/api'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Card from '../../components/UI/Card'
import { useAuth } from '../../contexts/AuthContext'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

const Analytics = () => {
  const [dateRange, setDateRange] = useState({
    startDate: format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  })
  const { hasPermission } = useAuth()

  // Fetch analytics data
  const { data: employeeStats, isLoading: employeeLoading } = useQuery(
    ['analytics-employees', dateRange],
    () => reportsAPI.getEmployeeStats(dateRange),
    {
      staleTime: 5 * 60 * 1000
    }
  )

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery(
    ['analytics-attendance', dateRange],
    () => reportsAPI.getAttendanceReport(dateRange),
    {
      staleTime: 5 * 60 * 1000
    }
  )

  const { data: leaveData, isLoading: leaveLoading } = useQuery(
    ['analytics-leave', dateRange],
    () => reportsAPI.getLeaveReport({ year: new Date().getFullYear() }),
    {
      staleTime: 5 * 60 * 1000
    }
  )

  const { data: payrollData, isLoading: payrollLoading } = useQuery(
    ['analytics-payroll', dateRange],
    () => reportsAPI.getPayrollReport(dateRange),
    {
      staleTime: 5 * 60 * 1000,
      enabled: hasPermission(['ADMIN', 'HR'])
    }
  )

  // Calculate metrics
  const metrics = useMemo(() => {
    const stats = employeeStats?.data?.stats
    const attendance = attendanceData?.data?.report
    const leave = leaveData?.data?.report
    const payroll = payrollData?.data?.report

    return {
      totalEmployees: stats?.overview?.totalEmployees || 0,
      activeEmployees: stats?.overview?.activeEmployees || 0,
      employeeGrowth: stats?.overview?.totalEmployees > 0 ? 
        ((stats?.overview?.activeEmployees / stats?.overview?.totalEmployees) * 100).toFixed(1) : 0,
      
      attendanceRate: attendance?.summary?.totalRecords > 0 ?
        ((attendance?.byStatus?.find(s => s.status === 'PRESENT')?.count || 0) / attendance?.summary?.totalRecords * 100).toFixed(1) : 0,
      
      totalLeaveRequests: leave?.summary?.totalRequests || 0,
      approvedLeaveRequests: leave?.byStatus?.find(s => s.status === 'APPROVED')?.count || 0,
      
      totalPayroll: payroll?.summary?.totalNetPay || 0,
      avgSalary: payroll?.summary?.totalRecords > 0 ?
        (payroll?.summary?.totalBaseSalary / payroll?.summary?.totalRecords).toFixed(0) : 0
    }
  }, [employeeStats, attendanceData, leaveData, payrollData])

  // Chart data preparation
  const departmentData = useMemo(() => {
    const stats = employeeStats?.data?.stats
    return stats?.byDepartment?.map(dept => ({
      name: dept.departmentName,
      value: dept.count,
      percentage: stats.overview.totalEmployees > 0 ? 
        ((dept.count / stats.overview.totalEmployees) * 100).toFixed(1) : 0
    })) || []
  }, [employeeStats])

  const employmentTypeData = useMemo(() => {
    const stats = employeeStats?.data?.stats
    return stats?.byEmploymentType?.map(type => ({
      name: type.type.replace('_', ' '),
      value: type.count,
      percentage: stats.overview.totalEmployees > 0 ? 
        ((type.count / stats.overview.totalEmployees) * 100).toFixed(1) : 0
    })) || []
  }, [employeeStats])

  const isLoading = employeeLoading || attendanceLoading || leaveLoading || payrollLoading

  if (!hasPermission(['ADMIN', 'HR', 'MANAGER'])) {
    return (
      <div className="text-center py-12">
        <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">
          You don't have permission to view analytics.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Comprehensive insights into your organization
          </p>
        </div>
        
        {/* Date Range Selector */}
        <div className="flex items-center space-x-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              className="input text-sm"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              className="input text-sm"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow">
              <Card.Content className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="bg-blue-500 p-3 rounded-lg">
                      <UsersIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Employees
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.totalEmployees}
                        </div>
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                          <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                          {metrics.employeeGrowth}%
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </Card.Content>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <Card.Content className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="bg-green-500 p-3 rounded-lg">
                      <ChartBarIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Attendance Rate
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.attendanceRate}%
                        </div>
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                          <TrendingUpIcon className="h-4 w-4 mr-1" />
                          2.1%
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </Card.Content>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <Card.Content className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="bg-yellow-500 p-3 rounded-lg">
                      <CalendarIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Leave Approval Rate
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {metrics.totalLeaveRequests > 0 ? 
                            ((metrics.approvedLeaveRequests / metrics.totalLeaveRequests) * 100).toFixed(1) : 0}%
                        </div>
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-red-600">
                          <ArrowTrendingDownIcon className="h-4 w-4 mr-1" />
                          1.2%
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </Card.Content>
            </Card>

            {hasPermission(['ADMIN', 'HR']) && (
              <Card className="hover:shadow-md transition-shadow">
                <Card.Content className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="bg-purple-500 p-3 rounded-lg">
                        <CurrencyDollarIcon className="h-6 w-6 text-white" />
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Avg Salary
                        </dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">
                            ${parseInt(metrics.avgSalary).toLocaleString()}
                          </div>
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                            <ArrowTrendingUpIcon className="h-4 w-4 mr-1" />
                            3.2%
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </Card.Content>
              </Card>
            )}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Department Distribution */}
            <Card>
              <Card.Header>
                <Card.Title>Employee Distribution by Department</Card.Title>
                <Card.Description>Current employee count across departments</Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="space-y-4">
                  {departmentData.map((dept, index) => (
                    <div key={dept.name} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded mr-3"
                          style={{ backgroundColor: `hsl(${index * 45}, 70%, 50%)` }}
                        />
                        <span className="text-sm font-medium text-gray-900">{dept.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{dept.percentage}%</span>
                        <span className="text-sm font-semibold text-gray-900">{dept.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>

            {/* Employment Type Distribution */}
            <Card>
              <Card.Header>
                <Card.Title>Employment Type Distribution</Card.Title>
                <Card.Description>Breakdown by employment type</Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="space-y-4">
                  {employmentTypeData.map((type, index) => (
                    <div key={type.name} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded mr-3"
                          style={{ backgroundColor: `hsl(${index * 60 + 180}, 70%, 50%)` }}
                        />
                        <span className="text-sm font-medium text-gray-900">{type.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{type.percentage}%</span>
                        <span className="text-sm font-semibold text-gray-900">{type.value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          </div>

          {/* Attendance Trends */}
          <Card>
            <Card.Header>
              <Card.Title>Attendance Overview</Card.Title>
              <Card.Description>Daily attendance patterns and trends</Card.Description>
            </Card.Header>
            <Card.Content>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {attendanceData?.data?.report?.byStatus?.find(s => s.status === 'PRESENT')?.count || 0}
                  </div>
                  <div className="text-sm text-gray-500">Present</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {attendanceData?.data?.report?.byStatus?.find(s => s.status === 'ABSENT')?.count || 0}
                  </div>
                  <div className="text-sm text-gray-500">Absent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {attendanceData?.data?.report?.byStatus?.find(s => s.status === 'LATE')?.count || 0}
                  </div>
                  <div className="text-sm text-gray-500">Late</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {attendanceData?.data?.report?.byStatus?.find(s => s.status === 'WORK_FROM_HOME')?.count || 0}
                  </div>
                  <div className="text-sm text-gray-500">Remote</div>
                </div>
              </div>
            </Card.Content>
          </Card>

          {/* Leave Analytics */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <Card.Header>
                <Card.Title>Leave Requests by Type</Card.Title>
                <Card.Description>Distribution of leave types</Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="space-y-3">
                  {leaveData?.data?.report?.byType?.map((type, index) => (
                    <div key={type.policyName} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: `hsl(${index * 50}, 70%, 50%)` }}
                        />
                        <span className="text-sm font-medium text-gray-900">{type.policyName}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900">{type.totalDays} days</div>
                        <div className="text-xs text-gray-500">{type.totalRequests} requests</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>

            <Card>
              <Card.Header>
                <Card.Title>Leave Request Status</Card.Title>
                <Card.Description>Current status of leave requests</Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="space-y-3">
                  {leaveData?.data?.report?.byStatus?.map((status, index) => {
                    const colors = {
                      'PENDING': 'bg-yellow-500',
                      'APPROVED': 'bg-green-500',
                      'REJECTED': 'bg-red-500',
                      'CANCELLED': 'bg-gray-500'
                    }
                    
                    return (
                      <div key={status.status} className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${colors[status.status] || 'bg-gray-400'}`} />
                          <span className="text-sm font-medium text-gray-900">{status.status}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{status.count}</span>
                      </div>
                    )
                  })}
                </div>
              </Card.Content>
            </Card>
          </div>

          {/* Recent Hires */}
          {employeeStats?.data?.stats?.recentHires?.length > 0 && (
            <Card>
              <Card.Header>
                <Card.Title>Recent Hires</Card.Title>
                <Card.Description>New employees in the last 30 days</Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="space-y-3">
                  {employeeStats.data.stats.recentHires.map((hire) => (
                    <div key={hire.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-xs font-medium text-indigo-800">
                            {hire.firstName[0]}{hire.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {hire.firstName} {hire.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {hire.department?.name} • {hire.position?.title}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(new Date(hire.hireDate), 'MMM dd, yyyy')}
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Content>
            </Card>
          )}

          {/* Payroll Summary */}
          {hasPermission(['ADMIN', 'HR']) && payrollData && (
            <Card>
              <Card.Header>
                <Card.Title>Payroll Summary</Card.Title>
                <Card.Description>Financial overview for the selected period</Card.Description>
              </Card.Header>
              <Card.Content>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      ${parseInt(payrollData.data.report.summary.totalNetPay || 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">Total Net Pay</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      ${parseInt(payrollData.data.report.summary.totalBaseSalary || 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">Base Salary</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      ${parseInt(payrollData.data.report.summary.totalBonuses || 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">Bonuses</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      ${parseInt(payrollData.data.report.summary.totalDeductions || 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">Deductions</div>
                  </div>
                </div>
              </Card.Content>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default Analytics