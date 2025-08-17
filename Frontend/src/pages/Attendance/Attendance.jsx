import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  ClockIcon, 
  CalendarIcon, 
  PlayIcon, 
  StopIcon,
  MagnifyingGlassIcon 
} from '@heroicons/react/24/outline'
import { attendanceAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import { useAuth } from '../../contexts/AuthContext'
import { format, isToday } from 'date-fns'
import toast from 'react-hot-toast'

const Attendance = () => {
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [page, setPage] = useState(1)
  const [currentTime, setCurrentTime] = useState(new Date())
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()

  // Update current time every second
  useState(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data, isLoading } = useQuery(
    ['attendance', page, search, dateFilter],
    () => attendanceAPI.getAll({
      page,
      limit: 10,
      search,
      date: dateFilter,
      employeeId: user?.role === 'EMPLOYEE' ? user.employee?.id : undefined
    }),
    {
      keepPreviousData: true,
      refetchInterval: 30000 // Refetch every 30 seconds
    }
  )

  const clockInMutation = useMutation(
    (data) => attendanceAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('attendance')
        toast.success('Clocked in successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to clock in')
      }
    }
  )

  const clockOutMutation = useMutation(
    ({ id, data }) => attendanceAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('attendance')
        toast.success('Clocked out successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to clock out')
      }
    }
  )

  const records = data?.data?.records || []
  const pagination = data?.data?.pagination

  // Find today's attendance record for current user
  const todayRecord = records.find(record => 
    record.employee.id === user?.employee?.id && 
    isToday(new Date(record.date))
  )

  const handleClockIn = () => {
    if (!user?.employee?.id) {
      toast.error('Employee profile not found')
      return
    }

    clockInMutation.mutate({
      employeeId: user.employee.id,
      date: new Date().toISOString(),
      checkIn: new Date().toISOString(),
      status: 'PRESENT'
    })
  }

  const handleClockOut = () => {
    if (!todayRecord) {
      toast.error('No clock-in record found for today')
      return
    }

    clockOutMutation.mutate({
      id: todayRecord.id,
      data: {
        checkOut: new Date().toISOString(),
        status: 'PRESENT'
      }
    })
  }

  const getStatusBadge = (status) => {
    const variants = {
      PRESENT: 'success',
      ABSENT: 'error',
      LATE: 'warning',
      HALF_DAY: 'info',
      WORK_FROM_HOME: 'primary'
    }
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>
  }

  const canClockIn = user?.role === 'EMPLOYEE' && (!todayRecord || !todayRecord.checkIn)
  const canClockOut = user?.role === 'EMPLOYEE' && todayRecord?.checkIn && !todayRecord.checkOut

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track and manage attendance records
        </p>
      </div>

      {/* Clock In/Out Section for Employees */}
      {user?.role === 'EMPLOYEE' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Current Time</h3>
            </div>
            <div className="card-content">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 mb-2">
                  {format(currentTime, 'HH:mm:ss')}
                </div>
                <div className="text-lg text-gray-500">
                  {format(currentTime, 'EEEE, MMMM dd, yyyy')}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Today's Status</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                {todayRecord ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Clock In:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {todayRecord.checkIn ? format(new Date(todayRecord.checkIn), 'HH:mm') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Clock Out:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {todayRecord.checkOut ? format(new Date(todayRecord.checkOut), 'HH:mm') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Status:</span>
                      {getStatusBadge(todayRecord.status)}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No attendance record for today</p>
                )}

                <div className="flex space-x-3">
                  <button
                    onClick={handleClockIn}
                    disabled={!canClockIn || clockInMutation.isLoading}
                    className="btn-primary flex-1 flex items-center justify-center disabled:opacity-50"
                  >
                    {clockInMutation.isLoading ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <PlayIcon className="h-5 w-5 mr-2" />
                    )}
                    Clock In
                  </button>
                  <button
                    onClick={handleClockOut}
                    disabled={!canClockOut || clockOutMutation.isLoading}
                    className="btn-secondary flex-1 flex items-center justify-center disabled:opacity-50"
                  >
                    {clockOutMutation.isLoading ? (
                      <LoadingSpinner size="sm" className="mr-2" />
                    ) : (
                      <StopIcon className="h-5 w-5 mr-2" />
                    )}
                    Clock Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="date"
                className="input pl-10"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
            <button
              onClick={() => {
                setSearch('')
                setDateFilter('')
              }}
              className="btn-outline"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="card">
        <div className="card-content p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Employee</Table.Head>
                <Table.Head>Date</Table.Head>
                <Table.Head>Clock In</Table.Head>
                <Table.Head>Clock Out</Table.Head>
                <Table.Head>Hours Worked</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Notes</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {records.map((record) => (
                <Table.Row key={record.id}>
                  <Table.Cell>
                    <div className="flex items-center">
                      <div className="h-8 w-8 flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-700">
                            {record.employee.firstName[0]}{record.employee.lastName[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {record.employee.firstName} {record.employee.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{record.employee.employeeId}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(record.date), 'MMM dd, yyyy')}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {record.checkIn ? format(new Date(record.checkIn), 'HH:mm') : 'N/A'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {record.checkOut ? format(new Date(record.checkOut), 'HH:mm') : 'N/A'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {record.hoursWorked ? `${record.hoursWorked}h` : 'N/A'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge(record.status)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-500">
                      {record.notes || 'N/A'}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {records.length === 0 && (
            <div className="text-center py-12">
              <ClockIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No attendance records</h3>
              <p className="mt-1 text-sm text-gray-500">
                No attendance records found for the selected criteria.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="btn-outline disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === pagination.pages}
              className="btn-outline disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Attendance