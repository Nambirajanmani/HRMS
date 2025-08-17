import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { Link } from 'react-router-dom'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  BriefcaseIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { jobPostingAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { useDebounce } from '../../hooks/useDebounce'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const JobPostings = () => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingJob, setEditingJob] = useState(null)
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
    ['job-postings', page, debouncedSearch, statusFilter],
    () => jobPostingAPI.getAll({
      page,
      limit: 10,
      search: debouncedSearch,
      status: statusFilter
    }),
    {
      keepPreviousData: true
    }
  )

  const createMutation = useMutation(
    (data) => jobPostingAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('job-postings')
        toast.success('Job posting created successfully!')
        closeModal()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create job posting')
      }
    }
  )

  const updateMutation = useMutation(
    ({ id, data }) => jobPostingAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('job-postings')
        toast.success('Job posting updated successfully!')
        closeModal()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update job posting')
      }
    }
  )

  const deleteMutation = useMutation(
    (id) => jobPostingAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('job-postings')
        toast.success('Job posting deleted successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete job posting')
      }
    }
  )

  const jobs = data?.data?.postings || []
  const pagination = data?.data?.pagination

  const handleEdit = useCallback((job) => {
    setEditingJob(job)
    reset({
      title: job.title,
      description: job.description,
      location: job.location,
      employmentType: job.employmentType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      requirements: job.requirements?.join('\n') || '',
      expiresAt: job.expiresAt ? format(new Date(job.expiresAt), 'yyyy-MM-dd') : ''
    })
    setShowModal(true)
  }, [reset])

  const handleDelete = useCallback((id) => {
    if (window.confirm('Are you sure you want to delete this job posting?')) {
      deleteMutation.mutate(id)
    }
  }, [deleteMutation])

  const onSubmit = useCallback((formData) => {
    const processedData = {
      ...formData,
      requirements: formData.requirements ? formData.requirements.split('\n').filter(req => req.trim()) : [],
      salaryMin: formData.salaryMin ? parseFloat(formData.salaryMin) : undefined,
      salaryMax: formData.salaryMax ? parseFloat(formData.salaryMax) : undefined,
      expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined
    }

    if (editingJob) {
      updateMutation.mutate({ id: editingJob.id, data: processedData })
    } else {
      createMutation.mutate(processedData)
    }
  }, [editingJob, updateMutation, createMutation])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setEditingJob(null)
    reset()
  }, [reset])

  const getStatusBadge = (status) => {
    const variants = {
      OPEN: 'success',
      IN_PROGRESS: 'warning',
      ON_HOLD: 'info',
      CLOSED: 'default',
      CANCELLED: 'error'
    }
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>
  }

  const getEmploymentTypeBadge = (type) => {
    const variants = {
      FULL_TIME: 'primary',
      PART_TIME: 'info',
      CONTRACT: 'warning',
      INTERN: 'default',
      CONSULTANT: 'default'
    }
    return <Badge variant={variants[type] || 'default'}>{type.replace('_', ' ')}</Badge>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Postings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage job openings and recruitment
          </p>
        </div>
        {hasPermission(['ADMIN', 'HR']) && (
          <button 
            onClick={() => setShowModal(true)} 
            className="btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Job Posting
          </button>
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
                placeholder="Search job postings..."
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
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="CLOSED">Closed</option>
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

      {/* Job Postings Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {jobs.map((job) => (
          <div key={job.id} className="card hover:shadow-md transition-shadow">
            <div className="card-content">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{job.title}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                    {job.department && (
                      <div className="flex items-center">
                        <BriefcaseIcon className="h-4 w-4 mr-1" />
                        {job.department.name}
                      </div>
                    )}
                    {job.location && (
                      <div className="flex items-center">
                        <MapPinIcon className="h-4 w-4 mr-1" />
                        {job.location}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {getStatusBadge(job.status)}
                  {getEmploymentTypeBadge(job.employmentType)}
                </div>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                {job.description}
              </p>

              <div className="flex items-center justify-between mb-4">
                {(job.salaryMin || job.salaryMax) && (
                  <div className="flex items-center text-sm text-gray-600">
                    <CurrencyDollarIcon className="h-4 w-4 mr-1" />
                    {job.salaryMin && job.salaryMax 
                      ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
                      : job.salaryMin 
                      ? `From $${job.salaryMin.toLocaleString()}`
                      : `Up to $${job.salaryMax.toLocaleString()}`
                    }
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-500">
                  <CalendarIcon className="h-4 w-4 mr-1" />
                  {format(new Date(job.postedAt), 'MMM dd, yyyy')}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {job._count?.applications || 0} applications
                </div>
                <div className="flex space-x-2">
                  <Link
                    to={`/job-postings/${job.id}`}
                    className="text-indigo-600 hover:text-indigo-900"
                    title="View details"
                  >
                    <EyeIcon className="h-5 w-5" />
                  </Link>
                  {hasPermission(['ADMIN', 'HR']) && (
                    <>
                      <button
                        onClick={() => handleEdit(job)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit job posting"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete job posting"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {jobs.length === 0 && (
        <div className="text-center py-12">
          <BriefcaseIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No job postings found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {search ? 'Try adjusting your search criteria.' : 'Get started by creating your first job posting.'}
          </p>
          {hasPermission(['ADMIN', 'HR']) && !search && (
            <button 
              onClick={() => setShowModal(true)} 
              className="btn-primary mt-4"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Job Posting
            </button>
          )}
        </div>
      )}

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

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingJob ? 'Edit Job Posting' : 'Create Job Posting'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Job Title *
            </label>
            <input
              {...register('title', { required: 'Job title is required' })}
              type="text"
              className="input mt-1"
              placeholder="e.g. Senior Software Engineer"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Job Description *
            </label>
            <textarea
              {...register('description', { required: 'Job description is required' })}
              rows={4}
              className="input mt-1"
              placeholder="Describe the role, responsibilities, and requirements..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Employment Type *
              </label>
              <select
                {...register('employmentType', { required: 'Employment type is required' })}
                className="input mt-1"
              >
                <option value="">Select type</option>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
                <option value="CONSULTANT">Consultant</option>
              </select>
              {errors.employmentType && (
                <p className="mt-1 text-sm text-red-600">{errors.employmentType.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                {...register('location')}
                type="text"
                className="input mt-1"
                placeholder="e.g. New York, NY or Remote"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Minimum Salary
              </label>
              <input
                {...register('salaryMin')}
                type="number"
                className="input mt-1"
                placeholder="50000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Maximum Salary
              </label>
              <input
                {...register('salaryMax')}
                type="number"
                className="input mt-1"
                placeholder="80000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Requirements
            </label>
            <textarea
              {...register('requirements')}
              rows={3}
              className="input mt-1"
              placeholder="Enter each requirement on a new line..."
            />
            <p className="mt-1 text-xs text-gray-500">Enter each requirement on a separate line</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Application Deadline
            </label>
            <input
              {...register('expiresAt')}
              type="date"
              className="input mt-1"
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={closeModal} className="btn-outline">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading || updateMutation.isLoading}
              className="btn-primary"
            >
              {(createMutation.isLoading || updateMutation.isLoading) && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              {editingJob ? 'Update Job Posting' : 'Create Job Posting'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default JobPostings