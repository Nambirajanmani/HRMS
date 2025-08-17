import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  CheckIcon, 
  XMarkIcon,
  CalendarDaysIcon 
} from '@heroicons/react/24/outline'
import { leaveAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { format, differenceInDays } from 'date-fns'
import toast from 'react-hot-toast'

const LeaveRequests = () => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm()

  const startDate = watch('startDate')
  const endDate = watch('endDate')

  const { data, isLoading } = useQuery(
    ['leave-requests', page, search, statusFilter],
    () => leaveAPI.getRequests({
      page,
      limit: 10,
      search,
      status: statusFilter,
      employeeId: user?.role === 'EMPLOYEE' ? user.employee?.id : undefined
    }),
    {
      keepPreviousData: true
    }
  )

  const createMutation = useMutation(
    (data) => leaveAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leave-requests')
        toast.success('Leave request submitted successfully!')
        setShowModal(false)
        reset()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to submit leave request')
      }
    }
  )

  const updateMutation = useMutation(
    ({ id, data }) => leaveAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('leave-requests')
        toast.success('Leave request updated successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update leave request')
      }
    }
  )

  const requests = data?.data?.leaveRequests || []
  const pagination = data?.data?.pagination

  const calculateDays = () => {
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      return differenceInDays(end, start) + 1
    }
    return 0
  }

  const onSubmit = (data) => {
    const formattedData = {
      ...data,
      startDate: new Date(data.startDate).toISOString(),
      endDate: new Date(data.endDate).toISOString(),
      days: calculateDays(),
      employeeId: user.employee?.id
    }
    createMutation.mutate(formattedData)
  }

  const handleApprove = (id) => {
    updateMutation.mutate({
      id,
      data: { status: 'APPROVED', approvedById: user.employee?.id }
    })
  }

  const handleReject = (id, reason) => {
    const rejectionReason = reason || prompt('Please provide a reason for rejection:')
    if (rejectionReason) {
      updateMutation.mutate({
        id,
        data: { status: 'REJECTED', rejectionReason }
      })
    }
  }

  const getStatusBadge = (status) => {
    const variants = {
      PENDING: 'warning',
      APPROVED: 'success',
      REJECTED: 'error',
      CANCELLED: 'default'
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const closeModal = () => {
    setShowModal(false)
    reset()
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
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage leave requests and approvals
          </p>
        </div>
        {user?.role === 'EMPLOYEE' && (
          <div className="mt-4 sm:mt-0">
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              Request Leave
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search requests..."
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('')
              }}
              className="btn-outline"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="card">
        <div className="card-content p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Employee</Table.Head>
                <Table.Head>Leave Type</Table.Head>
                <Table.Head>Start Date</Table.Head>
                <Table.Head>End Date</Table.Head>
                <Table.Head>Days</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Applied Date</Table.Head>
                {hasPermission(['ADMIN', 'HR', 'MANAGER']) && <Table.Head>Actions</Table.Head>}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {requests.map((request) => (
                <Table.Row key={request.id}>
                  <Table.Cell>
                    <div className="flex items-center">
                      <div className="h-8 w-8 flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-700">
                            {request.employee?.firstName[0]}{request.employee?.lastName[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {request.employee?.firstName} {request.employee?.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{request.employee?.employeeId}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {request.policy?.name || 'N/A'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(request.startDate), 'MMM dd, yyyy')}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(request.endDate), 'MMM dd, yyyy')}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {request.days}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge(request.status)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(request.appliedAt), 'MMM dd, yyyy')}
                    </div>
                  </Table.Cell>
                  {hasPermission(['ADMIN', 'HR', 'MANAGER']) && (
                    <Table.Cell>
                      {request.status === 'PENDING' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Approve"
                          >
                            <CheckIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Reject"
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </Table.Cell>
                  )}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {requests.length === 0 && (
            <div className="text-center py-12">
              <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No leave requests</h3>
              <p className="mt-1 text-sm text-gray-500">
                No leave requests found for the selected criteria.
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

      {/* Leave Request Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title="Request Leave"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Leave Type *
              </label>
              <select
                {...register('policyId', { required: 'Leave type is required' })}
                className="input mt-1"
              >
                <option value="">Select leave type</option>
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="personal">Personal Leave</option>
                <option value="maternity">Maternity Leave</option>
              </select>
              {errors.policyId && (
                <p className="mt-1 text-sm text-red-600">{errors.policyId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Days Requested
              </label>
              <input
                type="number"
                value={calculateDays()}
                readOnly
                className="input mt-1 bg-gray-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Start Date *
              </label>
              <input
                {...register('startDate', { required: 'Start date is required' })}
                type="date"
                className="input mt-1"
                min={format(new Date(), 'yyyy-MM-dd')}
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                End Date *
              </label>
              <input
                {...register('endDate', { required: 'End date is required' })}
                type="date"
                className="input mt-1"
                min={startDate || format(new Date(), 'yyyy-MM-dd')}
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Reason *
            </label>
            <textarea
              {...register('reason', { required: 'Reason is required' })}
              rows={3}
              className="input mt-1"
              placeholder="Please provide a reason for your leave request"
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={closeModal} className="btn-outline">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading}
              className="btn-primary flex items-center"
            >
              {createMutation.isLoading && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              Submit Request
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default LeaveRequests