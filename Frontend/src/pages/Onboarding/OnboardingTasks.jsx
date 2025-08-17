import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  DocumentCheckIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import { onboardingTaskAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { useDebounce } from '../../hooks/useDebounce'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const OnboardingTasks = () => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const { user, hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const debouncedSearch = useDebounce(search, 300)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  const { data, isLoading } = useQuery(
    ['onboarding-tasks', page, debouncedSearch, statusFilter],
    () => onboardingTaskAPI.getAll({
      page,
      limit: 10,
      search: debouncedSearch,
      status: statusFilter,
      employeeId: user?.role === 'EMPLOYEE' ? user.employee?.id : undefined
    }),
    {
      keepPreviousData: true
    }
  )

  const createMutation = useMutation(
    (data) => onboardingTaskAPI.create(data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('onboarding-tasks')
        toast.success('Onboarding task created successfully!')
        closeModal()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to create onboarding task')
      }
    }
  )

  const updateMutation = useMutation(
    ({ id, data }) => onboardingTaskAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('onboarding-tasks')
        toast.success('Onboarding task updated successfully!')
        closeModal()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update onboarding task')
      }
    }
  )

  const tasks = data?.data?.tasks || []
  const pagination = data?.data?.pagination

  const handleEdit = useCallback((task) => {
    setEditingTask(task)
    reset({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate ? format(new Date(task.dueDate), 'yyyy-MM-dd') : '',
      status: task.status
    })
    setShowModal(true)
  }, [reset])

  const handleStatusUpdate = useCallback((id, status) => {
    updateMutation.mutate({
      id,
      data: { 
        status,
        completedAt: status === 'COMPLETED' ? new Date().toISOString() : undefined
      }
    })
  }, [updateMutation])

  const onSubmit = useCallback((formData) => {
    const processedData = {
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined
    }

    if (editingTask) {
      updateMutation.mutate({ id: editingTask.id, data: processedData })
    } else {
      createMutation.mutate(processedData)
    }
  }, [editingTask, updateMutation, createMutation])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setEditingTask(null)
    reset()
  }, [reset])

  const getStatusBadge = (status) => {
    const variants = {
      PENDING: 'warning',
      IN_PROGRESS: 'info',
      COMPLETED: 'success',
      CANCELLED: 'error'
    }
    return <Badge variant={variants[status] || 'default'}>{status.replace('_', ' ')}</Badge>
  }

  const getPriorityIcon = (dueDate) => {
    if (!dueDate) return null
    
    const due = new Date(dueDate)
    const now = new Date()
    const daysUntilDue = Math.ceil((due - now) / (1000 * 60 * 60 * 24))
    
    if (daysUntilDue < 0) {
      return <ExclamationCircleIcon className="h-4 w-4 text-red-500" title="Overdue" />
    } else if (daysUntilDue <= 3) {
      return <ClockIcon className="h-4 w-4 text-yellow-500" title="Due soon" />
    }
    return null
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
          <h1 className="text-2xl font-bold text-gray-900">Onboarding Tasks</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee onboarding process and tasks
          </p>
        </div>
        {hasPermission(['ADMIN', 'HR']) && (
          <button 
            onClick={() => setShowModal(true)} 
            className="btn-primary"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            Create Task
          </button>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="card">
          <div className="card-content">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="bg-blue-500 p-3 rounded-lg">
                  <DocumentCheckIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Total Tasks</p>
                <p className="text-2xl font-semibold text-gray-900">{tasks.length}</p>
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
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {tasks.filter(t => t.status === 'PENDING').length}
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
                  <CheckCircleIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {tasks.filter(t => t.status === 'COMPLETED').length}
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
                  <ExclamationCircleIcon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="ml-5">
                <p className="text-sm font-medium text-gray-500">Overdue</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {tasks.filter(t => {
                    if (!t.dueDate || t.status === 'COMPLETED') return false
                    return new Date(t.dueDate) < new Date()
                  }).length}
                </p>
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
                placeholder="Search tasks..."
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
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
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

      {/* Tasks Table */}
      <div className="card">
        <div className="card-content p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Task</Table.Head>
                {hasPermission(['ADMIN', 'HR']) && <Table.Head>Employee</Table.Head>}
                <Table.Head>Due Date</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Assignee</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {tasks.map((task) => (
                <Table.Row key={task.id}>
                  <Table.Cell>
                    <div className="flex items-center">
                      {getPriorityIcon(task.dueDate)}
                      <div className={getPriorityIcon(task.dueDate) ? 'ml-2' : ''}>
                        <div className="text-sm font-medium text-gray-900">{task.title}</div>
                        {task.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {task.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </Table.Cell>
                  {hasPermission(['ADMIN', 'HR']) && (
                    <Table.Cell>
                      {task.employee ? (
                        <div className="flex items-center">
                          <div className="h-6 w-6 flex-shrink-0">
                            <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                              <span className="text-xs font-medium text-gray-700">
                                {task.employee.firstName[0]}{task.employee.lastName[0]}
                              </span>
                            </div>
                          </div>
                          <div className="ml-2">
                            <div className="text-sm text-gray-900">
                              {task.employee.firstName} {task.employee.lastName}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Unassigned</span>
                      )}
                    </Table.Cell>
                  )}
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : 'No due date'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge(task.status)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {task.assignee ? 
                        `${task.assignee.firstName} ${task.assignee.lastName}` : 
                        'Unassigned'
                      }
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex space-x-2">
                      {task.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleStatusUpdate(task.id, 'COMPLETED')}
                          className="text-green-600 hover:text-green-900"
                          title="Mark as completed"
                        >
                          <CheckCircleIcon className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission(['ADMIN', 'HR']) && (
                        <button
                          onClick={() => handleEdit(task)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit task"
                        >
                          <DocumentCheckIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {tasks.length === 0 && (
            <div className="text-center py-12">
              <DocumentCheckIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No onboarding tasks found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {search ? 'Try adjusting your search criteria.' : 'Get started by creating onboarding tasks.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingTask ? 'Edit Onboarding Task' : 'Create Onboarding Task'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Task Title *
            </label>
            <input
              {...register('title', { required: 'Task title is required' })}
              type="text"
              className="input mt-1"
              placeholder="e.g. Complete IT setup"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
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
              placeholder="Detailed description of the task..."
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Due Date
              </label>
              <input
                {...register('dueDate')}
                type="date"
                className="input mt-1"
                min={format(new Date(), 'yyyy-MM-dd')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                {...register('status')}
                className="input mt-1"
              >
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Employee
            </label>
            <select
              {...register('employeeId')}
              className="input mt-1"
            >
              <option value="">Select employee</option>
              {/* This would be populated with actual employees */}
              <option value="emp1">John Doe</option>
              <option value="emp2">Jane Smith</option>
            </select>
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
              {editingTask ? 'Update Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default OnboardingTasks