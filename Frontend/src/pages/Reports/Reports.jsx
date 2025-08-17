import { useState } from 'react'
import { useQuery } from 'react-query'
import { 
  ChartBarIcon, 
  UsersIcon, 
  ClockIcon, 
  CalendarDaysIcon,
  CurrencyDollarIcon,
  DocumentArrowDownIcon 
} from '@heroicons/react/24/outline'
import { reportsAPI } from '../../services/api'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { format, subMonths } from 'date-fns'

const Reports = () => {
  const [activeTab, setActiveTab] = useState('employees')
  const [dateRange, setDateRange] = useState({
    startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  })
  const { hasPermission } = useAuth()

  const tabs = [
    { id: 'employees', name: 'Employee Reports', icon: UsersIcon },
    { id: 'attendance', name: 'Attendance Reports', icon: ClockIcon },
    { id: 'leave', name: 'Leave Reports', icon: CalendarDaysIcon },
    { id: 'payroll', name: 'Payroll Reports', icon: CurrencyDollarIcon },
  ]

  // Employee Stats Query
  const { data: employeeStats, isLoading: employeeLoading } = useQuery(
    ['employee-stats', dateRange],
    () => reportsAPI.getEmployeeStats(dateRange),
    {
      enabled: activeTab === 'employees'
    }
  )

  // Attendance Report Query
  const { data: attendanceReport, isLoading: attendanceLoading } = useQuery(
    ['attendance-report', dateRange],
    () => reportsAPI.getAttendanceReport(dateRange),
    {
      enabled: activeTab === 'attendance'
    }
  )

  // Leave Report Query
  const { data: leaveReport, isLoading: leaveLoading } = useQuery(
    ['leave-report', dateRange],
    () => reportsAPI.getLeaveReport({ year: new Date().getFullYear() }),
    {
      enabled: activeTab === 'leave'
    }
  )

  // Payroll Report Query
  const { data: payrollReport, isLoading: payrollLoading } = useQuery(
    ['payroll-report', dateRange],
    () => reportsAPI.getPayrollReport(dateRange),
    {
      enabled: activeTab === 'payroll'
    }
  )

  const handleExportReport = (type) => {
    // This would typically generate and download a report file
    console.log('Exporting report:', type)
    // Implementation would depend on backend API
  }

  const renderEmployeeReport = () => {
    if (employeeLoading) return <LoadingSpinner size="lg" />
    
    const stats = employeeStats?.data?.stats

    return (
      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <UsersIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Total Employees</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats?.overview?.totalEmployees || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-green-500 p-3 rounded-lg">
                    <UsersIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Active Employees</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats?.overview?.activeEmployees || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-yellow-500 p-3 rounded-lg">
                    <CalendarDaysIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">On Leave</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats?.overview?.onLeaveEmployees || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-red-500 p-3 rounded-lg">
                    <UsersIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Terminated</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stats?.overview?.terminatedEmployees || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Employees by Department</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {stats?.byDepartment?.map((dept) => (
                <div key={dept.departmentName} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{dept.departmentName}</span>
                  <span className="text-sm text-gray-500">{dept.count} employees</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Employment Type Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Employment Types</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {stats?.byEmploymentType?.map((type) => (
                <div key={type.type} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{type.type.replace('_', ' ')}</span>
                  <span className="text-sm text-gray-500">{type.count} employees</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderAttendanceReport = () => {
    if (attendanceLoading) return <LoadingSpinner size="lg" />
    
    const report = attendanceReport?.data?.report

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Total Records</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {report?.summary?.totalRecords || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-green-500 p-3 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Total Hours</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round(report?.summary?.totalHoursWorked || 0)}h
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-yellow-500 p-3 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Overtime Hours</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round(report?.summary?.totalOvertimeHours || 0)}h
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-purple-500 p-3 rounded-lg">
                    <ClockIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Avg Hours/Day</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {Math.round(report?.summary?.averageHoursPerDay || 0)}h
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Attendance by Status</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {report?.byStatus?.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{status.status.replace('_', ' ')}</span>
                  <span className="text-sm text-gray-500">{status.count} records</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderLeaveReport = () => {
    if (leaveLoading) return <LoadingSpinner size="lg" />
    
    const report = leaveReport?.data?.report

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <CalendarDaysIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Total Requests</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {report?.summary?.totalRequests || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-green-500 p-3 rounded-lg">
                    <CalendarDaysIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Total Days</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {report?.summary?.totalDays || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leave by Type */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Leave by Type</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {report?.byType?.map((type) => (
                <div key={type.policyName} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{type.policyName}</span>
                  <div className="text-right">
                    <div className="text-sm text-gray-900">{type.totalDays} days</div>
                    <div className="text-xs text-gray-500">{type.totalRequests} requests</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Leave by Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Leave by Status</h3>
          </div>
          <div className="card-content">
            <div className="space-y-4">
              {report?.byStatus?.map((status) => (
                <div key={status.status} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{status.status}</span>
                  <span className="text-sm text-gray-500">{status.count} requests</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderPayrollReport = () => {
    if (payrollLoading) return <LoadingSpinner size="lg" />
    
    const report = payrollReport?.data?.report

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount)
    }

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-green-500 p-3 rounded-lg">
                    <CurrencyDollarIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Total Net Pay</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(report?.summary?.totalNetPay || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-blue-500 p-3 rounded-lg">
                    <CurrencyDollarIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Base Salary</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(report?.summary?.totalBaseSalary || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-yellow-500 p-3 rounded-lg">
                    <CurrencyDollarIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Total Bonuses</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(report?.summary?.totalBonuses || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-content">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="bg-red-500 p-3 rounded-lg">
                    <CurrencyDollarIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5">
                  <p className="text-sm font-medium text-gray-500">Total Deductions</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(report?.summary?.totalDeductions || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!hasPermission(['ADMIN', 'HR', 'MANAGER'])) {
    return (
      <div className="text-center py-12">
        <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-500">
          You don't have permission to view reports.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">
            View comprehensive reports and analytics
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => handleExportReport(activeTab)}
            className="btn-primary"
          >
            <DocumentArrowDownIcon className="h-5 w-5 mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date</label>
              <input
                type="date"
                className="input mt-1"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date</label>
              <input
                type="date"
                className="input mt-1"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <button className="btn-outline w-full">Apply Filter</button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'employees' && renderEmployeeReport()}
        {activeTab === 'attendance' && renderAttendanceReport()}
        {activeTab === 'leave' && renderLeaveReport()}
        {activeTab === 'payroll' && renderPayrollReport()}
      </div>
    </div>
  )
}

export default Reports