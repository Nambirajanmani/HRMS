import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  MagnifyingGlassIcon, 
  AcademicCapIcon,
  TrophyIcon,
  CalendarIcon,
  DocumentIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'
import { trainingRecordAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { useDebounce } from '../../hooks/useDebounce'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const TrainingRecords = () => {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
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
    ['training-records', page, debouncedSearch, statusFilter],
    () => trainingRecordAPI.getAll({
      page,
      limit: 10,
      search: debouncedSearch,
      employeeId: user?.role === 'EMPLOYEE' ? user.employee?.id : undefined
    }),
    {
      keepPreviousData: true
    }
  )

  const updateMutation = useMutation(
    ({ id, data }) => trainingRecordAPI.update(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('training-records')
        toast.success('Training record updated successfully!')
        setShowUpdateModal(false)
        reset()
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update training record')
      }
    }
  )

  const records = data?.data?.records || []
  const pagination = data?.data?.pagination

  const handleUpdateRecord = useCallback((record) => {
    setSelectedRecord(record)
    reset({
      startedAt: record.startedAt ? format(new Date(record.startedAt), 'yyyy-MM-dd') : '',
      completedAt: record.completedAt ? format(new Date(record.completedAt), 'yyyy-MM-dd') : '',
      score: record.score || '',
      certificate: record.certificate || '',
      notes: record.notes || ''
    })
    setShowUpdateModal(true)
  }, [reset])

  const onUpdateSubmit = useCallback((formData) => {
    const processedData = {
      ...formData,
      startedAt: formData.startedAt ? new Date(formData.startedAt).toISOString() : undefined,
      completedAt: formData.completedAt ? new Date(formData.completedAt).toISOString() : undefined,
      score: formData.score ? parseInt(formData.score) : undefined
    }

    updateMutation.mutate({ id: selectedRecord.id, data: processedData })
  }, [selectedRecord, updateMutation])

  const getStatusBadge = (record) => {
    if (record.completedAt) {
      return <Badge variant="success">Completed</Badge>
    } else if (record.startedAt) {
      return <Badge variant="warning">In Progress</Badge>
    } else {
      return <Badge variant="default">Enrolled</Badge>
    }
  }

  const getScoreBadge = (score) => {
    if (!score) return null
    
    let variant = 'default'
    if (score >= 90) variant = 'success'
    else if (score >= 80) variant = 'primary'
    else if (score >= 70) variant = 'warning'
    else variant = 'error'

    return <Badge variant={variant}>{score}%</Badge>
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
        <h1 className="text-2xl font-bold text-gray-900">Training Records</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track employee training progress and completion
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
                placeholder="Search training records..."
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
              <option value="enrolled">Enrolled</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
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

      {/* Training Records Table */}
      <div className="card">
        <div className="card-content p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                {hasPermission(['ADMIN', 'HR']) && <Table.Head>Employee</Table.Head>}
                <Table.Head>Program</Table.Head>
                <Table.Head>Enrolled Date</Table.Head>
                <Table.Head>Started Date</Table.Head>
                <Table.Head>Completed Date</Table.Head>
                <Table.Head>Score</Table.Head>
                <Table.Head>Status</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {records.map((record) => (
                <Table.Row key={record.id}>
                  {hasPermission(['ADMIN', 'HR']) && (
                    <Table.Cell>
                      <div className="flex items-center">
                        <div className="h-8 w-8 flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-700">
                              {record.employee?.firstName[0]}{record.employee?.lastName[0]}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">
                            {record.employee?.firstName} {record.employee?.lastName}
                          </div>
                          <div className="text-sm text-gray-500">{record.employee?.employeeId}</div>
                        </div>
                      </div>
                    </Table.Cell>
                  )}
                  <Table.Cell>
                    <div className="text-sm font-medium text-gray-900">
                      {record.program?.name}
                    </div>
                    {record.program?.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {record.program.description}
                      </div>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(record.enrolledAt), 'MMM dd, yyyy')}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {record.startedAt ? format(new Date(record.startedAt), 'MMM dd, yyyy') : 'Not started'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {record.completedAt ? format(new Date(record.completedAt), 'MMM dd, yyyy') : 'Not completed'}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    {getScoreBadge(record.score)}
                  </Table.Cell>
                  <Table.Cell>
                    {getStatusBadge(record)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex space-x-2">
                      {hasPermission(['ADMIN', 'HR']) && (
                        <button
                          onClick={() => handleUpdateRecord(record)}
                          className="text-indigo-600 hover:text-indigo-900 text-sm"
                        >
                          Update
                        </button>
                      )}
                      {record.certificate && (
                        <a
                          href={record.certificate}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-900 text-sm"
                        >
                          Certificate
                        </a>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {records.length === 0 && (
            <div className="text-center py-12">
              <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No training records found</h3>
              <p className="mt-1 text-sm text-gray-500">
                No training records match your search criteria.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Update Record Modal */}
      <Modal
        open={showUpdateModal}
        onClose={() => {
          setShowUpdateModal(false)
          reset()
        }}
        title="Update Training Record"
      >
        <form onSubmit={handleSubmit(onUpdateSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Started Date
              </label>
              <input
                {...register('startedAt')}
                type="date"
                className="input mt-1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Completed Date
              </label>
              <input
                {...register('completedAt')}
                type="date"
                className="input mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Score (%)
              </label>
              <input
                {...register('score', {
                  min: { value: 0, message: 'Score must be at least 0' },
                  max: { value: 100, message: 'Score cannot exceed 100' }
                })}
                type="number"
                className="input mt-1"
                placeholder="85"
                min="0"
                max="100"
              />
              {errors.score && (
                <p className="mt-1 text-sm text-red-600">{errors.score.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Certificate URL
              </label>
              <input
                {...register('certificate')}
                type="url"
                className="input mt-1"
                placeholder="https://example.com/certificate.pdf"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="input mt-1"
              placeholder="Additional notes about the training..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={() => {
                setShowUpdateModal(false)
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
              Update Record
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default TrainingRecords