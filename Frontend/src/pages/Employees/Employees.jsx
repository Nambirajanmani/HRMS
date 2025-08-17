import { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { PlusIcon, MagnifyingGlassIcon, FunnelIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { employeeAPI } from '../../services/api';
import Table from '../../components/UI/Table';
import Badge from '../../components/UI/Badge';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import EmptyState from '../../components/UI/EmptyState';
import Pagination from '../../components/UI/Pagination';
import { useAuth } from '../../contexts/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { format } from 'date-fns';
import { cn } from '../../utils/cn';

const Employees = () => {
  // State management using hooks
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    departmentId: '',
    employmentStatus: '',
    employmentType: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  const { hasPermission } = useAuth();
  const debouncedSearch = useDebounce(search, 300);

  // Reset page when search or filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  // Build query parameters, excluding empty values
  const buildQueryParams = useCallback(() => {
    const params = {
      page,
      limit: 10
    };

    // Only add non-empty search
    if (debouncedSearch.trim()) {
      params.search = debouncedSearch.trim();
    }

    // Only add non-empty filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim()) {
        params[key] = value;
      }
    });

    return params;
  }, [page, debouncedSearch, filters]);

  // Fetch employees data
  const { data, isLoading, error, refetch } = useQuery(
    ['employees', page, debouncedSearch, filters],
    () => employeeAPI.getAll(buildQueryParams()),
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors, but retry on 5xx errors up to 3 times
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      onError: (error) => {
        console.error('Failed to fetch employees:', error);
      }
    }
  );

  // Memoized data extraction with null safety
  const employees = data?.data?.employees || [];
  const pagination = data?.data?.pagination || null;

  // Event handlers using useCallback for optimization
  const handleSearchChange = useCallback((e) => {
    setSearch(e.target.value);
  }, []);

  const handleFilterChange = useCallback((filterKey, value) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setFilters({
      departmentId: '',
      employmentStatus: '',
      employmentType: ''
    });
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Badge rendering functions
  const getStatusBadge = useCallback((status) => {
    if (!status) return <Badge variant="default">Unknown</Badge>;
    
    const variants = {
      ACTIVE: 'success',
      INACTIVE: 'warning',
      TERMINATED: 'error',
      ON_LEAVE: 'info',
      PROBATION: 'warning'
    };
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  }, []);

  const getEmploymentTypeBadge = useCallback((type) => {
    if (!type) return <Badge variant="default">Unknown</Badge>;
    
    const variants = {
      FULL_TIME: 'primary',
      PART_TIME: 'info',
      CONTRACT: 'warning',
      INTERN: 'default',
      CONSULTANT: 'default'
    };
    return (
      <Badge variant={variants[type] || 'default'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  }, []);

  // Render employee avatar
  const renderEmployeeAvatar = useCallback((employee) => {
    const initials = `${employee.firstName?.[0] || ''}${employee.lastName?.[0] || ''}`.toUpperCase();
    
    return (
      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-sm">
        <span className="text-sm font-medium text-indigo-800">
          {initials || '??'}
        </span>
      </div>
    );
  }, []);

  // Format date safely
  const formatDate = useCallback((dateString) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (error) {
      return 'Invalid Date';
    }
  }, []);

  // Render filter controls
  const renderFilters = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200">
      <div className="p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {/* Search Input */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search employees..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150"
              value={search}
              onChange={handleSearchChange}
            />
          </div>

          {/* Toggle Filters Button (Mobile) */}
          <button
            onClick={toggleFilters}
            className="sm:hidden inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <FunnelIcon className="h-5 w-5 mr-2" />
            Filters
          </button>

          {/* Status Filter (Desktop) */}
          <div className="hidden sm:block">
            <select
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md transition duration-150 bg-white"
              value={filters.employmentStatus}
              onChange={(e) => handleFilterChange('employmentStatus', e.target.value)}
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="TERMINATED">Terminated</option>
              <option value="ON_LEAVE">On Leave</option>
              <option value="PROBATION">Probation</option>
            </select>
          </div>

          {/* Type Filter (Desktop) */}
          <div className="hidden sm:block">
            <select
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md transition duration-150 bg-white"
              value={filters.employmentType}
              onChange={(e) => handleFilterChange('employmentType', e.target.value)}
            >
              <option value="">All Types</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERN">Intern</option>
              <option value="CONSULTANT">Consultant</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <button
            onClick={handleClearFilters}
            className="hidden sm:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
          >
            Clear Filters
          </button>
        </div>

        {/* Mobile Filters Panel */}
        {showFilters && (
          <div className="mt-4 sm:hidden space-y-4 animate-slideUp bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Filters</h3>
              <button 
                onClick={toggleFilters}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white"
                value={filters.employmentStatus}
                onChange={(e) => handleFilterChange('employmentStatus', e.target.value)}
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="TERMINATED">Terminated</option>
                <option value="ON_LEAVE">On Leave</option>
                <option value="PROBATION">Probation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white"
                value={filters.employmentType}
                onChange={(e) => handleFilterChange('employmentType', e.target.value)}
              >
                <option value="">All Types</option>
                <option value="FULL_TIME">Full Time</option>
                <option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
                <option value="CONSULTANT">Consultant</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleClearFilters}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={toggleFilters}
                className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Render employees table
  const renderEmployeesTable = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="overflow-x-auto">
        <Table>
          <Table.Header>
            <Table.Row className="bg-gradient-to-r from-indigo-50 to-blue-50">
              <Table.Head className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                Employee
              </Table.Head>
              <Table.Head className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                Department
              </Table.Head>
              <Table.Head className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                Position
              </Table.Head>
              <Table.Head className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                Type
              </Table.Head>
              <Table.Head className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                Status
              </Table.Head>
              <Table.Head className="px-6 py-3 text-left text-xs font-medium text-indigo-800 uppercase tracking-wider">
                Hire Date
              </Table.Head>
              <Table.Head className="px-6 py-3 text-right text-xs font-medium text-indigo-800 uppercase tracking-wider">
                Actions
              </Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <Table.Row key={employee.id} className="hover:bg-indigo-50/50 transition-colors duration-150">
                <Table.Cell className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      {renderEmployeeAvatar(employee)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                        {employee.firstName} {employee.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{employee.email || 'No email'}</div>
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {employee.department?.name || 'N/A'}
                  </div>
                </Table.Cell>
                <Table.Cell className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {employee.position?.title || 'N/A'}
                  </div>
                </Table.Cell>
                <Table.Cell className="px-6 py-4 whitespace-nowrap">
                  {getEmploymentTypeBadge(employee.employmentType)}
                </Table.Cell>
                <Table.Cell className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(employee.employmentStatus)}
                </Table.Cell>
                <Table.Cell className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {employee.hireDate ? formatDate(employee.hireDate) : 'N/A'}
                  </div>
                </Table.Cell>
                <Table.Cell className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <Link
                    to={`/employees/${employee.id}`}
                    className="text-indigo-600 hover:text-indigo-900 transition-colors font-medium group flex items-center justify-end"
                  >
                    View
                    <svg className="ml-1 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-md">
      <EmptyState
        icon={() => (
          <div className="mx-auto h-24 w-24 flex items-center justify-center rounded-full bg-indigo-100">
            <svg className="h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        )}
        title="No employees found"
        description="Try adjusting your search or filter criteria"
        action={
          hasPermission && hasPermission(['ADMIN', 'HR']) && (
            <Link
              to="/employees/create"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150 transform hover:-translate-y-0.5 hover:shadow-md"
            >
              <PlusIcon className="h-5 w-5 mr-2 -ml-1" />
              Add New Employee
            </Link>
          )
        }
      />
    </div>
  );

  // Loading state
  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <LoadingSpinner size="lg" className="text-indigo-600" />
          <p className="mt-4 text-lg font-medium text-gray-700">Loading employee directory...</p>
          <p className="mt-1 text-sm text-gray-500">This may take a moment</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100 mb-4">
          <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load employees</h3>
        <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
          {error?.response?.data?.message || error?.message || 'An unexpected error occurred while fetching employee data.'}
        </p>
        <button 
          onClick={handleRetry} 
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-150"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Directory</h1>
          <p className="mt-1 text-sm text-gray-600">
            {pagination?.total || 0} {pagination?.total === 1 ? 'employee' : 'employees'} in your organization
          </p>
        </div>
        {hasPermission && hasPermission(['ADMIN', 'HR']) && (
          <Link 
            to="/employees/create" 
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-gradient-to-br from-indigo-600 to-indigo-500 hover:from-indigo-700 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-150 transform hover:-translate-y-0.5 hover:shadow-md"
          >
            <PlusIcon className="h-5 w-5 mr-2 -ml-1" />
            Add Employee
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      {renderFilters()}

      {/* Employees Table or Empty State */}
      {employees.length === 0 ? renderEmptyState() : renderEmployeesTable()}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-b-lg shadow-sm">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.pages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={setPage}
            showInfo={true}
            className="text-indigo-600 hover:text-indigo-900"
            activeClassName="bg-indigo-600 text-white"
          />
        </div>
      )}

      {/* Loading overlay for subsequent requests */}
      {isLoading && data && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-sm w-full animate-pulse">
            <div className="flex items-center justify-center space-x-3">
              <LoadingSpinner size="md" className="text-indigo-600" />
              <span className="text-sm font-medium text-gray-700">Updating employee list...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;