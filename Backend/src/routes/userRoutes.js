// src/routes/userRoutes.js - Updated version following employeeRoutes.js patterns
import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { userService } from '../services/userService.js';
import { ValidationError, AppError } from '../utils/errors.js';
import prisma from '../config/prisma.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Helper function to safely convert string to number
const safeParseInt = (value, defaultValue, min = 1, max = 1000) => {
  if (!value || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  return Math.max(min, Math.min(max, parsed));
};

// Helper function to validate UUID
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === 'string' && uuid.trim() !== '' && uuidRegex.test(uuid);
};

// Helper function to check if string is empty or just whitespace
const isEmpty = (str) => {
  return !str || typeof str !== 'string' || str.trim() === '';
};

// Validation schemas
const userSchemas = {
  create: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      role: z.enum(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
      employeeId: z.string().uuid().optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid user ID') }),
    body: z.object({
      email: z.string().email().optional(),
      role: z.enum(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']).optional(),
      isActive: z.boolean().optional(),
      employeeId: z.string().uuid().optional(),
    }),
  }),
  // Simplified list schema - let route handle parameter processing
  getAll: z.object({
    query: z.object({
      page: z.union([z.string(), z.undefined()]).optional(),
      limit: z.union([z.string(), z.undefined()]).optional(),
      search: z.union([z.string(), z.undefined()]).optional(),
      role: z.union([z.string(), z.undefined()]).optional(),
      isActive: z.union([z.string(), z.undefined()]).optional(),
    }),
  }),
  changePassword: z.object({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    }),
  }),
  resetPasswordRequest: z.object({
    body: z.object({
      email: z.string().email('Invalid email format'),
    }),
  }),
  resetPassword: z.object({
    body: z.object({
      token: z.string().uuid(),
      newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    }),
  }),
  idSchema: z.object({
    params: z.object({
      id: z.string().uuid('Invalid user ID'),
    }),
  }),
};

/**
 * GET /api/users - Get all users with pagination
 * 
 * Returns a paginated list of users with optional filtering.
 * Accessible to ADMIN and HR roles.
 */
router.get(
  '/', 
  authenticate, 
  authorize('ADMIN', 'HR'), 
  async (req, res, next) => {
    try {
      // Manual parameter processing with proper error handling
      const rawQuery = req.query || {};
      
      // Process pagination parameters
      const page = safeParseInt(rawQuery.page, 1, 1, 1000);
      const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
      
      // Process search parameter
      const search = isEmpty(rawQuery.search) ? null : rawQuery.search.trim();
      
      // Process role with validation
      const validRoles = ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'];
      let role = null;
      if (!isEmpty(rawQuery.role)) {
        const roleValue = rawQuery.role.trim().toUpperCase();
        if (!validRoles.includes(roleValue)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid role',
            code: 'INVALID_ROLE',
            validValues: validRoles
          });
        }
        role = roleValue;
      }
      
      // Process isActive with validation
      let isActive = null;
      if (!isEmpty(rawQuery.isActive)) {
        const activeValue = rawQuery.isActive.trim().toLowerCase();
        if (activeValue === 'true') {
          isActive = true;
        } else if (activeValue === 'false') {
          isActive = false;
        } else {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid isActive value. Must be "true" or "false"',
            code: 'INVALID_IS_ACTIVE'
          });
        }
      }
      
      // Build filters object - only include non-null values
      const filters = {};
      
      if (role) {
        filters.role = role;
      }
      
      if (isActive !== null) {
        filters.isActive = isActive;
      }
      
      // Add search functionality
      if (search) {
        filters.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { employee: { 
            firstName: { contains: search, mode: 'insensitive' } 
          }},
          { employee: { 
            lastName: { contains: search, mode: 'insensitive' } 
          }},
        ];
      }

      // Execute database queries with error handling
      let users = [];
      let total = 0;

      try {
        [users, total] = await Promise.all([
          prisma.user.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { email: 'asc' },
            select: {
              id: true,
              email: true,
              role: true,
              isActive: true,
              lastLoginAt: true,
              createdAt: true,
              updatedAt: true,
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeId: true,
                  department: {
                    select: { name: true }
                  },
                  position: {
                    select: { title: true }
                  }
                }
              }
            },
          }),
          prisma.user.count({ where: filters }),
        ]);
      } catch (dbError) {
        logger.error('Database error in user query', {
          error: dbError.message,
          stack: dbError.stack,
          filters,
          userId: req.user?.id
        });
        throw new AppError('Database query failed', 500, null, 'DATABASE_ERROR');
      }

      // Log audit trail
      try {
        if (req.user?.id) {
          await createAuditLog(req.user.id, 'READ', 'users', null, null, null, req);
        }
      } catch (auditError) {
        // Don't fail the request if audit logging fails
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id 
        });
      }

      res.json({
        status: 'success',
        message: 'Users fetched successfully', 
        data: {
          users,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching users', { 
        error: error.message, 
        stack: error.stack,
        userId: req.user?.id,
        query: req.query,
        url: req.url
      });
      
      // Return appropriate error response
      if (error instanceof AppError) {
        next(error);
      } else {
        next(new AppError('Failed to fetch users', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/users/:id - Get single user
 * 
 * Returns detailed information about a specific user.
 * Users can view their own profile, ADMIN and HR can view any user.
 */
router.get(
  '/:id', 
  authenticate, 
  validate(userSchemas.idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      // Authorization check - users can view their own profile, ADMIN and HR can view any
      if (id !== req.user.id && !['ADMIN', 'HR'].includes(req.user.role)) {
        throw new AppError('Unauthorized access', 403, null, 'UNAUTHORIZED');
      }

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              phone: true,
              dateOfBirth: true,
              gender: true,
              maritalStatus: true,
              nationality: true,
              address: true,
              city: true,
              state: true,
              country: true,
              zipCode: true,
              employmentType: true,
              employmentStatus: true,
              hireDate: true,
              department: {
                select: { id: true, name: true }
              },
              position: {
                select: { id: true, title: true, level: true }
              },
              manager: {
                select: { id: true, firstName: true, lastName: true }
              }
            }
          }
        }
      });

      if (!user) {
        throw new AppError('User not found', 404, null, 'NOT_FOUND');
      }

      await createAuditLog(req.user.id, 'READ', 'users', id, null, null, req);

      res.json({ 
        status: 'success', 
        message: 'User fetched successfully', 
        data: user 
      });
    } catch (error) {
      logger.error('Error fetching user', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/users - Create user
 * 
 * Creates a new user with validation for unique email.
 * Accessible only to ADMIN and HR roles.
 */
router.post(
  '/', 
  authenticate, 
  authorize('ADMIN', 'HR'), 
  validate(userSchemas.create), 
  async (req, res, next) => {
    try {
      const userData = req.validatedData.body;

      // Check if email already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new ValidationError('Email already exists', null, 'DUPLICATE_EMAIL');
      }

      // Validate employee exists if provided
      if (userData.employeeId) {
        const employee = await prisma.employee.findUnique({
          where: { id: userData.employeeId },
        });
        if (!employee) {
          throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
        }

        // Check if employee already has a user account
        const existingEmployeeUser = await prisma.user.findUnique({
          where: { employeeId: userData.employeeId },
        });
        if (existingEmployeeUser) {
          throw new ValidationError('Employee already has a user account', null, 'EMPLOYEE_HAS_USER');
        }
      }

      const user = await userService.createUser({ 
        ...userData, 
        createdById: req.user.id 
      }, req);

      res.status(201).json({ 
        status: 'success', 
        message: 'User created successfully', 
        data: { user } 
      });
    } catch (error) {
      logger.error('Error creating user', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * PUT /api/users/:id - Update user
 * 
 * Updates an existing user with validation for unique email.
 * Accessible only to ADMIN and HR roles.
 */
router.put(
  '/:id', 
  authenticate, 
  authorize('ADMIN', 'HR'), 
  validate(userSchemas.update), 
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new AppError('User not found', 404, null, 'NOT_FOUND');
      }

      // Check email uniqueness if email is being updated
      if (updateData.email && updateData.email !== existingUser.email) {
        const existingEmail = await prisma.user.findUnique({
          where: { email: updateData.email },
        });
        if (existingEmail) {
          throw new ValidationError('Email already exists', null, 'DUPLICATE_EMAIL');
        }
      }

      // Validate employee exists if provided
      if (updateData.employeeId && updateData.employeeId !== existingUser.employeeId) {
        const employee = await prisma.employee.findUnique({
          where: { id: updateData.employeeId },
        });
        if (!employee) {
          throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
        }

        // Check if employee already has a different user account
        const existingEmployeeUser = await prisma.user.findUnique({
          where: { employeeId: updateData.employeeId },
        });
        if (existingEmployeeUser && existingEmployeeUser.id !== id) {
          throw new ValidationError('Employee already has a user account', null, 'EMPLOYEE_HAS_USER');
        }
      }

      const user = await userService.updateUser(id, updateData, req);
      
      res.json({ 
        status: 'success', 
        message: 'User updated successfully', 
        data: { user } 
      });
    } catch (error) {
      logger.error('Error updating user', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * PATCH /api/users/change-password - Change own password
 * 
 * Allows authenticated users to change their own password.
 */
router.patch(
  '/change-password', 
  authenticate, 
  validate(userSchemas.changePassword), 
  async (req, res, next) => {
    try {
      await userService.changePassword(req.user.id, req.validatedData.body, req);
      res.json({ 
        status: 'success', 
        message: 'Password changed successfully' 
      });
    } catch (error) {
      logger.error('Error changing password', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/users/reset-password-request - Request password reset
 * 
 * Sends a password reset token to the user's email.
 * No authentication required.
 */
router.post(
  '/reset-password-request', 
  validate(userSchemas.resetPasswordRequest), 
  async (req, res, next) => {
    try {
      await userService.requestPasswordReset(req.validatedData.body.email);
      res.json({ 
        status: 'success', 
        message: 'Reset token sent' 
      });
    } catch (error) {
      logger.error('Error requesting password reset', { 
        error: error.message,
        email: req.validatedData?.body?.email 
      });
      next(error);
    }
  }
);

/**
 * PATCH /api/users/reset-password - Reset password with token
 * 
 * Resets user password using a valid reset token.
 * No authentication required.
 */
router.patch(
  '/reset-password', 
  validate(userSchemas.resetPassword), 
  async (req, res, next) => {
    try {
      await userService.resetPassword(req.validatedData.body, req);
      res.json({ 
        status: 'success', 
        message: 'Password reset successfully' 
      });
    } catch (error) {
      logger.error('Error resetting password', { 
        error: error.message,
        token: req.validatedData?.body?.token 
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/users/:id - Delete user (soft delete)
 * 
 * Sets user as inactive instead of hard deletion.
 * Accessible only to ADMIN role.
 */
router.delete(
  '/:id', 
  authenticate, 
  authorize('ADMIN'), 
  validate(userSchemas.idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const existingUser = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingUser) {
        throw new AppError('User not found', 404, null, 'NOT_FOUND');
      }

      if (!existingUser.isActive) {
        throw new ValidationError('User is already inactive', null, 'ALREADY_INACTIVE');
      }

      await userService.deleteUser(id, req);
      
      res.json({ 
        status: 'success', 
        message: 'User deleted successfully' 
      });
    } catch (error) {
      logger.error('Error deleting user', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * GET /api/users/:id/activity - Get user activity logs
 * 
 * Returns audit trail for a specific user.
 * Accessible to ADMIN and HR roles.
 */
router.get(
  '/:id/activity', 
  authenticate, 
  authorize('ADMIN', 'HR'), 
  validate(userSchemas.idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      // Process pagination parameters
      const page = safeParseInt(req.query.page, 1, 1, 1000);
      const limit = safeParseInt(req.query.limit, 20, 1, 100);

      // Verify user exists
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, email: true }
      });

      if (!user) {
        throw new AppError('User not found', 404, null, 'NOT_FOUND');
      }

      const activities = await userService.getUserActivity(id, { page, limit });

      await createAuditLog(req.user.id, 'READ', 'audit_logs', id, null, null, req);

      res.json({ 
        status: 'success', 
        message: 'Activity logs fetched successfully', 
        data: activities 
      });
    } catch (error) {
      logger.error('Error fetching user activity', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

export default router;