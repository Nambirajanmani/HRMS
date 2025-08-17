// src/routes/leavePolicyRoutes.js - Updated to match database schema
import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
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

// Validation schemas - Updated to match database schema
const createPolicySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
    leaveType: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'EMERGENCY', 'UNPAID', 'SABBATICAL']), // Updated to match schema
    daysAllowed: z.number().min(0, 'Days allowed must be non-negative').max(365, 'Days allowed cannot exceed 365'), // Updated field name
    carryForward: z.boolean().default(false), // Updated field name
    maxCarryForward: z.number().min(0, 'Max carry forward must be non-negative').max(365, 'Max carry forward cannot exceed 365').optional(), // Updated field name
    isActive: z.boolean().default(true),
  }).refine(data => {
    // If carry forward is allowed, require max carry forward days
    if (data.carryForward && (data.maxCarryForward === undefined || data.maxCarryForward === null)) {
      return false;
    }
    return true;
  }, {
    message: 'Max carry forward days is required when carry forward is allowed',
  }),
});

const updatePolicySchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
    leaveType: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'EMERGENCY', 'UNPAID', 'SABBATICAL']).optional(), // Updated to match schema
    daysAllowed: z.number().min(0, 'Days allowed must be non-negative').max(365, 'Days allowed cannot exceed 365').optional(), // Updated field name
    carryForward: z.boolean().optional(), // Updated field name
    maxCarryForward: z.number().min(0, 'Max carry forward must be non-negative').max(365, 'Max carry forward cannot exceed 365').optional(), // Updated field name
    isActive: z.boolean().optional(),
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid policy ID'),
  }),
});

/**
 * GET /api/leave-policies - Get all leave policies with pagination
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  async (req, res, next) => {
    try {
      const rawQuery = req.query || {};
      
      // Process pagination parameters
      const page = safeParseInt(rawQuery.page, 1, 1, 1000);
      const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
      
      // Process leave type filter - Updated to match schema
      const validLeaveTypes = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'EMERGENCY', 'UNPAID', 'SABBATICAL'];
      let leaveType = null;
      if (!isEmpty(rawQuery.leaveType)) {
        const type = rawQuery.leaveType.trim().toUpperCase();
        if (!validLeaveTypes.includes(type)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid leave type',
            code: 'INVALID_LEAVE_TYPE',
            validValues: validLeaveTypes
          });
        }
        leaveType = type;
      }
      
      // Process isActive filter
      let isActive = null;
      if (!isEmpty(rawQuery.isActive)) {
        const activeStr = rawQuery.isActive.trim().toLowerCase();
        if (activeStr === 'true') {
          isActive = true;
        } else if (activeStr === 'false') {
          isActive = false;
        } else {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid isActive value. Must be true or false',
            code: 'INVALID_IS_ACTIVE'
          });
        }
      }
      
      // Build filters object
      const filters = {};
      
      if (leaveType) {
        filters.leaveType = leaveType;
      }
      
      if (isActive !== null) {
        filters.isActive = isActive;
      }

      // Execute database queries with error handling
      let policies = [];
      let total = 0;

      try {
        [policies, total] = await Promise.all([
          prisma.leavePolicy.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              _count: {
                select: {
                  leaveBalances: true,
                  leaveRequests: true,
                },
              },
            },
          }),
          prisma.leavePolicy.count({ where: filters }),
        ]);
      } catch (dbError) {
        logger.error('Database error in leave policy query', {
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
          await createAuditLog(req.user.id, 'READ', 'leave_policies', null, null, null, req);
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
        data: {
          policies,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
          }
        },
      });
    } catch (error) {
      logger.error('Error fetching leave policies', { 
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
        next(new AppError('Failed to fetch leave policies', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/leave-policies/:id - Get single leave policy
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const policy = await prisma.leavePolicy.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              leaveBalances: true,
              leaveRequests: true,
            },
          },
          leaveBalances: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              employee: {
                select: { 
                  id: true, 
                  firstName: true, 
                  lastName: true, 
                  employeeId: true, 
                  email: true 
                },
              },
            },
          },
          leaveRequests: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              employee: {
                select: { 
                  id: true, 
                  firstName: true, 
                  lastName: true, 
                  employeeId: true, 
                  email: true 
                },
              },
            },
          },
        },
      });

      if (!policy) {
        throw new AppError('Leave policy not found', 404, null, 'NOT_FOUND');
      }

      await createAuditLog(req.user.id, 'READ', 'leave_policies', id, null, null, req);
      res.json({ status: 'success', data: policy });
    } catch (error) {
      logger.error('Error fetching leave policy', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/leave-policies - Create a new leave policy
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(createPolicySchema),
  async (req, res, next) => {
    try {
      const policyData = req.validatedData.body;
      
      // Check if policy name already exists
      const existingPolicy = await prisma.leavePolicy.findFirst({
        where: { 
          name: {
            equals: policyData.name.trim(),
            mode: 'insensitive'
          }
        },
      });

      if (existingPolicy) {
        throw new ValidationError('Leave policy name already exists', null, 'POLICY_NAME_EXISTS');
      }

      // Check if active policy with same leave type already exists (optional business rule)
      if (policyData.isActive) {
        const existingTypePolicy = await prisma.leavePolicy.findFirst({
          where: { 
            leaveType: policyData.leaveType,
            isActive: true
          },
        });

        if (existingTypePolicy) {
          logger.warn('Multiple active policies for same leave type', {
            existingPolicyId: existingTypePolicy.id,
            newLeaveType: policyData.leaveType,
            userId: req.user?.id
          });
          // This is a warning, not an error - multiple policies per type might be allowed
        }
      }

      // Create the leave policy
      const newPolicy = await prisma.leavePolicy.create({
        data: {
          name: policyData.name.trim(),
          leaveType: policyData.leaveType,
          daysAllowed: policyData.daysAllowed,
          carryForward: policyData.carryForward,
          maxCarryForward: policyData.maxCarryForward,
          isActive: policyData.isActive,
        },
      });

      await createAuditLog(req.user.id, 'CREATE', 'leave_policies', newPolicy.id, null, newPolicy, req);
      res.status(201).json({ 
        status: 'success', 
        message: 'Leave policy created successfully',
        data: newPolicy 
      });
    } catch (error) {
      logger.error('Error creating leave policy', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * PUT /api/leave-policies/:id - Update leave policy
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema.merge(updatePolicySchema)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingPolicy = await prisma.leavePolicy.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              leaveBalances: true,
              leaveRequests: { where: { status: { in: ['PENDING', 'APPROVED'] } } },
            },
          },
        },
      });

      if (!existingPolicy) {
        throw new AppError('Leave policy not found', 404, null, 'NOT_FOUND');
      }

      // Check name uniqueness if name is being updated
      if (updateData.name && updateData.name.trim() !== existingPolicy.name) {
        const nameConflict = await prisma.leavePolicy.findFirst({
          where: { 
            id: { not: id },
            name: {
              equals: updateData.name.trim(),
              mode: 'insensitive'
            }
          },
        });
        
        if (nameConflict) {
          throw new ValidationError('Leave policy name already exists', null, 'POLICY_NAME_EXISTS');
        }
      }

      // Check if policy has active leave requests when trying to deactivate
      if (updateData.isActive === false && existingPolicy._count.leaveRequests > 0) {
        logger.warn('Attempting to deactivate policy with active leave requests', {
          policyId: id,
          activeRequestsCount: existingPolicy._count.leaveRequests,
          userId: req.user?.id
        });
        
        throw new ValidationError(
          'Cannot deactivate policy with pending or approved leave requests',
          null,
          'POLICY_HAS_ACTIVE_REQUESTS'
        );
      }

      // Validate carry forward logic
      if (updateData.carryForward !== undefined || updateData.maxCarryForward !== undefined) {
        const finalCarryForward = updateData.carryForward !== undefined ? 
          updateData.carryForward : existingPolicy.carryForward;
        const finalMaxCarryForward = updateData.maxCarryForward !== undefined ? 
          updateData.maxCarryForward : existingPolicy.maxCarryForward;

        if (finalCarryForward && (finalMaxCarryForward === null || finalMaxCarryForward === undefined)) {
          throw new ValidationError(
            'Max carry forward days is required when carry forward is allowed',
            null,
            'INVALID_CARRY_FORWARD_CONFIG'
          );
        }
      }

      // Process update data
      const processedData = { ...updateData };
      if (updateData.name) {
        processedData.name = updateData.name.trim();
      }

      const updatedPolicy = await prisma.leavePolicy.update({
        where: { id },
        data: processedData,
      });

      await createAuditLog(req.user.id, 'UPDATE', 'leave_policies', id, existingPolicy, updatedPolicy, req);
      res.json({ 
        status: 'success', 
        message: 'Leave policy updated successfully',
        data: updatedPolicy 
      });
    } catch (error) {
      logger.error('Error updating leave policy', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/leave-policies/:id - Soft delete leave policy
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const existingPolicy = await prisma.leavePolicy.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              leaveBalances: true,
              leaveRequests: { where: { status: { in: ['PENDING', 'APPROVED'] } } },
            },
          },
        },
      });

      if (!existingPolicy) {
        throw new AppError('Leave policy not found', 404, null, 'NOT_FOUND');
      }

      // Check if policy has active leave requests
      if (existingPolicy._count.leaveRequests > 0) {
        throw new ValidationError(
          'Cannot delete policy with pending or approved leave requests',
          null,
          'POLICY_HAS_ACTIVE_REQUESTS'
        );
      }

      // Check if policy has leave balances (warn but allow)
      if (existingPolicy._count.leaveBalances > 0) {
        logger.warn('Deleting policy with existing leave balances', {
          policyId: id,
          balanceCount: existingPolicy._count.leaveBalances,
          userId: req.user?.id
        });
      }

      // Soft delete by setting isActive to false
      const deletedPolicy = await prisma.leavePolicy.update({
        where: { id },
        data: { 
          isActive: false,
        },
      });

      await createAuditLog(req.user.id, 'DELETE', 'leave_policies', id, existingPolicy, deletedPolicy, req);
      res.json({
        status: 'success',
        message: 'Leave policy deleted successfully',
        data: deletedPolicy,
      });
    } catch (error) {
      logger.error('Error deleting leave policy', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * GET /api/leave-policies/active - Get only active leave policies (simplified endpoint)
 */
router.get(
  '/active',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  async (req, res, next) => {
    try {
      const policies = await prisma.leavePolicy.findMany({
        where: { isActive: true },
        orderBy: [
          { leaveType: 'asc' },
          { name: 'asc' }
        ],
        select: {
          id: true,
          name: true,
          leaveType: true,
          daysAllowed: true,
          carryForward: true,
          maxCarryForward: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await createAuditLog(req.user.id, 'READ', 'leave_policies_active', null, null, null, req);
      
      res.json({
        status: 'success',
        data: {
          policies,
          total: policies.length
        },
      });
    } catch (error) {
      logger.error('Error fetching active leave policies', { 
        error: error.message, 
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * GET /api/leave-policies/:id/usage-stats - Get policy usage statistics
 */
router.get(
  '/:id/usage-stats',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const { year } = req.query;
      
      // Validate year parameter
      const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
      if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2030) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid year. Must be between 2020 and 2030',
          code: 'INVALID_YEAR'
        });
      }

      const policy = await prisma.leavePolicy.findUnique({
        where: { id },
        select: { id: true, name: true, leaveType: true }
      });

      if (!policy) {
        throw new AppError('Leave policy not found', 404, null, 'NOT_FOUND');
      }

      // Get usage statistics
      const [
        totalBalances,
        totalRequests,
        requestsByStatus,
        totalDaysUsed
      ] = await Promise.all([
        prisma.leaveBalance.count({
          where: { policyId: id, year: targetYear }
        }),
        prisma.leaveRequest.count({
          where: { policyId: id }
        }),
        prisma.leaveRequest.groupBy({
          by: ['status'],
          where: { policyId: id },
          _count: { id: true },
          _sum: { days: true }
        }),
        prisma.leaveRequest.aggregate({
          where: { 
            policyId: id,
            status: 'APPROVED',
            startDate: {
              gte: new Date(targetYear, 0, 1),
              lt: new Date(targetYear + 1, 0, 1),
            },
          },
          _sum: { days: true }
        })
      ]);

      await createAuditLog(req.user.id, 'READ', 'leave_policy_stats', id, null, null, req);

      res.json({
        status: 'success',
        data: {
          policy,
          year: targetYear,
          statistics: {
            totalEmployeesWithBalance: totalBalances,
            totalLeaveRequests: totalRequests,
            requestsByStatus: requestsByStatus,
            totalDaysUsedThisYear: totalDaysUsed._sum.days || 0
          }
        },
      });
    } catch (error) {
      logger.error('Error fetching policy usage stats', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

export default router;