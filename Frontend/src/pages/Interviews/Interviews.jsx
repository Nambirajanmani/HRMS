import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  CalendarIcon, 
  ClockIcon, 
  UserGroupIcon,
  MapPinIcon,
  VideoCameraIcon,
  PhoneIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon
} from '@heroicons/react/24/outline'
import { interviewAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { format, addHours } from 'date-fns'
import toast from 'react-hot-toast'

const Interviews = () => {
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedInterview, setSelectedInterview] = useState(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  const { data, isLoading } = useQuery(
    ['interviews', page, statusFilter],
    () => interviewAPI.getAll({
      page,
      limit: 10,
      status: statusFilter
    }),
    {
      keepPreviousData: true
    }
  )

  const updateMutation = useMutation(
    ({ id, data }) => interviewAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('interviews')
        toast.success('Interview updated successfully!')
        setShowFeedbackModal(false)
        reset()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update interview')
      }
    }
  )

  const interviews = data?.data?.interviews || []
  const pagination = data?.data?.pagination

  const handleStatusUpdate = useCallback((id, status) => {
    updateMutation.mutate({
      id,
      data: { status }
    })
  }, [updateMutation])

  const handleAddFeedback = useCallback((interview) => {
    setSelectedInterview(interview)
    reset({
      feedback: interview.feedback || '',
      rating: interview.rating || ''
    })
    setShowFeedbackModal(true)
  }, [reset])

  const onFeedbackSubmit = useCallback((formData) => {
    updateMutation.mutate({
      id: selectedInterview.id,
      data: {
        feedback: formData.feedback,
        rating: parseInt(formData.rating),
        status: 'completed'
      }
    })
  }, [selectedInterview, updateMutation])

  const getStatusBadge = (status) => {
    const variants = {
      scheduled: 'warning',
      completed: 'success',
      cancelled: 'error',
      rescheduled: 'info'
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const getInterviewTypeIcon = (type) => {
    switch (type) {
      case 'video':
        return <VideoCameraIcon className="h-4 w-4" />
      case 'phone':
        return <PhoneIcon className="h-4 w-4" />
      case 'in-person':
        return <MapPinIcon className="h-4 w-4" />
      default:
        return <UserGroupIcon className="h-4 w-4" />
    }
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interview Schedule</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage and track interview schedules
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
            <button
              onClick={() => setStatusFilter('')}
              className="btn-outline"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Interviews Calendar View */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Upcoming Interviews</h3>
            </div>
            <div className="card-content p-0">
              <div className="space-y-4 p-6">
                {interviews
                  .filter(interview => interview.status === 'scheduled')
                  .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                  .slice(0, 5)
                  .map((interview) => (
                    <div key={interview.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                          {getInterviewTypeIcon(interview.type)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900">
                          {interview.application?.firstName} {interview.application?.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {interview.application?.jobPosting?.title}
                        </div>
                        <div className="text-xs text-gray-500 flex items-center mt-1">
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {format(new Date(interview.scheduledAt), 'MMM dd, yyyy HH:mm')}
                          <ClockIcon className="h-3 w-3 ml-2 mr-1" />
                          {interview.duration} min
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {hasPermission(['ADMIN', 'HR']) && (
                          <>
                            <button
                              onClick={() => handleAddFeedback(interview)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="Add feedback"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(interview.id, 'completed')}
                              className="text-green-600 hover:text-green-900"
                              title="Mark as completed"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(interview.id, 'cancelled')}
                              className="text-red-600 hover:text-red-900"
                              title="Cancel interview"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                {interviews.filter(i => i.status === 'scheduled').length === 0 && (
                  <div className="text-center py-8">
                    <CalendarIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-500">No upcoming interviews</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-medium text-gray-900">Interview Stats</h3>
            </div>
            <div className="card-content">
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Scheduled:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {interviews.filter(i => i.status === 'scheduled').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Completed:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {interviews.filter(i => i.status === 'completed').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Cancelled:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {interviews.filter(i => i.status === 'cancelled').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">This Week:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {interviews.filter(i => {
                      const interviewDate = new Date(i.scheduledAt)
                      const now = new Date()
                      const weekFromNow = addHours(now, 168) // 7 days
                      return interviewDate >= now && interviewDate <= weekFromNow
                    }).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* All Interviews Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">All Interviews</h3>
        </div>
        <div className="card-content p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Candidate</Table.Head>
                <Table.Head>Position</Table.Head>
                <Table.Head>Scheduled Date</Table.Head>
                <Table.Head>Type</Table.Head>
                <Table.Head>Duration</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Rating</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {interviews.map((interview) => (
                <Table.Row key={interview.id}>
                  <Table.Cell>
                    <div className="text-sm font-medium text-gray-900">
                      {interview.application?.firstName} {interview.application?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{interview.application?.email}</div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {interview.application?.jobPosting?.title}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(interview.scheduledAt), 'MMM dd, yyyy')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(interview.scheduledAt), 'HH:mm')}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center text-sm text-gray-900">
                      {getInterviewTypeIcon(interview.type)}
                      <span className="ml-2">{interview.type || 'General'}</span>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">{interview.duration} min</div>
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge(interview.status)}
                  </Table.Cell>
                  <Table.Cell>
                    {interview.rating ? (
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`h-4 w-4 ${
                              i < interview.rating ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Not rated</span>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    {hasPermission(['ADMIN', 'HR']) && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAddFeedback(interview)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Add feedback"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {interview.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(interview.id, 'completed')}
                              className="text-green-600 hover:text-green-900"
                              title="Mark as completed"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(interview.id, 'cancelled')}
                              className="text-red-600 hover:text-red-900"
                              title="Cancel interview"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {interviews.length === 0 && (
            <div className="text-center py-12">
              <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No interviews found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No interviews match your filter criteria.
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

      {/* Feedback Modal */}
      <Modal
        open={showFeedbackModal}
        onClose={() => {
          setShowFeedbackModal(false)
          reset()
        }}
        title="Interview Feedback"
        size="lg"
      >
        <form onSubmit={handleSubmit(onFeedbackSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Rating *
            </label>
            <select
              {...register('rating', { required: 'Rating is required' })}
              className="input mt-1"
            >
              <option value="">Select rating</option>
              <option value="1">1 - Poor</option>
              <option value="2">2 - Below Average</option>
              <option value="3">3 - Average</option>
              <option value="4">4 - Good</option>
              <option value="5">5 - Excellent</option>
            </select>
            {errors.rating && (
              <p className="mt-1 text-sm text-red-600">{errors.rating.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Feedback *
            </label>
            <textarea
              {...register('feedback', { required: 'Feedback is required' })}
              rows={4}
              className="input mt-1"
              placeholder="Provide detailed feedback about the candidate's performance..."
            />
            {errors.feedback && (
              <p className="mt-1 text-sm text-red-600">{errors.feedback.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={() => {
                setShowFeedbackModal(false)
                reset()
              }} 
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isLoading}
              className="btn-primary"
            >
              {updateMutation.isLoading && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              Save Feedback
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Interviews