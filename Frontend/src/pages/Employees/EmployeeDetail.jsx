import { useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  ArrowLeftIcon, 
  PencilIcon, 
  EnvelopeIcon, 
  PhoneIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  UserIcon,
  TrashIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { employeeAPI } from '../../services/api';
import Badge from '../../components/UI/Badge';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import Modal from '../../components/UI/Modal';
import Alert from '../../components/UI/Alert';
import { useAuth } from '../../contexts/AuthContext';
import { format } from 'date-fns';
import { cn } from '../../utils/cn';
import toast from 'react-hot-toast';

const EmployeeDetail = () => {
  // Hooks for state management
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState('overview');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Fetch employee data
  const { data, isLoading, error } = useQuery(
    ['employee', id],
    () => employeeAPI.getById(id),
    {
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  // Delete employee mutation
  const deleteMutation = useMutation(
    () => employeeAPI.delete(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('employees');
        toast.success('Employee terminated successfully!');
        navigate('/employees');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to terminate employee');
      }
    }
  );

  // Memoized employee data
  const employee = useMemo(() => data?.data, [data]);

  // Tab configuration
  const tabs = useMemo(() => [
    { id: 'overview', name: 'Overview' },
    { id: 'attendance', name: 'Attendance' },
    { id: 'leave', name: 'Leave History' },
    { id: 'documents', name: 'Documents' },
    { id: 'performance', name: 'Performance' },
  ], []);

  // Event handlers using useCallback
  const handleTabChange = useCallback((tabId) => {
    setActiveTab(tabId);
  }, []);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteModal(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    deleteMutation.mutate();
    setShowDeleteModal(false);
  }, [deleteMutation]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteModal(false);
  }, []);

  // Badge rendering functions
  const getStatusBadge = useCallback((status) => {
    const variants = {
      ACTIVE: 'success',
      INACTIVE: 'warning',
      TERMINATED: 'error',
      ON_LEAVE: 'info',
      PROBATION: 'warning'
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  }, []);

  const getEmploymentTypeBadge = useCallback((type) => {
    const variants = {
      FULL_TIME: 'primary',
      PART_TIME: 'info',
      CONTRACT: 'warning',
      INTERN: 'default',
      CONSULTANT: 'default'
    };
    return <Badge variant={variants[type] || 'default'}>{type.replace('_', ' ')}</Badge>;
  }, []);

  // Render personal information section
  const renderPersonalInfo = useCallback(() => (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Personal Information</h3>
      <dl className="space-y-3">
        <div>
          <dt className="text-sm font-medium text-gray-500">Full Name</dt>
          <dd className="text-sm text-gray-900">
            {employee.firstName} {employee.middleName} {employee.lastName}
          </dd>
        </div>
        {employee.dateOfBirth && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
            <dd className="text-sm text-gray-900">
              {format(new Date(employee.dateOfBirth), 'MMM dd, yyyy')}
            </dd>
          </div>
        )}
        {employee.gender && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Gender</dt>
            <dd className="text-sm text-gray-900">{employee.gender}</dd>
          </div>
        )}
        {employee.maritalStatus && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Marital Status</dt>
            <dd className="text-sm text-gray-900">{employee.maritalStatus}</dd>
          </div>
        )}
        {employee.nationality && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Nationality</dt>
            <dd className="text-sm text-gray-900">{employee.nationality}</dd>
          </div>
        )}
        {employee.address && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Address</dt>
            <dd className="text-sm text-gray-900">
              {employee.address}
              {employee.city && `, ${employee.city}`}
              {employee.state && `, ${employee.state}`}
              {employee.zipCode && ` ${employee.zipCode}`}
              {employee.country && `, ${employee.country}`}
            </dd>
          </div>
        )}
        {(employee.emergencyContactName || employee.emergencyContactPhone) && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Emergency Contact</dt>
            <dd className="text-sm text-gray-900">
              {employee.emergencyContactName}
              {employee.emergencyContactPhone && ` - ${employee.emergencyContactPhone}`}
              {employee.emergencyContactRelation && ` (${employee.emergencyContactRelation})`}
            </dd>
          </div>
        )}
      </dl>
    </div>
  ), [employee]);

  // Render employment information section
  const renderEmploymentInfo = useCallback(() => (
    <div>
      <h3 className="text-lg font-medium text-gray-900 mb-4">Employment Information</h3>
      <dl className="space-y-3">
        <div>
          <dt className="text-sm font-medium text-gray-500">Manager</dt>
          <dd className="text-sm text-gray-900">
            {employee.manager ? 
              `${employee.manager.firstName} ${employee.manager.lastName}` : 
              'N/A'
            }
          </dd>
        </div>
        {employee.baseSalary && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Base Salary</dt>
            <dd className="text-sm text-gray-900">
              {employee.currency || 'USD'} {employee.baseSalary}
            </dd>
          </div>
        )}
        {employee.probationEndDate && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Probation End Date</dt>
            <dd className="text-sm text-gray-900">
              {format(new Date(employee.probationEndDate), 'MMM dd, yyyy')}
            </dd>
          </div>
        )}
        {employee.terminationDate && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Termination Date</dt>
            <dd className="text-sm text-gray-900">
              {format(new Date(employee.terminationDate), 'MMM dd, yyyy')}
              {employee.terminationReason && (
                <div className="text-xs text-gray-500 mt-1">
                  Reason: {employee.terminationReason}
                </div>
              )}
            </dd>
          </div>
        )}
        {employee.skills && employee.skills.length > 0 && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Skills</dt>
            <dd className="text-sm text-gray-900">
              <div className="flex flex-wrap gap-2 mt-1">
                {employee.skills.map((skill, index) => (
                  <Badge key={index} variant="primary" size="sm">
                    {skill}
                  </Badge>
                ))}
              </div>
            </dd>
          </div>
        )}
        {employee.qualifications && employee.qualifications.length > 0 && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Qualifications</dt>
            <dd className="text-sm text-gray-900">
              <div className="flex flex-wrap gap-2 mt-1">
                {employee.qualifications.map((qualification, index) => (
                  <Badge key={index} variant="info" size="sm">
                    {qualification}
                  </Badge>
                ))}
              </div>
            </dd>
          </div>
        )}
        {employee.bio && (
          <div>
            <dt className="text-sm font-medium text-gray-500">Bio</dt>
            <dd className="text-sm text-gray-900">{employee.bio}</dd>
          </div>
        )}
      </dl>
    </div>
  ), [employee]);

  // Render tab content
  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {renderPersonalInfo()}
            {renderEmploymentInfo()}
          </div>
        );
      case 'attendance':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Recent Attendance</h3>
            {employee.attendanceRecords && employee.attendanceRecords.length > 0 ? (
              <div className="space-y-2">
                {employee.attendanceRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {format(new Date(record.date), 'MMM dd, yyyy')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {record.checkIn && `In: ${format(new Date(record.checkIn), 'HH:mm')}`}
                        {record.checkOut && ` | Out: ${format(new Date(record.checkOut), 'HH:mm')}`}
                        {record.hoursWorked && ` | ${record.hoursWorked}h worked`}
                      </div>
                    </div>
                    <Badge variant={record.status === 'PRESENT' ? 'success' : 'warning'}>
                      {record.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No attendance records found</p>
            )}
          </div>
        );
      case 'leave':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Leave History</h3>
            {employee.leaveRequests && employee.leaveRequests.length > 0 ? (
              <div className="space-y-2">
                {employee.leaveRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {request.policy?.name} ({request.days} days)
                      </div>
                      <div className="text-xs text-gray-500">
                        {format(new Date(request.startDate), 'MMM dd')} - {format(new Date(request.endDate), 'MMM dd, yyyy')}
                      </div>
                    </div>
                    <Badge variant={request.status === 'APPROVED' ? 'success' : request.status === 'REJECTED' ? 'error' : 'warning'}>
                      {request.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No leave requests found</p>
            )}
          </div>
        );
      case 'documents':
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Employee documents will be displayed here</p>
          </div>
        );
      case 'performance':
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Performance reviews will be displayed here</p>
          </div>
        );
      default:
        return null;
    }
  }, [activeTab, employee, renderPersonalInfo, renderEmploymentInfo]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Error state
  if (error || !employee) {
    return (
      <div className="text-center py-12">
        <Alert variant="error" title="Error">
          {error?.message || 'Employee not found'}
        </Alert>
        <Link to="/employees" className="btn-primary mt-4">
          Back to Employees
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link 
            to="/employees" 
            className="btn-outline hover:shadow-md transition-all duration-200"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Back
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {employee.firstName} {employee.lastName}
            </h1>
            <p className="text-sm text-gray-500">Employee ID: {employee.employeeId}</p>
          </div>
        </div>
        {hasPermission(['ADMIN', 'HR']) && (
          <div className="flex space-x-3">
            <Link
              to={`/employees/${id}/edit`}
              className="btn-outline hover:shadow-md transition-all duration-200"
            >
              <PencilIcon className="h-5 w-5 mr-2" />
              Edit Employee
            </Link>
            {employee.employmentStatus !== 'TERMINATED' && (
              <button
                onClick={handleDeleteClick}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
              >
                <TrashIcon className="h-5 w-5 mr-2" />
                Terminate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Employee Profile Card */}
      <div className="card hover:shadow-md transition-shadow duration-200">
        <div className="card-content">
          <div className="flex items-start space-x-6">
            <div className="flex-shrink-0">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg">
                <span className="text-2xl font-medium text-white">
                  {employee.firstName[0]}{employee.lastName[0]}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-900">
                      <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
                      <a href={`mailto:${employee.email}`} className="hover:text-indigo-600 transition-colors">
                        {employee.email}
                      </a>
                    </div>
                    {employee.phone && (
                      <div className="flex items-center text-sm text-gray-900">
                        <PhoneIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <a href={`tel:${employee.phone}`} className="hover:text-indigo-600 transition-colors">
                          {employee.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Employment Details</h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-900">
                      <BuildingOfficeIcon className="h-4 w-4 mr-2 text-gray-400" />
                      {employee.department?.name || 'N/A'}
                    </div>
                    <div className="flex items-center text-sm text-gray-900">
                      <UserIcon className="h-4 w-4 mr-2 text-gray-400" />
                      {employee.position?.title || 'N/A'}
                    </div>
                    <div className="flex items-center text-sm text-gray-900">
                      <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                      Hired {format(new Date(employee.hireDate), 'MMM dd, yyyy')}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Status & Type</h3>
                  <div className="space-y-2">
                    <div>{getStatusBadge(employee.employmentStatus)}</div>
                    <div>{getEmploymentTypeBadge(employee.employmentType)}</div>
                    {employee.manager && (
                      <div className="text-sm text-gray-900">
                        Reports to: {employee.manager.firstName} {employee.manager.lastName}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subordinates Section (for managers) */}
      {employee.subordinates && employee.subordinates.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
          </div>
          <div className="card-content">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {employee.subordinates.map((subordinate) => (
                <Link
                  key={subordinate.id}
                  to={`/employees/${subordinate.id}`}
                  className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                    <span className="text-xs font-medium text-indigo-800">
                      {subordinate.firstName[0]}{subordinate.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {subordinate.firstName} {subordinate.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                      {subordinate.position?.title || 'N/A'}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="card-content">
          {renderTabContent()}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={handleDeleteCancel}
        title="Terminate Employee"
        size="md"
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Terminate {employee.firstName} {employee.lastName}?
              </h3>
              <p className="text-sm text-gray-500">
                This action will set the employee's status to terminated and deactivate their user account. 
                This action can be reversed by updating the employee's status.
              </p>
            </div>
          </div>
          
          <Alert variant="warning">
            <strong>Warning:</strong> Make sure to reassign any subordinates before terminating this employee.
          </Alert>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleDeleteCancel}
              className="btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
              {deleteMutation.isLoading && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              Terminate Employee
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeeDetail;