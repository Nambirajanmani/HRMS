import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  MagnifyingGlassIcon, 
  DocumentTextIcon,
  UserIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { jobApplicationAPI, interviewAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { useDebounce } from '../../hooks/useDebounce'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const JobApplications = () => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedApplication, setSelectedApplication] = useState(null)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const debouncedSearch = useDebounce(search, 300)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  const { data, isLoading } = useQuery(
    ['job-applications', page, debouncedSearch, statusFilter],
    () => jobApplicationAPI.getAll({
      page,
      limit: 10,
      search: debouncedSearch,
      status: statusFilter
    }),
    {
      keepPreviousData: true
    }
  )

  const updateMutation = useMutation(
    ({ id, data }) => jobApplicationAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('job-applications')
        toast.success('Application updated successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update application')
      }
    }
  )

  const scheduleInterviewMutation = useMutation(
    (data) => interviewAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('job-applications')
        toast.success('Interview scheduled successfully!')
        setShowScheduleModal(false)
        reset()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to schedule interview')
      }
    }
  )

  const applications = data?.data?.applications || []
  const pagination = data?.data?.pagination

  const handleStatusUpdate = useCallback((id, status) => {
    updateMutation.mutate({
      id,
      data: { 
        status,
        screenedAt: status === 'SCREENING' ? new Date().toISOString() : undefined,
        interviewedAt: status === 'INTERVIEW' ? new Date().toISOString() : undefined
      }
    })
  }, [updateMutation])

  const handleScheduleInterview = useCallback((application) => {
    setSelectedApplication(application)
    setShowScheduleModal(true)
  }, [])

  const onScheduleSubmit = useCallback((formData) => {
    scheduleInterviewMutation.mutate({
      applicationId: selectedApplication.id,
      scheduledAt: new Date(formData.scheduledAt).toISOString(),
      duration: parseInt(formData.duration),
      location: formData.location,
      type: formData.type,
      interviewers: formData.interviewers ? formData.interviewers.split(',').map(i => i.trim()) : []
    })
  }, [selectedApplication, scheduleInterviewMutation])

  const getStatusBadge = (status) => {
    const variants = {
      APPLIED: 'info',
      SCREENING: 'warning',
      INTERVIEW: 'primary',
      ASSESSMENT: 'warning',
      OFFER: 'success',
      HIRED: 'success',
      REJECTED: 'error'
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
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
        <h1 className="text-2xl font-bold text-gray-900">Job Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Review and manage job applications
        </p>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search applications..."
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
              <option value="APPLIED">Applied</option>
              <option value="SCREENING">Screening</option>
              <option value="INTERVIEW">Interview</option>
              <option value="ASSESSMENT">Assessment</option>
              <option value="OFFER">Offer</option>
              <option value="HIRED">Hired</option>
              <option value="REJECTED">Rejected</option>
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

      {/* Applications Table */}
      <div className="card">
        <div className="card-content p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Candidate</Table.Head>
                <Table.Head>Position</Table.Head>
                <Table.Head>Applied Date</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Rating</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {applications.map((application) => (
                <Table.Row key={application.id}>
                  <Table.Cell>
                    <div className="flex items-center">
                      <div className="h-10 w-10 flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-700">
                            {application.firstName[0]}{application.lastName[0]}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {application.firstName} {application.lastName}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center">
                          <EnvelopeIcon className="h-3 w-3 mr-1" />
                          {application.email}
                        </div>
                        {application.phone && (
                          <div className="text-sm text-gray-500 flex items-center">
                            <PhoneIcon className="h-3 w-3 mr-1" />
                            {application.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {application.jobPosting?.title}
                    </div>
                    {application.jobPosting?.department && (
                      <div className="text-sm text-gray-500">
                        {application.jobPosting.department.name}
                      </div>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(application.appliedAt), 'MMM dd, yyyy')}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge(application.status)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center">
                      {application.rating ? (
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`h-4 w-4 ${
                                i < application.rating ? 'text-yellow-400' : 'text-gray-300'
                              }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          <span className="ml-1 text-sm text-gray-600">({application.rating})</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Not rated</span>
                      )}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {hasPermission(['ADMIN', 'HR']) && (
                      <div className="flex space-x-2">
                        {application.status === 'APPLIED' && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(application.id, 'SCREENING')}
                              className="text-blue-600 hover:text-blue-900"
                              title="Move to screening"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(application.id, 'REJECTED')}
                              className="text-red-600 hover:text-red-900"
                              title="Reject application"
                            >
                              <XMarkIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {application.status === 'SCREENING' && (
                          <button
                            onClick={() => handleScheduleInterview(application)}
                            className="text-indigo-600 hover:text-indigo-900 text-sm"
                          >
                            Schedule Interview
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedApplication(application)}
                          className="text-gray-600 hover:text-gray-900"
                          title="View details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {applications.length === 0 && (
            <div className="text-center py-12">
              <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No applications found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No job applications match your search criteria.
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

      {/* Schedule Interview Modal */}
      <Modal
        open={showScheduleModal}
        onClose={() => {
          setShowScheduleModal(false)
          reset()
        }}
        title="Schedule Interview"
        size="lg"
      >
        <form onSubmit={handleSubmit(onScheduleSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Interview Date & Time *
              </label>
              <input
                {...register('scheduledAt', { required: 'Date and time is required' })}
                type="datetime-local"
                className="input mt-1"
                min={new Date().toISOString().slice(0, 16)}
              />
              {errors.scheduledAt && (
                <p className="mt-1 text-sm text-red-600">{errors.scheduledAt.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Duration (minutes) *
              </label>
              <select
                {...register('duration', { required: 'Duration is required' })}
                className="input mt-1"
              >
                <option value="">Select duration</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
              {errors.duration && (
                <p className="mt-1 text-sm text-red-600">{errors.duration.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Interview Type
              </label>
              <select
                {...register('type')}
                className="input mt-1"
              >
                <option value="">Select type</option>
                <option value="phone">Phone Interview</option>
                <option value="video">Video Interview</option>
                <option value="in-person">In-Person Interview</option>
                <option value="technical">Technical Interview</option>
                <option value="behavioral">Behavioral Interview</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                {...register('location')}
                type="text"
                className="input mt-1"
                placeholder="Meeting room, Zoom link, etc."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Interviewers
            </label>
            <input
              {...register('interviewers')}
              type="text"
              className="input mt-1"
              placeholder="Enter interviewer names separated by commas"
            />
            <p className="mt-1 text-xs text-gray-500">Separate multiple interviewers with commas</p>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={() => {
                setShowScheduleModal(false)
                reset()
              }} 
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={scheduleInterviewMutation.isLoading}
              className="btn-primary"
            >
              {scheduleInterviewMutation.isLoading && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              Schedule Interview
            </button>
          </div>
        </form>
      </Modal>

      {/* Application Details Modal */}
      <Modal
        open={!!selectedApplication && !showScheduleModal}
        onClose={() => setSelectedApplication(null)}
        title="Application Details"
        size="lg"
      >
        {selectedApplication && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-500">Candidate Name</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedApplication.firstName} {selectedApplication.lastName}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1 text-sm text-gray-900">{selectedApplication.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Phone</label>
                <p className="mt-1 text-sm text-gray-900">{selectedApplication.phone || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Applied Date</label>
                <p className="mt-1 text-sm text-gray-900">
                  {format(new Date(selectedApplication.appliedAt), 'MMM dd, yyyy')}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500">Position</label>
              <p className="mt-1 text-sm text-gray-900">{selectedApplication.jobPosting?.title}</p>
            </div>

            {selectedApplication.coverLetter && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Cover Letter</label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">
                    {selectedApplication.coverLetter}
                  </p>
                </div>
              </div>
            )}

            {selectedApplication.resumeUrl && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Resume</label>
                <div className="mt-1">
                  <a
                    href={selectedApplication.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                  >
                    <DocumentTextIcon className="h-4 w-4 mr-1" />
                    View Resume
                  </a>
                </div>
              </div>
            )}

            {selectedApplication.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Notes</label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-900">{selectedApplication.notes}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              {hasPermission(['ADMIN', 'HR']) && selectedApplication.status === 'APPLIED' && (
                <>
                  <button
                    onClick={() => handleStatusUpdate(selectedApplication.id, 'SCREENING')}
                    className="btn-outline"
                  >
                    Move to Screening
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(selectedApplication.id, 'REJECTED')}
                    className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
                  >
                    Reject
                  </button>
                </>
              )}
              <button onClick={() => setSelectedApplication(null)} className="btn-primary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default JobApplications