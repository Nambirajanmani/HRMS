import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  DocumentIcon,
  EyeIcon,
  ArrowDownTrayIcon,
  TrashIcon,
  FolderIcon,
  DocumentTextIcon,
  PhotoIcon,
  DocumentArrowUpIcon
} from '@heroicons/react/24/outline'
import { documentAPI } from '../../services/api'
import Table from '../../components/UI/Table'
import Badge from '../../components/UI/Badge'
import LoadingSpinner from '../../components/UI/LoadingSpinner'
import Modal from '../../components/UI/Modal'
import { useAuth } from '../../contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { useDebounce } from '../../hooks/useDebounce'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

const Documents = () => {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
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
    ['documents', page, debouncedSearch, typeFilter],
    () => documentAPI.getAll({
      page,
      limit: 10,
      search: debouncedSearch,
      documentType: typeFilter,
      employeeId: user?.role === 'EMPLOYEE' ? user.employee?.id : undefined
    }),
    {
      keepPreviousData: true
    }
  )

  const uploadMutation = useMutation(
    (formData) => documentAPI.upload(formData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documents')
        toast.success('Document uploaded successfully!')
        setShowUploadModal(false)
        reset()
        setSelectedFile(null)
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to upload document')
      }
    }
  )

  const deleteMutation = useMutation(
    (id) => documentAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('documents')
        toast.success('Document deleted successfully!')
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete document')
      }
    }
  )

  const documents = data?.data?.documents || []
  const pagination = data?.data?.pagination

  const handleFileSelect = useCallback((event) => {
    const file = event.target.files[0]
    if (file) {
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB')
        return
      }
      setSelectedFile(file)
    }
  }, [])

  const handleDelete = useCallback((id) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(id)
    }
  }, [deleteMutation])

  const onUploadSubmit = useCallback((formData) => {
    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }

    const uploadData = new FormData()
    uploadData.append('file', selectedFile)
    uploadData.append('title', formData.title)
    uploadData.append('description', formData.description || '')
    uploadData.append('documentType', formData.documentType)
    uploadData.append('isConfidential', formData.isConfidential || false)
    if (formData.employeeId) {
      uploadData.append('employeeId', formData.employeeId)
    }

    uploadMutation.mutate(uploadData)
  }, [selectedFile, uploadMutation])

  const getDocumentIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) {
      return <PhotoIcon className="h-5 w-5 text-blue-500" />
    } else if (mimeType?.includes('pdf')) {
      return <DocumentIcon className="h-5 w-5 text-red-500" />
    } else if (mimeType?.includes('word') || mimeType?.includes('document')) {
      return <DocumentTextIcon className="h-5 w-5 text-blue-600" />
    }
    return <DocumentIcon className="h-5 w-5 text-gray-500" />
  }

  const getDocumentTypeBadge = (type) => {
    const variants = {
      RESUME: 'primary',
      ID_CARD: 'info',
      PASSPORT: 'info',
      DRIVING_LICENSE: 'info',
      EDUCATION_CERTIFICATE: 'success',
      EXPERIENCE_LETTER: 'success',
      SALARY_SLIP: 'warning',
      BANK_STATEMENT: 'warning',
      CONTRACT: 'error',
      POLICY: 'default',
      OTHER: 'default'
    }
    return <Badge variant={variants[type] || 'default'}>{type.replace('_', ' ')}</Badge>
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
          <h1 className="text-2xl font-bold text-gray-900">Document Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage employee documents and files
          </p>
        </div>
        <button 
          onClick={() => setShowUploadModal(true)} 
          className="btn-primary"
        >
          <DocumentArrowUpIcon className="h-5 w-5 mr-2" />
          Upload Document
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-content">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                className="input pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="RESUME">Resume</option>
              <option value="ID_CARD">ID Card</option>
              <option value="PASSPORT">Passport</option>
              <option value="EDUCATION_CERTIFICATE">Education Certificate</option>
              <option value="EXPERIENCE_LETTER">Experience Letter</option>
              <option value="CONTRACT">Contract</option>
              <option value="OTHER">Other</option>
            </select>
            <button
              onClick={() => {
                setSearch('')
                setTypeFilter('')
              }}
              className="btn-outline"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="card">
        <div className="card-content p-0">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Document</Table.Head>
                {hasPermission(['ADMIN', 'HR']) && <Table.Head>Employee</Table.Head>}
                <Table.Head>Type</Table.Head>
                <Table.Head>Size</Table.Head>
                <Table.Head>Uploaded</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {documents.map((document) => (
                <Table.Row key={document.id}>
                  <Table.Cell>
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        {getDocumentIcon(document.mimeType)}
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-medium text-gray-900">{document.title}</div>
                        <div className="text-sm text-gray-500">{document.fileName}</div>
                        {document.description && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {document.description}
                          </div>
                        )}
                      </div>
                      {document.isConfidential && (
                        <Badge variant="error" size="sm" className="ml-2">Confidential</Badge>
                      )}
                    </div>
                  </Table.Cell>
                  {hasPermission(['ADMIN', 'HR']) && (
                    <Table.Cell>
                      {document.employee ? (
                        <div className="text-sm text-gray-900">
                          {document.employee.firstName} {document.employee.lastName}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">System document</span>
                      )}
                    </Table.Cell>
                  )}
                  <Table.Cell>
                    {getDocumentTypeBadge(document.documentType)}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {formatFileSize(document.fileSize)}
                    </div>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="text-sm text-gray-900">
                      {format(new Date(document.createdAt), 'MMM dd, yyyy')}
                    </div>
                    {document.uploadedBy && (
                      <div className="text-xs text-gray-500">
                        by {document.uploadedBy.firstName} {document.uploadedBy.lastName}
                      </div>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => window.open(document.filePath, '_blank')}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="View document"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          const link = document.createElement('a')
                          link.href = document.filePath
                          link.download = document.fileName
                          link.click()
                        }}
                        className="text-green-600 hover:text-green-900"
                        title="Download document"
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                      </button>
                      {hasPermission(['ADMIN', 'HR']) && (
                        <button
                          onClick={() => handleDelete(document.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete document"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>

          {documents.length === 0 && (
            <div className="text-center py-12">
              <FolderIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No documents found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {search ? 'Try adjusting your search criteria.' : 'Upload your first document to get started.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        open={showUploadModal}
        onClose={() => {
          setShowUploadModal(false)
          reset()
          setSelectedFile(null)
        }}
        title="Upload Document"
      >
        <form onSubmit={handleSubmit(onUploadSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Document Title *
            </label>
            <input
              {...register('title', { required: 'Document title is required' })}
              type="text"
              className="input mt-1"
              placeholder="e.g. John Doe - Resume"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Document Type *
            </label>
            <select
              {...register('documentType', { required: 'Document type is required' })}
              className="input mt-1"
            >
              <option value="">Select type</option>
              <option value="RESUME">Resume</option>
              <option value="ID_CARD">ID Card</option>
              <option value="PASSPORT">Passport</option>
              <option value="DRIVING_LICENSE">Driving License</option>
              <option value="EDUCATION_CERTIFICATE">Education Certificate</option>
              <option value="EXPERIENCE_LETTER">Experience Letter</option>
              <option value="SALARY_SLIP">Salary Slip</option>
              <option value="BANK_STATEMENT">Bank Statement</option>
              <option value="CONTRACT">Contract</option>
              <option value="POLICY">Policy</option>
              <option value="OTHER">Other</option>
            </select>
            {errors.documentType && (
              <p className="mt-1 text-sm text-red-600">{errors.documentType.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              {...register('description')}
              rows={2}
              className="input mt-1"
              placeholder="Optional description..."
            />
          </div>

          {hasPermission(['ADMIN', 'HR']) && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Employee
              </label>
              <select
                {...register('employeeId')}
                className="input mt-1"
              >
                <option value="">Select employee (optional)</option>
                {/* This would be populated with actual employees */}
                <option value="emp1">John Doe</option>
                <option value="emp2">Jane Smith</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              File *
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
              <div className="space-y-1 text-center">
                <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                    <span>Upload a file</span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PDF, DOC, DOCX, JPG, PNG up to 5MB
                </p>
                {selectedFile && (
                  <div className="mt-2 text-sm text-gray-900">
                    Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center">
            <input
              {...register('isConfidential')}
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-900">
              Mark as confidential
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button 
              type="button" 
              onClick={() => {
                setShowUploadModal(false)
                reset()
                setSelectedFile(null)
              }} 
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploadMutation.isLoading || !selectedFile}
              className="btn-primary"
            >
              {uploadMutation.isLoading && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              Upload Document
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default Documents