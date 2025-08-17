import { useState } from 'react'
import { useQuery } from 'react-query'
import { 
  MagnifyingGlassIcon, 
  DocumentArrowDownIcon,
  CalendarIcon 
} from '@heroicons/react/24/outline'
import { FaIndianRupeeSign } from 'react-icons/fa6'
import { payrollAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { format } from 'date-fns'

const Payroll = () => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [page, setPage] = useState(1)
  const { user, hasPermission } = useAuth()

  const { data, isLoading } = useQuery(
    ['payroll', page, search, statusFilter, monthFilter],
    () => payrollAPI.getAll({
      page,
      limit: 10,
      search,
      status: statusFilter,
      startDate: monthFilter ? `${monthFilter}-01` : undefined,
      employeeId: user?.role === 'EMPLOYEE' ? user.employee?.id : undefined
    }),
    {
      keepPreviousData: true
    }
  )

  const records = data?.data?.records || []
  const pagination = data?.data?.pagination

  const getStatusBadge = (status) => {
    const variants = {
      DRAFT: 'default',
      PROCESSED: 'info',
      PAID: 'success',
      CANCELLED: 'error'
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const handleDownloadPayslip = (recordId) => {
    console.log('Downloading payslip for record:', recordId)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="px-1">
        <h1 className="text-2xl font-bold text-gray-800">Payroll Management</h1>
        <p className="mt-1 text-sm text-gray-600">
          {hasPermission(['ADMIN', 'HR']) 
            ? 'Manage employee payroll and salary disbursements'
            : 'View your salary details and download payslips'
          }
        </p>
      </div>

      {/* Summary Cards for HR/Admin */}
      {hasPermission(['ADMIN', 'HR']) && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Payroll Card */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-green-100 p-3 rounded-lg">
                <FaIndianRupeeSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Payroll
                  </dt>
                  <dd className="flex items-center text-2xl font-semibold text-gray-900">
                    <FaIndianRupeeSign className="h-4 w-4 mr-0.5" />
                    12,50,000
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* This Month Card */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-blue-100 p-3 rounded-lg">
                <CalendarIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    This Month
                  </dt>
                  <dd className="flex items-center text-2xl font-semibold text-gray-900">
                    <FaIndianRupeeSign className="h-4 w-4 mr-0.5" />
                    4,50,000
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Pending Card */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-amber-100 p-3 rounded-lg">
                <DocumentArrowDownIcon className="h-6 w-6 text-amber-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Pending
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    12
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          {/* Avg Salary Card */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-purple-100 p-3 rounded-lg">
                <FaIndianRupeeSign className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Avg Salary
                  </dt>
                  <dd className="flex items-center text-2xl font-semibold text-gray-900">
                    <FaIndianRupeeSign className="h-4 w-4 mr-0.5" />
                    52,000
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {/* Search Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search employees..."
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <select
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PROCESSED">Processed</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Month Filter */}
            <input
              type="month"
              className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            />

            {/* Clear Filters Button */}
            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('')
                setMonthFilter('')
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Payroll Records Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row className="bg-gray-50">
                {hasPermission(['ADMIN', 'HR']) && (
                  <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </Table.Head>
                )}
                <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pay Period
                </Table.Head>
                <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Base Salary
                </Table.Head>
                <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Overtime
                </Table.Head>
                <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bonuses
                </Table.Head>
                <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deductions
                </Table.Head>
                <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Pay
                </Table.Head>
                <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </Table.Head>
                <Table.Head className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body className="bg-white divide-y divide-gray-200">
              {records.map((record) => (
                <Table.Row key={record.id} className="hover:bg-gray-50">
                  {hasPermission(['ADMIN', 'HR']) && (
                    <Table.Cell className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-sm font-medium text-indigo-800">
                              {record.employee?.firstName[0]}{record.employee?.lastName[0]}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {record.employee?.firstName} {record.employee?.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{record.employee?.employeeId}</div>
                        </div>
                      </div>
                    </Table.Cell>
                  )}
                  <Table.Cell className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(record.payPeriodStart), 'dd MMM')} - {format(new Date(record.payPeriodEnd), 'dd MMM yyyy')}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <FaIndianRupeeSign className="h-3 w-3 mr-0.5" />
                      {formatCurrency(record.baseSalary).replace('₹', '')}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <FaIndianRupeeSign className="h-3 w-3 mr-0.5" />
                      {formatCurrency(record.overtime).replace('₹', '')}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <FaIndianRupeeSign className="h-3 w-3 mr-0.5" />
                      {formatCurrency(record.bonuses).replace('₹', '')}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 flex items-center">
                      <FaIndianRupeeSign className="h-3 w-3 mr-0.5" />
                      {formatCurrency(record.deductions).replace('₹', '')}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900 flex items-center">
                      <FaIndianRupeeSign className="h-3.5 w-3.5 mr-0.5" />
                      {formatCurrency(record.netPay).replace('₹', '')}
                    </div>
                  </Table.Cell>
                  <Table.Cell className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(record.status)}
                  </Table.Cell>
                  <Table.Cell className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleDownloadPayslip(record.id)}
                      className="text-indigo-600 hover:text-indigo-900 inline-flex items-center"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4 mr-1" />
                      Download
                    </button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {records.length === 0 && (
            <div className="text-center py-12 bg-gray-50">
              <FaIndianRupeeSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No payroll records found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your search or filter criteria
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-b-lg">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === pagination.pages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Payroll