// src/middleware/validation.js
import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

// Get environment variable with logging
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
      });
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
          expected: err.expected || 'N/A',
          received: err.received || 'N/A',
        }));
        req.logger.error('Validation failed', { errors: errorMessages, url: req.originalUrl });
        return next(new ValidationError('Validation failed', errorMessages, 'VALIDATION_FAILED'));
      }
      req.logger.error('Unexpected validation error', { error: error.message, url: req.originalUrl });
      next(error);
    }
  };
};

// Common validation schemas
const commonSchemas = {
  id: z.string().uuid('Invalid UUID format').trim(),
  email: z.string().email('Invalid email format').trim().toLowerCase(),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format').trim().optional(),
  date: z.string().datetime('Invalid ISO 8601 date format').optional(),
  pagination: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? Math.max(1, parseInt(val)) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) =>
        val ? Math.min(parseInt(val), parseInt(getEnvVariable('PAGINATION_LIMIT_MAX', '100'))) : 10
      ),
  }),
};

// Role enum for consistency
const ROLES = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];

// Auth validation schemas
const authSchemas = {
  register: z.object({
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(8, 'Password must be at least 8 characters').trim(),
      role: z.enum(ROLES).optional().default('EMPLOYEE'),
    }),
  }),
  login: z.object({
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(1, 'Password is required').trim(),
    }),
  }),
  refreshToken: z.object({
    body: z.object({
      refreshToken: z.string().min(1, 'Refresh token is required').trim(),
    }),
  }),
  resetPassword: z.object({
    body: z.object({
      email: commonSchemas.email,
    }),
  }),
  updatePassword: z.object({
    body: z.object({
      token: z.string().min(1, 'Reset token is required').trim(),
      newPassword: z.string().min(8, 'Password must be at least 8 characters').trim(),
    }),
  }),
};

// Base employee schema for reusability
const baseEmployeeSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required').trim(),
  firstName: z.string().min(1, 'First name is required').trim(),
  lastName: z.string().min(1, 'Last name is required').trim(),
  email: commonSchemas.email,
  phone: commonSchemas.phone,
  dateOfBirth: commonSchemas.date,
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  departmentId: commonSchemas.id.optional(),
  positionId: commonSchemas.id.optional(),
  managerId: commonSchemas.id.optional(),
  hireDate: commonSchemas.date,
  baseSalary: z.number().positive('Base salary must be positive').optional(),
});

// Employee validation schemas
const employeeSchemas = {
  create: z.object({
    body: baseEmployeeSchema,
  }),
  update: z.object({
    params: z.object({
      id: commonSchemas.id,
    }),
    body: baseEmployeeSchema.partial(),
  }),
  list: z.object({
    query: commonSchemas.pagination.extend({
      search: z.string().trim().optional(),
      department: commonSchemas.id.optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'ON_LEAVE', 'PROBATION']).optional(),
    }),
  }),
};

// Leave validation schemas
const leaveSchemas = {
  request: z.object({
    body: z
      .object({
        policyId: commonSchemas.id,
        startDate: commonSchemas.date,
        endDate: commonSchemas.date,
        reason: z.string().min(1, 'Reason is required').trim(),
      })
      .refine((data) => new Date(data.startDate) <= new Date(data.endDate), {
        message: 'End date must be after start date',
        path: ['endDate'],
      }),
  }),
  approve: z.object({
    params: z.object({
      id: commonSchemas.id,
    }),
    body: z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      comments: z.string().trim().optional(),
    }),
  }),
};

// Export for ES Modules
export { validate, commonSchemas, authSchemas, employeeSchemas, leaveSchemas };
