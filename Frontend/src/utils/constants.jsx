// API Configuration
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
};

// User Roles
export const USER_ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE',
};

// Employment Types
export const EMPLOYMENT_TYPES = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  INTERN: 'INTERN',
  CONSULTANT: 'CONSULTANT',
};

// Employment Status
export const EMPLOYMENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  TERMINATED: 'TERMINATED',
  ON_LEAVE: 'ON_LEAVE',
  PROBATION: 'PROBATION',
};

// Leave Types
export const LEAVE_TYPES = {
  ANNUAL: 'ANNUAL',
  SICK: 'SICK',
  MATERNITY: 'MATERNITY',
  PATERNITY: 'PATERNITY',
  EMERGENCY: 'EMERGENCY',
  UNPAID: 'UNPAID',
  SABBATICAL: 'SABBATICAL',
};

// Leave Status
export const LEAVE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
};

// Attendance Status
export const ATTENDANCE_STATUS = {
  PRESENT: 'PRESENT',
  ABSENT: 'ABSENT',
  LATE: 'LATE',
  HALF_DAY: 'HALF_DAY',
  WORK_FROM_HOME: 'WORK_FROM_HOME',
};

// Payroll Status
export const PAYROLL_STATUS = {
  DRAFT: 'DRAFT',
  PROCESSED: 'PROCESSED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
};

// Performance Ratings
export const PERFORMANCE_RATINGS = {
  OUTSTANDING: 'OUTSTANDING',
  EXCEEDS_EXPECTATIONS: 'EXCEEDS_EXPECTATIONS',
  MEETS_EXPECTATIONS: 'MEETS_EXPECTATIONS',
  BELOW_EXPECTATIONS: 'BELOW_EXPECTATIONS',
  UNSATISFACTORY: 'UNSATISFACTORY',
};

// Gender Options
export const GENDER_OPTIONS = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
};

// Marital Status Options
export const MARITAL_STATUS = {
  SINGLE: 'SINGLE',
  MARRIED: 'MARRIED',
  DIVORCED: 'DIVORCED',
  WIDOWED: 'WIDOWED',
};

// Document Types
export const DOCUMENT_TYPES = {
  RESUME: 'RESUME',
  ID_CARD: 'ID_CARD',
  PASSPORT: 'PASSPORT',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
  EDUCATION_CERTIFICATE: 'EDUCATION_CERTIFICATE',
  EXPERIENCE_LETTER: 'EXPERIENCE_LETTER',
  SALARY_SLIP: 'SALARY_SLIP',
  BANK_STATEMENT: 'BANK_STATEMENT',
  CONTRACT: 'CONTRACT',
  POLICY: 'POLICY',
  OTHER: 'OTHER',
};

// Date Formats
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  INPUT: 'yyyy-MM-dd',
  DATETIME: 'MMM dd, yyyy HH:mm',
  TIME: 'HH:mm',
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
  MAX_PAGE_SIZE: 100,
};

// Local Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER_PREFERENCES: 'userPreferences',
  THEME: 'theme',
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'An unexpected error occurred. Please try again.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN: 'Login successful!',
  LOGOUT: 'Logged out successfully',
  CREATE: 'Created successfully!',
  UPDATE: 'Updated successfully!',
  DELETE: 'Deleted successfully!',
  SAVE: 'Saved successfully!',
};

// Validation Rules
export const VALIDATION_RULES = {
  EMAIL: {
    PATTERN: /^\S+@\S+$/i,
    MESSAGE: 'Please enter a valid email address',
  },
  PHONE: {
    PATTERN: /^\+?[\d\s\-\(\)]+$/,
    MESSAGE: 'Please enter a valid phone number',
  },
  PASSWORD: {
    MIN_LENGTH: 8,
    MESSAGE: 'Password must be at least 8 characters long',
  },
  REQUIRED: {
    MESSAGE: 'This field is required',
  },
};

// Theme Colors
export const THEME_COLORS = {
  PRIMARY: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
};

// Chart Colors
export const CHART_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
];

// File Upload
export const FILE_UPLOAD = {
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx'],
};

// Time Zones
export const TIME_ZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

// Countries
export const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'IN', label: 'India' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'BR', label: 'Brazil' },
];

// Employee Form Steps
export const EMPLOYEE_FORM_STEPS = [
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
];

export default {
  API_CONFIG,
  USER_ROLES,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_STATUS,
  LEAVE_TYPES,
  LEAVE_STATUS,
  ATTENDANCE_STATUS,
  PAYROLL_STATUS,
  PERFORMANCE_RATINGS,
  GENDER_OPTIONS,
  MARITAL_STATUS,
  DOCUMENT_TYPES,
  DATE_FORMATS,
  PAGINATION,
  STORAGE_KEYS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION_RULES,
  THEME_COLORS,
  CHART_COLORS,
  FILE_UPLOAD,
  TIME_ZONES,
  COUNTRIES,
  EMPLOYEE_FORM_STEPS,
};