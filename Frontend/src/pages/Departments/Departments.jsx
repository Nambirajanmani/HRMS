import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { departmentAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { useDebounce } from '../../hooks/useDebounce'
import toast from 'react-hot-toast'

const Departments = () => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState(null)
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const debouncedSearch = useDebounce(search, 300)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm()

  // Reset page when search changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  // Build query parameters with proper validation
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams()
    
    // Always include these basic params
    params.append('page', page.toString())
    params.append('limit', '10')
    params.append('sortBy', 'name')
    params.append('sortOrder', 'asc')

    // Only add search if it has content
    if (debouncedSearch && debouncedSearch.trim().length > 0) {
      params.append('search', debouncedSearch.trim())
    }

    return params
  }, [page, debouncedSearch])

  // Fetch departments with proper error handling
  const { data, isLoading, error, refetch } = useQuery(
    ['departments', page, debouncedSearch],
    async () => {
      try {
        const queryParams = buildQueryParams()
        console.log('Fetching departments with params:', Object.fromEntries(queryParams))
        
        // Convert URLSearchParams to object for API call
        const paramsObject = Object.fromEntries(queryParams)
        const response = await departmentAPI.getAll(paramsObject)
        
        console.log('Department API response:', response)
        return response
      } catch (error) {
        console.error('Department API error:', error)
        // Re-throw to let React Query handle it
        throw error
      }
    },
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        console.log('Query retry attempt:', failureCount, error)
        // Don't retry on 4xx errors, but retry on 5xx errors up to 2 times
        const status = error?.response?.status || error?.status || 0
        
        if (status >= 400 && status < 500) {
          console.log('Not retrying 4xx error:', status)
          return false
        }
        
        if (failureCount >= 2) {
          console.log('Max retries reached')
          return false
        }
        
        console.log('Retrying request, attempt:', failureCount + 1)
        return true
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      onError: (error) => {
        console.error('Failed to fetch departments:', error)
        let message = 'Failed to fetch departments'
        
        if (error?.response?.data?.message) {
          message = error.response.data.message
        } else if (error?.message) {
          message = error.message
        } else if (error?.response?.status) {
          message = `Server error: ${error.response.status}`
        }
        
        toast.error(message)
      },
      onSuccess: (data) => {
        console.log('Successfully fetched departments:', data)
      }
    }
  )

  // Create department mutation
  const createMutation = useMutation(
    async (formData) => {
      console.log('Creating department with data:', formData)
      const response = await departmentAPI.create(formData)
      console.log('Create response:', response)
      return response
    },
    {
      onSuccess: (data) => {
        console.log('Department created successfully:', data)
        queryClient.invalidateQueries(['departments'])
        toast.success('Department created successfully!')
        setShowModal(false)
        setEditingDepartment(null)
        reset()
      },
      onError: (error) => {
        console.error('Failed to create department:', error)
        let message = 'Failed to create department'
        
        if (error?.response?.data?.message) {
          message = error.response.data.message
        } else if (error?.message) {
          message = error.message
        }
        
        toast.error(message)
      }
    }
  )

  // Update department mutation
  const updateMutation = useMutation(
    async ({ id, data }) => {
      console.log('Updating department:', id, 'with data:', data)
      const response = await departmentAPI.update(id, data)
      console.log('Update response:', response)
      return response
    },
    {
      onSuccess: (data) => {
        console.log('Department updated successfully:', data)
        queryClient.invalidateQueries(['departments'])
        toast.success('Department updated successfully!')
        setShowModal(false)
        setEditingDepartment(null)
        reset()
      },
      onError: (error) => {
        console.error('Failed to update department:', error)
        let message = 'Failed to update department'
        
        if (error?.response?.data?.message) {
          message = error.response.data.message
        } else if (error?.message) {
          message = error.message
        }
        
        toast.error(message)
      }
    }
  )

  // Delete department mutation
  const deleteMutation = useMutation(
    async (id) => {
      console.log('Deleting department:', id)
      const response = await departmentAPI.delete(id)
      console.log('Delete response:', response)
      return response
    },
    {
      onSuccess: (data) => {
        console.log('Department deleted successfully:', data)
        queryClient.invalidateQueries(['departments'])
        toast.success('Department deleted successfully!')
      },
      onError: (error) => {
        console.error('Failed to delete department:', error)
        let message = 'Failed to delete department'

        if (error?.response?.data?.message) {
          message = error.response.data.message
        } else if (error?.message) {
          message = error.message
        }

        toast.error(message)
      }
    }
  )

  // Toggle status mutation
  const toggleStatusMutation = useMutation(
    async (id) => {
      console.log('Toggling department status:', id)
      const response = await departmentAPI.toggleStatus(id)
      console.log('Toggle status response:', response)
      return response
    },
    {
      onSuccess: (data) => {
        console.log('Department status toggled successfully:', data)
        queryClient.invalidateQueries(['departments'])
        toast.success(data.message || 'Department status updated successfully!')
      },
      onError: (error) => {
        console.error('Failed to toggle department status:', error)
        let message = 'Failed to update department status'

        if (error?.response?.data?.message) {
          message = error.response.data.message
        } else if (error?.message) {
          message = error.message
        }

        toast.error(message)
      }
    }
  )

  // Safe data extraction with fallbacks
  const departments = data?.data?.departments || data?.departments || []
  const pagination = data?.data?.pagination || data?.pagination || null

  console.log('Rendered departments:', departments)
  console.log('Pagination info:', pagination)

  const handleEdit = useCallback((department) => {
    console.log('Editing department:', department)
    setEditingDepartment(department)
    reset({
      name: department.name || '',
      description: department.description || '',
    })
    setShowModal(true)
  }, [reset])

  const handleDelete = useCallback((id) => {
    if (window.confirm('Are you sure you want to delete this department? This action cannot be undone.')) {
      deleteMutation.mutate(id)
    }
  }, [deleteMutation])

  const handleToggleStatus = useCallback((department) => {
    if (window.confirm(`Are you sure you want to ${department.isActive ? 'deactivate' : 'activate'} this department?`)) {
      toggleStatusMutation.mutate(department.id)
    }
  }, [toggleStatusMutation])

  const onSubmit = useCallback((formData) => {
    console.log('Form submitted with data:', formData)
    
    // Clean and validate data before submission
    const cleanData = {
      name: formData.name?.trim() || '',
      description: formData.description?.trim() || null
    }

    // Basic validation
    if (!cleanData.name) {
      toast.error('Department name is required')
      return
    }

    if (cleanData.name.length > 100) {
      toast.error('Department name must be less than 100 characters')
      return
    }

    if (cleanData.description && cleanData.description.length > 500) {
      toast.error('Description must be less than 500 characters')
      return
    }

    // Remove empty description
    if (!cleanData.description) {
      cleanData.description = null
    }

    console.log('Cleaned data for submission:', cleanData)

    if (editingDepartment) {
      updateMutation.mutate({ id: editingDepartment.id, data: cleanData })
    } else {
      createMutation.mutate(cleanData)
    }
  }, [editingDepartment, updateMutation, createMutation])

  const closeModal = useCallback(() => {
    setShowModal(false)
    setEditingDepartment(null)
    reset()
  }, [reset])

  const handleRetry = useCallback(() => {
    console.log('Manual retry triggered')
    refetch()
  }, [refetch])

  const handleSearchChange = useCallback((e) => {
    const value = e.target.value
    console.log('Search changed to:', value)
    setSearch(value)
  }, [])

  // Loading state for initial load
  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-gray-600">Loading departments...</p>
        </div>
      </div>
    )
  }

  // Error state when no data is available
  if (error && !data) {
    console.log('Rendering error state:', error)
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-12 w-12 text-red-400 mb-4">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load departments</h3>
        <p className="text-sm text-gray-600 mb-4">
          {error?.response?.data?.message || 
           error?.message || 
           `Server error: ${error?.response?.status || 'Unknown'}`}
        </p>
        <div className="space-x-4">
          <button 
            onClick={handleRetry}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Retrying...
              </>
            ) : (
              'Try Again'
            )}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Departments</h1>
          <p className="mt-1 text-sm text-gray-500">
            {pagination?.total || departments.length || 0} departments in your organization
          </p>
        </div>
        {hasPermission && hasPermission(['ADMIN', 'HR', 'admin', 'hr']) && (
          <button 
            onClick={() => setShowModal(true)} 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
          >
            <PlusIcon className="h-5 w-5 mr-2 -ml-1" />
            Add Department
          </button>
        )}
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search departments..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150"
              value={search}
              onChange={handleSearchChange}
            />
            {debouncedSearch && (
              <button
                onClick={() => setSearch('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <span className="text-gray-400 hover:text-gray-600 text-sm">×</span>
              </button>
            )}
          </div>
          {isLoading && data && (
            <div className="mt-2">
              <div className="inline-flex items-center text-sm text-gray-600">
                <LoadingSpinner size="sm" className="mr-2" />
                Searching...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Departments Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {departments.length > 0 ? (
            <Table>
              <Table.Header>
                <Table.Row className="bg-gray-50">
                  <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </Table.Head>
                  <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </Table.Head>
                  <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manager
                  </Table.Head>
                  <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employees
                  </Table.Head>
                  <Table.Head className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </Table.Head>
                  {hasPermission && hasPermission(['ADMIN', 'HR', 'admin', 'hr']) && (
                    <Table.Head className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </Table.Head>
                  )}
                </Table.Row>
              </Table.Header>
              <Table.Body className="bg-white divide-y divide-gray-200">
                {departments.map((department) => (
                  <Table.Row key={department.id} className="hover:bg-gray-50 transition-colors">
                    <Table.Cell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {department.name}
                      </div>
                      {department.parent && (
                        <div className="text-xs text-gray-500">
                          Parent: {department.parent.name}
                        </div>
                      )}
                    </Table.Cell>
                    <Table.Cell className="px-6 py-4">
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {department.description || 'N/A'}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {department.manager ? (
                          <div>
                            <div>{`${department.manager.firstName} ${department.manager.lastName}`}</div>
                            {department.manager.position && (
                              <div className="text-xs text-gray-500">{department.manager.position.title}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">No manager assigned</span>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {department._count?.employees || 0}
                        {department._count?.children > 0 && (
                          <div className="text-xs text-gray-500">
                            {department._count.children} subdept{department._count.children !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(department)}
                        disabled={toggleStatusMutation.isLoading}
                        className="cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                        title={`Click to ${department.isActive ? 'deactivate' : 'activate'} department`}
                      >
                        <Badge variant={department.isActive ? 'success' : 'error'}>
                          {department.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </Table.Cell>
                    {hasPermission && hasPermission(['ADMIN', 'HR', 'admin', 'hr']) && (
                      <Table.Cell className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => handleEdit(department)}
                            className="text-indigo-600 hover:text-indigo-900 transition-colors"
                            title="Edit department"
                            disabled={updateMutation.isLoading}
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(department.id)}
                            className="text-red-600 hover:text-red-900 transition-colors disabled:opacity-50"
                            title={(department._count?.employees || 0) > 0 ? "Cannot delete department with active employees" : "Delete department"}
                            disabled={deleteMutation.isLoading || (department._count?.employees || 0) > 0}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </Table.Cell>
                    )}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <div className="text-center py-12 bg-gray-50">
              <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No departments found</h3>
              <p className="text-sm text-gray-600 mb-4">
                {search ? 
                  'No departments match your search criteria. Try adjusting your search.' : 
                  'Get started by creating your first department'
                }
              </p>
              {hasPermission && hasPermission(['ADMIN', 'HR', 'admin', 'hr']) && !search && (
                <button 
                  onClick={() => setShowModal(true)} 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-150"
                >
                  <PlusIcon className="h-5 w-5 mr-2 -ml-1" />
                  Create your first department
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3">
            <div className="text-sm text-gray-700 mb-4 sm:mb-0">
              Showing{' '}
              <span className="font-medium">
                {((pagination.page - 1) * pagination.limit) + 1}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of{' '}
              <span className="font-medium">{pagination.total}</span> results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={!pagination.hasPrev || isLoading}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => setPage(Math.min(pagination.pages, page + 1))}
                disabled={!pagination.hasNext || isLoading}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingDepartment ? 'Edit Department' : 'Create Department'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name', { 
                required: 'Department name is required',
                minLength: { value: 1, message: 'Department name is required' },
                maxLength: { value: 100, message: 'Department name must be less than 100 characters' },
                validate: value => value.trim().length > 0 || 'Department name cannot be empty'
              })}
              type="text"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150"
              placeholder="Enter department name"
              autoComplete="off"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              {...register('description', {
                maxLength: { value: 500, message: 'Description must be less than 500 characters' }
              })}
              rows={3}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150"
              placeholder="Enter department description (optional)"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button 
              type="button" 
              onClick={closeModal} 
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isLoading || updateMutation.isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
            >
              {(createMutation.isLoading || updateMutation.isLoading) && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              {editingDepartment ? 'Update Department' : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default Departments