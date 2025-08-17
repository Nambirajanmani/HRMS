import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  AcademicCapIcon,
  ClockIcon,
  UsersIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import { trainingProgramAPI, trainingRecordAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'

const TrainingPrograms = () => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingProgram, setEditingProgram] = useState(null)
  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [selectedProgram, setSelectedProgram] = useState(null)
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
    ['training-programs', page, debouncedSearch],
    () => trainingProgramAPI.getAll({
      page,
      limit: 10,
      search: debouncedSearch
    }),
    {
      keepPreviousData: true
    }
  )

  const createMutation = useMutation(
    (data) => trainingProgramAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('training-programs')
        toast.success('Training program created successfully!')
        closeModal()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create training program')
      }
    }
  )

  const updateMutation = useMutation(
    ({ id, data }) => trainingProgramAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('training-programs')
        toast.success('Training program updated successfully!')
        closeModal()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update training program')
      }
    }
  )

  const deleteMutation = useMutation(
    (id) => trainingProgramAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('training-programs')
        toast.success('Training program deleted successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete training program')
      }
    }
  )

  const enrollMutation = useMutation(
    (data) => trainingRecordAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('training-programs')
        toast.success('Employee enrolled successfully!')
        setShowEnrollModal(false)
        reset()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to enroll employee')
      }
    }
  )

  const programs = data?.data?.programs || []
  const pagination = data?.data?.pagination

  const handleEdit = useCallback((program) => {
    setEditingProgram(program)
    reset({
      name: program.name,
      description: program.description,
      duration: program.duration
    })
    setShowModal(true)
  }, [reset])

  const handleDelete = useCallback((id) => {
    if (window.confirm('Are you sure you want to delete this training program?')) {
      deleteMutation.mutate(id)
    }
  }, [deleteMutation])

  const handleEnroll = useCallback((program) => {
    setSelectedProgram(program)
    setShowEnrollModal(true)
  }, [])

  const onSubmit = useCallback((formData) => {
    const processedData = {
      ...formData,
      duration: formData.duration ? parseInt(formData.duration) : undefined
    }

    if (editingProgram) {
      updateMutation.mutate({ id: editingProgram.id, data: processedData })
    } else {
      createMutation.mutate(processedData)
    }
  }, [editingProgram, updateMutation, createMutation])

  const onEnrollSubmit = useCallback((formData) => {
    enrollMutation.mutate({
      programId: selectedProgram.id,
      employeeId: formData.employeeId
    })
  }, [selectedProgram, enrollMutation])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setEditingProgram(null)
    reset()
  }, [reset])

  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
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
          <h1 className="text-2xl font-bold text-gray-900">Training Programs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee training and development programs
          </p>
        </div>
        {hasPermission(['ADMIN', 'HR']) && (
          <button 
            onClick={() => setShowModal(true)} 
            className="btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Program
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card">
        <div className="card-content">
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search training programs..."
              className="input pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Training Programs Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {programs.map((program) => (
          <div key={program.id} className="card hover:shadow-md transition-shadow">
            <div className="card-content">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{program.name}</h3>
                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                    <div className="flex items-center">
                      <ClockIcon className="h-4 w-4 mr-1" />
                      {formatDuration(program.duration)}
                    </div>
                    <div className="flex items-center">
                      <UsersIcon className="h-4 w-4 mr-1" />
                      {program._count?.trainingRecords || 0} enrolled
                    </div>
                  </div>
                </div>
                <Badge variant={program.isActive ? 'success' : 'default'}>
                  {program.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                {program.description || 'No description available'}
              </p>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {program.trainingRecords?.filter(r => r.completedAt).length || 0} completed
                </div>
                <div className="flex space-x-2">
                  {hasPermission(['ADMIN', 'HR']) && (
                    <>
                      <button
                        onClick={() => handleEnroll(program)}
                        className="text-green-600 hover:text-green-900"
                        title="Enroll employee"
                      >
                        <PlayIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(program)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Edit program"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(program.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete program"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {programs.length === 0 && (
        <div className="text-center py-12">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No training programs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {search ? 'Try adjusting your search criteria.' : 'Get started by creating your first training program.'}
          </p>
          {hasPermission(['ADMIN', 'HR']) && !search && (
            <button 
              onClick={() => setShowModal(true)} 
              className="btn-primary mt-4"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Training Program
            </button>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingProgram ? 'Edit Training Program' : 'Create Training Program'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Program Name *
            </label>
            <input
              {...register('name', { required: 'Program name is required' })}
              type="text"
              className="input mt-1"
              placeholder="e.g. Leadership Development"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={3}
              className="input mt-1"
              placeholder="Describe the training program objectives and content..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Duration (minutes)
            </label>
            <input
              {...register('duration')}
              type="number"
              className="input mt-1"
              placeholder="120"
            />
            <p className="mt-1 text-xs text-gray-500">Total duration in minutes</p>
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
              {editingProgram ? 'Update Program' : 'Create Program'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Enroll Employee Modal */}
      <Modal
        open={showEnrollModal}
        onClose={() => {
          setShowEnrollModal(false)
          reset()
        }}
        title="Enroll Employee"
      >
        <form onSubmit={handleSubmit(onEnrollSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Employee *
            </label>
            <select
              {...register('employeeId', { required: 'Employee is required' })}
              className="input mt-1"
            >
              <option value="">Select employee</option>
              {/* This would be populated with actual employees */}
              <option value="emp1">John Doe</option>
              <option value="emp2">Jane Smith</option>
            </select>
            {errors.employeeId && (
              <p className="mt-1 text-sm text-red-600">{errors.employeeId.message}</p>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-md">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Program Details</h4>
            <p className="text-sm text-gray-600">{selectedProgram?.name}</p>
            {selectedProgram?.description && (
              <p className="text-sm text-gray-500 mt-1">{selectedProgram.description}</p>
            )}
            {selectedProgram?.duration && (
              <p className="text-sm text-gray-500 mt-1">
                Duration: {formatDuration(selectedProgram.duration)}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={() => {
                setShowEnrollModal(false)
                reset()
              }} 
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enrollMutation.isLoading}
              className="btn-primary"
            >
              {enrollMutation.isLoading && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              Enroll Employee
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default TrainingPrograms