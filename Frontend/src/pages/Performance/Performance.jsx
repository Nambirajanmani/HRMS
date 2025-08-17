import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  StarIcon,
  ChartBarIcon,
  DocumentTextIcon 
} from '@heroicons/react/24/outline'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const Performance = () => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedReview, setSelectedReview] = useState(null)
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  // Mock data - replace with actual API calls
  const { data, isLoading } = useQuery(
    ['performance-reviews', page, search, statusFilter],
    () => Promise.resolve({
      data: {
        reviews: [
          {
            id: '1',
            employee: {
              id: '1',
              firstName: 'John',
              lastName: 'Doe',
              employeeId: 'EMP001'
            },
            reviewer: {
              id: '2',
              firstName: 'Jane',
              lastName: 'Smith'
            },
            reviewPeriodStart: '2024-01-01',
            reviewPeriodEnd: '2024-06-30',
            overallRating: 'EXCEEDS_EXPECTATIONS',
            status: 'COMPLETED',
            submittedAt: '2024-07-15T10:00:00Z',
            goals: ['Improve team collaboration', 'Complete certification'],
            achievements: 'Successfully led 3 major projects',
            feedback: 'Excellent performance throughout the review period'
          }
        ],
        pagination: { page: 1, limit: 10, total: 1, pages: 1 }
      }
    }),
    {
      keepPreviousData: true
    }
  )

  const reviews = data?.data?.reviews || []
  const pagination = data?.data?.pagination

  const getRatingBadge = (rating) => {
    const variants = {
      OUTSTANDING: 'success',
      EXCEEDS_EXPECTATIONS: 'primary',
      MEETS_EXPECTATIONS: 'info',
      BELOW_EXPECTATIONS: 'warning',
      UNSATISFACTORY: 'error'
    }
    const labels = {
      OUTSTANDING: 'Outstanding',
      EXCEEDS_EXPECTATIONS: 'Exceeds Expectations',
      MEETS_EXPECTATIONS: 'Meets Expectations',
      BELOW_EXPECTATIONS: 'Below Expectations',
      UNSATISFACTORY: 'Unsatisfactory'
    }
    return <Badge variant={variants[rating] || 'default'}>{labels[rating] || rating}</Badge>
  }

  const getStatusBadge = (status) => {
    const variants = {
      DRAFT: 'default',
      IN_PROGRESS: 'warning',
      COMPLETED: 'success',
      OVERDUE: 'error'
    }
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>
  }

  const onSubmit = (data) => {
    console.log('Creating performance review:', data)
    toast.success('Performance review created successfully!')
    setShowModal(false)
    reset()
  }

  const handleViewReview = (review) => {
    setSelectedReview(review)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedReview(null)
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
          <h1 className="text-2xl font-bold text-gray-900">Performance Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Track and manage employee performance reviews
          </p>
        </div>
        {hasPermission(['ADMIN', 'HR', 'MANAGER']) && (
          <div className="mt-4 sm:mt-0">
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <PlusIcon className="h-5 w-5 mr-2" />
              New Review
            </button>
          </div>
        )}
      </div>

      {/* Performance Overview Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-blue-500 p-3 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Total Reviews</p>
                <p className="text-2xl font-semibold text-gray-900">24</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-green-500 p-3 rounded-lg">
                  <StarIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">18</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-yellow-500 p-3 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">In Progress</p>
                <p className="text-2xl font-semibold text-gray-900">4</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-red-500 p-3 rounded-lg">
                  <ChartBarIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-semibold text-gray-900">2</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search reviews..."
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
              <option value="DRAFT">Draft</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="OVERDUE">Overdue</option>
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

      {/* Performance Reviews Table */}
      <div className="card">
        <div className="card-content p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Employee</Table.Head>
                <Table.Head>Reviewer</Table.Head>
                <Table.Head>Review Period</Table.Head>
                <Table.Head>Overall Rating</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Submitted</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {reviews.map((review) => (
                <Table.Row key={review.id}>
                  <Table.Cell>
                    <div className="flex items-center">
                      <div className="h-8 w-8 flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-700">
                            {review.employee.firstName[0]}{review.employee.lastName[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">
                          {review.employee.firstName} {review.employee.lastName}
                        </div>
                        <div className="text-sm text-gray-500">{review.employee.employeeId}</div>
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {review.reviewer.firstName} {review.reviewer.lastName}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(review.reviewPeriodStart), 'MMM yyyy')} - {format(new Date(review.reviewPeriodEnd), 'MMM yyyy')}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {review.overallRating ? getRatingBadge(review.overallRating) : 'N/A'}
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge(review.status)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {review.submittedAt ? format(new Date(review.submittedAt), 'MMM dd, yyyy') : 'N/A'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <button
                      onClick={() => handleViewReview(review)}
                      className="text-primary-600 hover:text-primary-900 text-sm font-medium"
                    >
                      View
                    </button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {reviews.length === 0 && (
            <div className="text-center py-12">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No performance reviews</h3>
              <p className="mt-1 text-sm text-gray-500">
                No performance reviews found for the selected criteria.
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

      {/* Create Review Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title="Create Performance Review"
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Employee *
              </label>
              <select
                {...register('employeeId', { required: 'Employee is required' })}
                className="input mt-1"
              >
                <option value="">Select employee</option>
                <option value="1">John Doe</option>
                <option value="2">Jane Smith</option>
              </select>
              {errors.employeeId && (
                <p className="mt-1 text-sm text-red-600">{errors.employeeId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Reviewer *
              </label>
              <select
                {...register('reviewerId', { required: 'Reviewer is required' })}
                className="input mt-1"
              >
                <option value="">Select reviewer</option>
                <option value="1">Manager One</option>
                <option value="2">Manager Two</option>
              </select>
              {errors.reviewerId && (
                <p className="mt-1 text-sm text-red-600">{errors.reviewerId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Review Period Start *
              </label>
              <input
                {...register('reviewPeriodStart', { required: 'Start date is required' })}
                type="date"
                className="input mt-1"
              />
              {errors.reviewPeriodStart && (
                <p className="mt-1 text-sm text-red-600">{errors.reviewPeriodStart.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Review Period End *
              </label>
              <input
                {...register('reviewPeriodEnd', { required: 'End date is required' })}
                type="date"
                className="input mt-1"
              />
              {errors.reviewPeriodEnd && (
                <p className="mt-1 text-sm text-red-600">{errors.reviewPeriodEnd.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Goals
            </label>
            <textarea
              {...register('goals')}
              rows={3}
              className="input mt-1"
              placeholder="Enter performance goals for this review period"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={closeModal} className="btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Review
            </button>
          </div>
        </form>
      </Modal>

      {/* View Review Modal */}
      <Modal
        open={!!selectedReview}
        onClose={closeModal}
        title="Performance Review Details"
        size="lg"
      >
        {selectedReview && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-500">Employee</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedReview.employee.firstName} {selectedReview.employee.lastName}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Reviewer</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedReview.reviewer.firstName} {selectedReview.reviewer.lastName}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Review Period</label>
                <p className="mt-1 text-sm text-gray-900">
                  {format(new Date(selectedReview.reviewPeriodStart), 'MMM dd, yyyy')} - {format(new Date(selectedReview.reviewPeriodEnd), 'MMM dd, yyyy')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Overall Rating</label>
                <div className="mt-1">
                  {selectedReview.overallRating ? getRatingBadge(selectedReview.overallRating) : 'Not rated'}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">Goals</label>
              <div className="mt-1">
                {selectedReview.goals && selectedReview.goals.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1">
                    {selectedReview.goals.map((goal, index) => (
                      <li key={index} className="text-sm text-gray-900">{goal}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No goals set</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">Achievements</label>
              <p className="mt-1 text-sm text-gray-900">
                {selectedReview.achievements || 'No achievements recorded'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">Feedback</label>
              <p className="mt-1 text-sm text-gray-900">
                {selectedReview.feedback || 'No feedback provided'}
              </p>
            </div>

            <div className="flex justify-end">
              <button onClick={closeModal} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Performance