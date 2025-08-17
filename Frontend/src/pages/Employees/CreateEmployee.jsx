import { useState, useCallback, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from 'react-query';
import { ArrowLeftIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { employeeAPI, departmentAPI, positionAPI } from '../../services/api';
import LoadingSpinner from '../../components/UI/LoadingSpinner';
import Alert from '../../components/UI/Alert';
import FormField from '../../components/Forms/FormField';
import { EMPLOYMENT_TYPES, EMPLOYMENT_STATUS, GENDER_OPTIONS, MARITAL_STATUS } from '../../utils/constants';
import { cn } from '../../utils/cn';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const CreateEmployee = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
    getValues,
    setValue,
    reset
  } = useForm({
    defaultValues: {
      employeeId: '',
      firstName: '',
      lastName: '',
      email: '',
      hireDate: '',
      employmentType: 'FULL_TIME',
      employmentStatus: 'ACTIVE',
      middleName: '',
      phone: '',
      dateOfBirth: '',
      gender: '',
      maritalStatus: '',
      nationality: '',
      address: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      departmentId: '',
      positionId: '',
      managerId: '',
      baseSalary: ''
    }
  });

  // Fetch data for dropdowns
  const { data: departmentsData, isLoading: departmentsLoading } = useQuery(
    'departments',
    () => departmentAPI.getAll({ limit: 100, isActive: true }),
    { staleTime: 10 * 60 * 1000 }
  );

  const { data: positionsData, isLoading: positionsLoading } = useQuery(
    'positions',
    () => positionAPI.getAll({ limit: 100, isActive: true }),
    { staleTime: 10 * 60 * 1000 }
  );

  const { data: managersData, isLoading: managersLoading } = useQuery(
    'potential-managers',
    () => employeeAPI.getAll({ limit: 200, employmentStatus: 'ACTIVE' }),
    { staleTime: 5 * 60 * 1000 }
  );

  // Create employee mutation with proper error handling
  const createEmployeeMutation = useMutation(
    (data) => employeeAPI.create(data),
    {
      onSuccess: (data) => {
        toast.success('Employee created successfully!');
        reset(); // Reset form after successful submission
        navigate(`/employees/${data.id}`);
      },
      onError: (error) => {
        console.error('Create employee error:', {
          message: error.message,
          response: error.response?.data,
          stack: error.stack
        });
        
        let errorMessage = 'Failed to create employee';
        if (error.response?.data?.errors) {
          errorMessage = error.response.data.errors
            .map(err => `${err.field}: ${err.message}`)
            .join(', ');
        } else if (error.response?.data?.message) {
          errorMessage = error.response.data.message;
        }
        
        toast.error(errorMessage);
        setIsSubmitting(false);
      }
    }
  );

  // Memoized options with better error handling and data validation
  const departments = useMemo(() => {
    const depts = departmentsData?.data?.departments || [];
    console.log('Departments data:', depts);
    return depts;
  }, [departmentsData]);

  const positions = useMemo(() => {
    const pos = positionsData?.data?.positions || [];
    console.log('Positions data:', pos);
    return pos;
  }, [positionsData]);

  const managers = useMemo(() => {
    const mgrs = managersData?.data?.employees || [];
    console.log('Managers data:', mgrs);
    // Filter out any managers that don't have a valid UUID id
    return mgrs.filter(manager => 
      manager && 
      manager.id && 
      typeof manager.id === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(manager.id)
    );
  }, [managersData]);

  const employmentTypeOptions = useMemo(() => 
    Object.entries(EMPLOYMENT_TYPES).map(([key, value]) => ({
      value,
      label: key.replace('_', ' ')
    })), []);

  const employmentStatusOptions = useMemo(() => 
    Object.entries(EMPLOYMENT_STATUS).map(([key, value]) => ({
      value,
      label: key.replace('_', ' ')
    })), []);

  const genderOptions = useMemo(() => 
    Object.entries(GENDER_OPTIONS).map(([key, value]) => ({
      value,
      label: key
    })), []);

  const maritalStatusOptions = useMemo(() => 
    Object.entries(MARITAL_STATUS).map(([key, value]) => ({
      value,
      label: key
    })), []);

  // Form steps configuration
  const steps = useMemo(() => [
    {
      id: 1,
      title: 'Basic Information',
      description: 'Personal details and contact information',
      fields: ['employeeId', 'firstName', 'lastName', 'email', 'phone']
    },
    {
      id: 2,
      title: 'Personal Details',
      description: 'Additional personal information',
      fields: ['middleName', 'dateOfBirth', 'gender', 'maritalStatus', 'nationality']
    },
    {
      id: 3,
      title: 'Employment Information',
      description: 'Job details and organizational structure',
      fields: ['departmentId', 'positionId', 'managerId', 'employmentType', 'hireDate', 'baseSalary']
    },
    {
      id: 4,
      title: 'Address & Emergency Contact',
      description: 'Address and emergency contact details',
      fields: ['address', 'city', 'state', 'country', 'zipCode', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation']
    }
  ], []);

  // Navigation handlers
  const handleNextStep = useCallback(async () => {
    const currentStepFields = steps[currentStep - 1].fields;
    const isValid = await trigger(currentStepFields);
    if (isValid) setCurrentStep(prev => Math.min(prev + 1, steps.length));
  }, [currentStep, steps, trigger]);

  const handlePrevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  // Form submission handler
  const onSubmit = useCallback(async (data) => {
    setIsSubmitting(true);
    try {
      // Clean and format data according to API requirements
      const formattedData = {
        employeeId: data.employeeId?.trim(),
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        email: data.email?.trim(),
        hireDate: data.hireDate, // Keep as string, backend will parse
        employmentType: data.employmentType,
        employmentStatus: data.employmentStatus,
      };

      // Add optional fields only if they have meaningful values
      if (data.middleName?.trim()) {
        formattedData.middleName = data.middleName.trim();
      }
      
      if (data.phone?.trim()) {
        formattedData.phone = data.phone.trim();
      }
      
      if (data.dateOfBirth?.trim()) {
        formattedData.dateOfBirth = data.dateOfBirth;
      }
      
      if (data.gender?.trim()) {
        formattedData.gender = data.gender;
      }
      
      if (data.maritalStatus?.trim()) {
        formattedData.maritalStatus = data.maritalStatus;
      }
      
      if (data.nationality?.trim()) {
        formattedData.nationality = data.nationality.trim();
      }
      
      if (data.address?.trim()) {
        formattedData.address = data.address.trim();
      }
      
      if (data.city?.trim()) {
        formattedData.city = data.city.trim();
      }
      
      if (data.state?.trim()) {
        formattedData.state = data.state.trim();
      }
      
      if (data.country?.trim()) {
        formattedData.country = data.country.trim();
      }
      
      if (data.zipCode?.trim()) {
        formattedData.zipCode = data.zipCode.trim();
      }
      
      if (data.emergencyContactName?.trim()) {
        formattedData.emergencyContactName = data.emergencyContactName.trim();
      }
      
      if (data.emergencyContactPhone?.trim()) {
        formattedData.emergencyContactPhone = data.emergencyContactPhone.trim();
      }
      
      if (data.emergencyContactRelation?.trim()) {
        formattedData.emergencyContactRelation = data.emergencyContactRelation.trim();
      }
      
      // Handle UUID fields with validation
      if (data.departmentId && data.departmentId.trim() && data.departmentId !== '') {
        formattedData.departmentId = data.departmentId.trim();
      }
      
      if (data.positionId && data.positionId.trim() && data.positionId !== '') {
        formattedData.positionId = data.positionId.trim();
      }
      
      if (data.managerId && data.managerId.trim() && data.managerId !== '') {
        const managerIdTrimmed = data.managerId.trim();
        // Validate that the managerId is a valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(managerIdTrimmed)) {
          formattedData.managerId = managerIdTrimmed;
        } else {
          console.error('Invalid manager ID format:', managerIdTrimmed);
          toast.error('Invalid manager selection. Please select a valid manager.');
          setIsSubmitting(false);
          return;
        }
      }
      
      if (data.baseSalary && !isNaN(parseFloat(data.baseSalary))) {
        formattedData.baseSalary = parseFloat(data.baseSalary);
      }

      console.log('Submitting employee data:', formattedData);
      await createEmployeeMutation.mutateAsync(formattedData);
    } catch (error) {
      console.error('Submit error:', error);
      // Error handling is done in mutation
    }
  }, [createEmployeeMutation]);

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="mb-8">
      <nav aria-label="Progress">
        <ol className="flex items-center">
          {steps.map((step, stepIdx) => (
            <li key={step.id} className={cn(
              stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : '',
              'relative'
            )}>
              {stepIdx !== steps.length - 1 && (
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={cn(
                    'h-0.5 w-full',
                    currentStep > step.id ? 'bg-indigo-600' : 'bg-gray-200'
                  )} />
                </div>
              )}
              <div className={cn(
                'relative w-8 h-8 flex items-center justify-center rounded-full border-2',
                currentStep > step.id
                  ? 'bg-indigo-600 border-indigo-600'
                  : currentStep === step.id
                  ? 'border-indigo-600 bg-white'
                  : 'border-gray-300 bg-white'
              )}>
                <span className={cn(
                  'text-sm font-medium',
                  currentStep > step.id
                    ? 'text-white'
                    : currentStep === step.id
                    ? 'text-indigo-600'
                    : 'text-gray-500'
                )}>
                  {step.id}
                </span>
              </div>
              <div className="mt-2">
                <div className={cn(
                  'text-sm font-medium',
                  currentStep >= step.id ? 'text-indigo-600' : 'text-gray-500'
                )}>
                  {step.title}
                </div>
                <div className="text-xs text-gray-500">{step.description}</div>
              </div>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );

  // Render form step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                name="employeeId"
                control={control}
                label="Employee ID"
                placeholder="EMP001"
                required
                rules={{ 
                  required: 'Employee ID is required',
                  minLength: { value: 1, message: 'Employee ID is required' },
                  maxLength: { value: 50, message: 'Employee ID too long' }
                }}
              />
              <FormField
                name="email"
                control={control}
                type="email"
                label="Email Address"
                placeholder="john.doe@company.com"
                required
                rules={{
                  required: 'Email is required',
                  pattern: {
                    value: /^\S+@\S+\.\S+$/i,
                    message: 'Invalid email address format',
                  },
                }}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <FormField
                name="firstName"
                control={control}
                label="First Name"
                placeholder="John"
                required
                rules={{ 
                  required: 'First name is required',
                  maxLength: { value: 50, message: 'First name too long' }
                }}
              />
              <FormField
                name="middleName"
                control={control}
                label="Middle Name"
                placeholder="Optional"
                rules={{
                  maxLength: { value: 50, message: 'Middle name too long' }
                }}
              />
              <FormField
                name="lastName"
                control={control}
                label="Last Name"
                placeholder="Doe"
                required
                rules={{ 
                  required: 'Last name is required',
                  maxLength: { value: 50, message: 'Last name too long' }
                }}
              />
            </div>
            <FormField
              name="phone"
              control={control}
              type="tel"
              label="Phone Number"
              placeholder="+1 (555) 123-4567"
              rules={{
                pattern: {
                  value: /^\+?[\d\s\-\(\)]+$/,
                  message: 'Invalid phone number format'
                }
              }}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                name="dateOfBirth"
                control={control}
                type="date"
                label="Date of Birth"
              />
              <FormField
                name="gender"
                control={control}
                type="select"
                label="Gender"
                placeholder="Select Gender"
                options={genderOptions}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                name="maritalStatus"
                control={control}
                type="select"
                label="Marital Status"
                placeholder="Select Status"
                options={maritalStatusOptions}
              />
              <FormField
                name="nationality"
                control={control}
                label="Nationality"
                placeholder="American"
                rules={{
                  maxLength: { value: 50, message: 'Nationality too long' }
                }}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                name="departmentId"
                control={control}
                type="select"
                label="Department"
                placeholder="Select Department"
                options={departments.map(dept => ({
                  value: dept.id,
                  label: dept.name
                }))}
                disabled={departmentsLoading}
              />
              <FormField
                name="positionId"
                control={control}
                type="select"
                label="Position"
                placeholder="Select Position"
                options={positions.map(pos => ({
                  value: pos.id,
                  label: pos.title
                }))}
                disabled={positionsLoading}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                name="managerId"
                control={control}
                type="select"
                label="Manager"
                placeholder="Select Manager"
                options={managers.map(manager => {
                  console.log('Manager mapping:', { id: manager.id, firstName: manager.firstName, lastName: manager.lastName, employeeId: manager.employeeId });
                  return {
                    value: manager.id, // This should be the UUID
                    label: `${manager.firstName} ${manager.lastName} (${manager.employeeId})`
                  };
                })}
                disabled={managersLoading}
              />
              <FormField
                name="employmentType"
                control={control}
                type="select"
                label="Employment Type"
                required
                options={employmentTypeOptions}
                rules={{ required: 'Employment type is required' }}
              />
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <FormField
                name="hireDate"
                control={control}
                type="date"
                label="Hire Date"
                required
                rules={{ required: 'Hire date is required' }}
              />
              <FormField
                name="baseSalary"
                control={control}
                type="number"
                label="Base Salary"
                placeholder="50000.00"
                step="0.01"
                min="0"
                rules={{
                  min: { value: 0, message: 'Salary must be positive' }
                }}
              />
            </div>
            <FormField
              name="employmentStatus"
              control={control}
              type="select"
              label="Employment Status"
              options={employmentStatusOptions}
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Address Information</h3>
              <div className="space-y-4">
                <FormField
                  name="address"
                  control={control}
                  type="textarea"
                  label="Street Address"
                  placeholder="123 Main Street, Apt 4B"
                  rows={2}
                  rules={{
                    maxLength: { value: 500, message: 'Address too long' }
                  }}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    name="city"
                    control={control}
                    label="City"
                    placeholder="New York"
                    rules={{
                      maxLength: { value: 100, message: 'City too long' }
                    }}
                  />
                  <FormField
                    name="state"
                    control={control}
                    label="State/Province"
                    placeholder="NY"
                    rules={{
                      maxLength: { value: 100, message: 'State too long' }
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    name="country"
                    control={control}
                    label="Country"
                    placeholder="United States"
                    rules={{
                      maxLength: { value: 100, message: 'Country too long' }
                    }}
                  />
                  <FormField
                    name="zipCode"
                    control={control}
                    label="ZIP/Postal Code"
                    placeholder="10001"
                    rules={{
                      maxLength: { value: 20, message: 'ZIP code too long' }
                    }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Emergency Contact</h3>
              <div className="space-y-4">
                <FormField
                  name="emergencyContactName"
                  control={control}
                  label="Contact Name"
                  placeholder="Jane Doe"
                  rules={{
                    maxLength: { value: 100, message: 'Contact name too long' }
                  }}
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    name="emergencyContactPhone"
                    control={control}
                    type="tel"
                    label="Contact Phone"
                    placeholder="+1 (555) 987-6543"
                    rules={{
                      pattern: {
                        value: /^\+?[\d\s\-\(\)]+$/,
                        message: 'Invalid phone format'
                      }
                    }}
                  />
                  <FormField
                    name="emergencyContactRelation"
                    control={control}
                    label="Relationship"
                    placeholder="Spouse, Parent, Sibling, etc."
                    rules={{
                      maxLength: { value: 50, message: 'Relation too long' }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Render navigation buttons
  const renderNavigationButtons = () => (
    <div className="flex justify-between pt-6 border-t border-gray-200">
      <div>
        {currentStep > 1 && (
          <button
            type="button"
            onClick={handlePrevStep}
            className="btn-outline"
          >
            Previous
          </button>
        )}
      </div>
      <div className="flex space-x-3">
        <Link to="/employees" className="btn-outline">
          Cancel
        </Link>
        {currentStep < steps.length ? (
          <button
            type="button"
            onClick={handleNextStep}
            className="btn-primary"
          >
            Next
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex items-center"
          >
            {isSubmitting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Creating...
              </>
            ) : (
              <>
                <UserPlusIcon className="h-5 w-5 mr-2" />
                Create Employee
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );

  // Add debug information to help troubleshoot
  console.log('Current form values:', getValues());
  console.log('Available managers:', managers);
  console.log('Form errors:', errors);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link 
          to="/employees" 
          className="btn-outline hover:shadow-md transition-all duration-200"
        >
          <ArrowLeftIcon className="h-5 w-5 mr-2" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Employee</h1>
          <p className="text-sm text-gray-500">Create a new employee record</p>
        </div>
      </div>

      {/* Progress Indicator */}
      {renderStepIndicator()}

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">
              {steps[currentStep - 1]?.title}
            </h3>
            <p className="text-sm text-gray-500">
              {steps[currentStep - 1]?.description}
            </p>
          </div>
          <div className="card-content">
            {renderStepContent()}
          </div>
          {renderNavigationButtons()}
        </div>
      </form>

      {/* Error Display */}
      {Object.keys(errors).length > 0 && (
        <Alert variant="error" title="Please fix the following errors:">
          <ul className="list-disc list-inside space-y-1">
            {Object.entries(errors).map(([field, error]) => (
              <li key={field} className="text-sm">
                <strong>{field}:</strong> {error.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {/* Debug Information (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <h4 className="font-semibold mb-2">Debug Information:</h4>
          <div className="text-sm">
            <p><strong>Managers loaded:</strong> {managers.length}</p>
            <p><strong>Selected manager ID:</strong> {watch('managerId') || 'None'}</p>
            <p><strong>Managers with valid UUIDs:</strong> {managers.filter(m => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(m.id)).length}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateEmployee;