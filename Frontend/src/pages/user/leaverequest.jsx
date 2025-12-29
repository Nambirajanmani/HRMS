import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDaysIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

import { leaveAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import Alert from '../../components/UI/Alert';
import { cn } from '../../utils/cn';
import toast from 'react-hot-toast';

const EmployeeLeaveRequest = () => {
  const [selectedLeaveType, setSelectedLeaveType] = useState('');
  const { user } = useAuth();

  const { register, handleSubmit, watch, formState: { errors }, reset } = useForm({
    defaultValues: {
      leaveType: '',
      startDate: '',
      endDate: '',
      reason: '',
      emergencyContact: '',
      handoverNotes: ''
    }
  });

  // Watch form values
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  // Calculate number of days
  const calculateDays = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays;
    }
    return 0;
  };

  // Fetch employee's leave balance
  const { data: leaveBalanceData, isLoading: balanceLoading } = useQuery(
    'leave-balance',
    () => leaveAPI.getMyLeaveBalance(),
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  // Fetch employee's leave history
  const { data: leaveHistoryData, isLoading: historyLoading } = useQuery(
    'leave-history',
    () => leaveAPI.getMyLeaveHistory(),
    {
      staleTime: 5 * 60 * 1000,
    }
  );

  // Fetch leave policies
  const { data: policiesData, isLoading: policiesLoading } = useQuery(
    'leave-policies',
    () => leaveAPI.getPolicies(),
    {
      staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    }
  );

  // Submit leave request mutation
  const submitLeaveMutation = useMutation(
    (data) => leaveAPI.createRequest(data),
    {
      onSuccess: () => {
        toast.success('Leave request submitted successfully!');
        reset();
        setSelectedLeaveType('');
      },
      onError: (error) => {
        const message = error.response?.data?.message || 'Failed to submit leave request';
        toast.error(message);
      }
    }
  );

  const onSubmit = async (data) => {
    if (!user?.employee?.id) {
      toast.error('Employee information not found. Please log in again.');
      return;
    }

    // Find the policy that matches the selected leave type
    const policies = policiesData?.data || [];
    const selectedPolicy = policies.find(policy => policy.leaveType === data.leaveType);

    if (!selectedPolicy) {
      toast.error('Selected leave type is not available. Please select a different type.');
      return;
    }

    const leaveData = {
      employeeId: user.employee.id,
      policyId: selectedPolicy.id,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      attachments: [] // TODO: Implement file upload
    };

    await submitLeaveMutation.mutateAsync(leaveData);
  };

  const leaveBalance = leaveBalanceData?.data || {};
  const leaveHistory = leaveHistoryData?.data?.requests || [];

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'APPROVED':
        return <CheckCircleIcon className="h-5 w-5 text-green-600" />;
      case 'REJECTED':
        return <XCircleIcon className="h-5 w-5 text-red-600" />;
      case 'PENDING':
        return <ClockIcon className="h-5 w-5 text-yellow-600" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    
      <div className="space-y-6">
        {/* Header */}
        {/* <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              to="/user/dashboard"
              className="btn-outline hover:shadow-md transition-all duration-200"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Apply for Leave</h1>
              <p className="text-sm text-gray-500">Submit a new leave request</p>
            </div>
          </div>
        </div> */}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Leave Balance and History */}
          <div className="lg:col-span-1 space-y-6">
            {/* Leave Balance Card */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Leave Balance</h3>
              {balanceLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <div className="space-y-3">
                  {Object.entries(leaveBalance).map(([type, balance]) => (
                    <div key={type} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <span className="text-sm font-medium text-gray-600 capitalize">
                        {type.replace('_', ' ').toLowerCase()}
                      </span>
                      <span className="text-lg font-bold text-indigo-600">
                        {balance} days
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Leave History */}
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Requests</h3>
              {historyLoading ? (
                <LoadingSpinner size="sm" />
              ) : leaveHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No leave requests yet</p>
              ) : (
                <div className="space-y-3">
                  {leaveHistory.slice(0, 5).map((request) => (
                    <div key={request.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {request.leaveType.replace('_', ' ').toLowerCase()}
                        </span>
                        <div className={cn("flex items-center space-x-1 px-2 py-1 rounded-full text-xs", getStatusColor(request.status))}>
                          {getStatusIcon(request.status)}
                          <span className="capitalize">{request.status.toLowerCase()}</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {request.numberOfDays} day(s)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Leave Application Form */}
          <div className="lg:col-span-2">
            <div className="bg-white shadow-sm rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Leave Application Form</h3>
                <p className="text-sm text-gray-500">Fill in the details below to apply for leave</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                {/* Leave Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Leave Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('leaveType', { required: 'Leave type is required' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    onChange={(e) => setSelectedLeaveType(e.target.value)}
                    disabled={policiesLoading}
                  >
                    <option value="">
                      {policiesLoading ? 'Loading leave types...' : 'Select Leave Type'}
                    </option>
                    {Array.isArray(policiesData?.data?.policies) ? (
                      policiesData.data.policies.map((policy) => (
                        <option key={policy.id} value={policy.leaveType}>
                          {policy.name} ({policy.leaveType.replace('_', ' ')})
                        </option>
                      ))
                    ) : Array.isArray(policiesData?.data) ? (
                      policiesData.data.map((policy) => (
                        <option key={policy.id} value={policy.leaveType}>
                          {policy.name} ({policy.leaveType.replace('_', ' ')})
                        </option>
                      ))
                    ) : null}
                  </select>
                  {errors.leaveType && (
                    <p className="mt-1 text-sm text-red-600">{errors.leaveType.message}</p>
                  )}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      {...register('startDate', { required: 'Start date is required' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      min={new Date().toISOString().split('T')[0]}
                    />
                    {errors.startDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      {...register('endDate', { 
                        required: 'End date is required',
                        validate: value => {
                          if (startDate && value < startDate) {
                            return 'End date cannot be before start date';
                          }
                          return true;
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      min={startDate || new Date().toISOString().split('T')[0]}
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                    )}
                  </div>
                </div>

                {/* Duration Display */}
                {startDate && endDate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-800">Total Duration:</span>
                      <span className="text-lg font-bold text-blue-800">
                        {calculateDays()} day(s)
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      From {new Date(startDate).toLocaleDateString()} to {new Date(endDate).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Leave <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    {...register('reason', { 
                      required: 'Reason is required',
                      minLength: { value: 10, message: 'Reason must be at least 10 characters' }
                    })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Please provide a detailed reason for your leave request..."
                  />
                  {errors.reason && (
                    <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
                  )}
                </div>

                {/* Emergency Contact */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact
                  </label>
                  <input
                    type="text"
                    {...register('emergencyContact')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Emergency contact number during your leave"
                  />
                </div>

                {/* Handover Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Handover Notes
                  </label>
                  <textarea
                    {...register('handoverNotes')}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Any important notes for the person covering your responsibilities..."
                  />
                </div>

                {/* Supporting Documents - Optional */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Supporting Documents (Optional)
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-4 text-center">
                    <DocumentTextIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">
                      Drag and drop files here, or click to browse
                    </p>
                    <input
                      type="file"
                      className="hidden"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                    <button
                      type="button"
                      className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      Browse files
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Supported formats: PDF, DOC, DOCX, JPG, PNG (Max 5MB per file)
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="btn-outline"
                  >
                    Reset Form
                  </button>
                  <button
                    type="submit"
                    disabled={submitLeaveMutation.isLoading}
                    className="btn-primary flex items-center"
                  >
                    {submitLeaveMutation.isLoading ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <CalendarDaysIcon className="h-5 w-5 mr-2" />
                        Submit Leave Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
   
  );
};

export default EmployeeLeaveRequest;