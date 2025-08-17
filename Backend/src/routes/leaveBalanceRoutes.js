// src/routes/leaveBalanceRoutes.js - Updated and improved version
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

// Helper function to validate year
const isValidYear = (year) => {
  const currentYear = new Date().getFullYear();
  return year >= 2000 && year <= (currentYear + 10);
};

// Validation schemas
const createBalanceSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    policyId: z.string().uuid('Invalid policy ID'),
    year: z.number().min(2000, 'Year must be 2000 or later').max(2030, 'Year cannot be beyond 2030'),
    allocatedDays: z.number().min(0, 'Allocated days must be non-negative').max(999, 'Allocated days cannot exceed 999'),
    carryForwardDays: z.number().min(0, 'Carry forward days must be non-negative').max(999, 'Carry forward days cannot exceed 999').default(0),
    adjustmentDays: z.number().min(-999, 'Adjustment days too low').max(999, 'Adjustment days too high').default(0),
    adjustmentReason: z.string().max(500, 'Adjustment reason too long').optional(),
  }).refine(data => {
    // Ensure carry forward days don't exceed allocated days
    if (data.carryForwardDays > data.allocatedDays) {
      return false;
    }
    // If adjustment reason is provided, adjustment days should be non-zero
    if (data.adjustmentReason && data.adjustmentDays === 0) {
      return false;
    }
    return true;
  }, {
    message: 'Invalid balance configuration',
  }),
});

const updateBalanceSchema = z.object({
  body: z.object({
    allocatedDays: z.number().min(0, 'Allocated days must be non-negative').max(999, 'Allocated days cannot exceed 999').optional(),
    usedDays: z.number().min(0, 'Used days must be non-negative').max(999, 'Used days cannot exceed 999').optional(),
    carryForwardDays: z.number().min(0, 'Carry forward days must be non-negative').max(999, 'Carry forward days cannot exceed 999').optional(),
    adjustmentDays: z.number().min(-999, 'Adjustment days too low').max(999, 'Adjustment days too high').optional(),
    adjustmentReason: z.string().max(500, 'Adjustment reason too long').optional(),
  }).refine(data => {
    // If adjustment is being made, require reason
    if (data.adjustmentDays !== undefined && data.adjustmentDays !== 0 && !data.adjustmentReason) {
      return false;
    }
    return true;
  }, {
    message: 'Adjustment reason is required when making adjustments',
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid balance ID'),
  }),
});

const employeeIdSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
  }),
});

const bulkCreateSchema = z.object({
  body: z.object({
    balances: z.array(z.object({
      employeeId: z.string().uuid('Invalid employee ID'),
      policyId: z.string().uuid('Invalid policy ID'),
      allocatedDays: z.number().min(0, 'Allocated days must be non-negative').max(999, 'Allocated days cannot exceed 999'),
      carryForwardDays: z.number().min(0, 'Carry forward days must be non-negative').max(999, 'Carry forward days cannot exceed 999').default(0),
    })).min(1, 'At least one balance is required').max(1000, 'Cannot process more than 1000 balances at once'),
    year: z.number().min(2000, 'Year must be 2000 or later').max(2030, 'Year cannot be beyond 2030'),
    overwriteExisting: z.boolean().default(false),
  }),
});

/**
 * GET /api/leave-balances - Get all leave balances with pagination
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
      
      // Process employeeId with UUID validation
      let employeeId = null;
      if (!isEmpty(rawQuery.employeeId)) {
        const empId = rawQuery.employeeId.trim();
        if (!isValidUUID(empId)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid employee ID format',
            code: 'INVALID_EMPLOYEE_ID'
          });
        }
        employeeId = empId;
      }
      
      // Process policyId with UUID validation
      let policyId = null;
      if (!isEmpty(rawQuery.policyId)) {
        const polId = rawQuery.policyId.trim();
        if (!isValidUUID(polId)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid policy ID format',
            code: 'INVALID_POLICY_ID'
          });
        }
        policyId = polId;
      }
      
      // Process year filter
      let year = null;
      if (!isEmpty(rawQuery.year)) {
        const yearNum = parseInt(rawQuery.year, 10);
        if (isNaN(yearNum) || !isValidYear(yearNum)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid year. Must be between 2000 and 2030',
            code: 'INVALID_YEAR'
          });
        }
        year = yearNum;
      }
      
      // Build filters object
      const filters = {};
      
      if (employeeId) {
        filters.employeeId = employeeId;
      }
      
      if (policyId) {
        filters.policyId = policyId;
      }
      
      if (year) {
        filters.year = year;
      }

      // Role-based filtering
      if (req.user && req.user.role) {
        const userRole = req.user.role.toUpperCase();
        
        if (userRole === 'EMPLOYEE' && req.user.employee) {
          // Employees can only see their own balances
          filters.employeeId = req.user.employee.id;
        } else if (userRole === 'MANAGER' && req.user.employee) {
          // Managers can see their own and subordinates' balances
          try {
            const subordinates = await prisma.employee.findMany({
              where: { managerId: req.user.employee.id },
              select: { id: true },
            });
            const subordinateIds = subordinates.map(sub => sub.id);
            subordinateIds.push(req.user.employee.id); // Include self
            
            // If employeeId filter is already set, check if it's allowed
            if (filters.employeeId && !subordinateIds.includes(filters.employeeId)) {
              return res.status(403).json({
                status: 'error',
                message: 'Access denied to this employee\'s leave balances',
                code: 'ACCESS_DENIED'
              });
            } else if (!filters.employeeId) {
              filters.employeeId = { in: subordinateIds };
            }
          } catch (managerError) {
            logger.error('Error fetching manager subordinates', { 
              error: managerError.message,
              userId: req.user.id,
              managerId: req.user.employee?.id
            });
            // Fallback to only own balances
            filters.employeeId = req.user.employee.id;
          }
        }
        // ADMIN and HR can see all balances (no additional filtering)
      }

      // Execute database queries with error handling
      let balances = [];
      let total = 0;

      try {
        [balances, total] = await Promise.all([
          prisma.leaveBalance.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: [
              { year: 'desc' },
              { employee: { firstName: 'asc' } },
              { policy: { leaveType: 'asc' } }
            ],
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
              policy: {
                select: { 
                  id: true, 
                  name: true, 
                  leaveType: true, 
                  maxDaysPerYear: true,
                  carryForwardAllowed: true,
                  maxCarryForwardDays: true
                },
              },
              createdBy: {
                select: { 
                  id: true, 
                  email: true 
                },
              },
              updatedBy: {
                select: { 
                  id: true, 
                  email: true 
                },
              },
            },
          }),
          prisma.leaveBalance.count({ where: filters }),
        ]);
      } catch (dbError) {
        logger.error('Database error in leave balance query', {
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
          await createAuditLog(req.user.id, 'READ', 'leave_balances', null, null, null, req);
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
          balances,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
          }
        },
      });
    } catch (error) {
      logger.error('Error fetching leave balances', { 
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
        next(new AppError('Failed to fetch leave balances', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/leave-balances/:id - Get single leave balance
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const balance = await prisma.leaveBalance.findUnique({
        where: { id },
        include: {
          employee: {
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              employeeId: true, 
              email: true,
              managerId: true 
            },
          },
          policy: {
            select: { 
              id: true, 
              name: true, 
              leaveType: true, 
              maxDaysPerYear: true,
              carryForwardAllowed: true,
              maxCarryForwardDays: true,
              description: true
            },
          },
          createdBy: {
            select: { 
              id: true, 
              email: true 
            },
          },
          updatedBy: {
            select: { 
              id: true, 
              email: true 
            },
          },
        },
      });

      if (!balance) {
        throw new AppError('Leave balance not found', 404, null, 'NOT_FOUND');
      }

      // Check access permissions
      const userRole = req.user.role.toUpperCase();
      let hasAccess = false;

      if (userRole === 'ADMIN' || userRole === 'HR') {
        hasAccess = true;
      } else if (userRole === 'EMPLOYEE' && req.user.employee) {
        // Employee can only access their own balances
        hasAccess = balance.employeeId === req.user.employee.id;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        // Manager can access their own and subordinates' balances
        hasAccess = balance.employeeId === req.user.employee.id || 
                   balance.employee.managerId === req.user.employee.id;
      }

      if (!hasAccess) {
        throw new AppError('Access denied to this leave balance', 403, null, 'ACCESS_DENIED');
      }

      await createAuditLog(req.user.id, 'READ', 'leave_balances', id, null, null, req);
      res.json({ status: 'success', data: balance });
    } catch (error) {
      logger.error('Error fetching leave balance', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/leave-balances - Create a new leave balance
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(createBalanceSchema),
  async (req, res, next) => {
    try {
      const balanceData = req.validatedData.body;
      
      // Validate employee exists and is active
      const employee = await prisma.employee.findUnique({
        where: { id: balanceData.employeeId },
        include: {
          user: { select: { isActive: true } },
        },
      });

      if (!employee || employee.employmentStatus !== 'ACTIVE' || !employee.user?.isActive) {
        throw new ValidationError('Employee not found or inactive', null, 'EMPLOYEE_NOT_FOUND');
      }

      // Validate policy exists and is active
      const policy = await prisma.leavePolicy.findUnique({
        where: { id: balanceData.policyId, isActive: true },
      });

      if (!policy) {
        throw new ValidationError('Leave policy not found or inactive', null, 'POLICY_NOT_FOUND');
      }

      // Check if balance already exists for this employee, policy, and year
      const existingBalance = await prisma.leaveBalance.findFirst({
        where: {
          employeeId: balanceData.employeeId,
          policyId: balanceData.policyId,
          year: balanceData.year,
        },
      });

      if (existingBalance) {
        throw new ValidationError(
          'Leave balance already exists for this employee, policy, and year',
          null,
          'BALANCE_ALREADY_EXISTS'
        );
      }

      // Validate carry forward against policy
      if (balanceData.carryForwardDays > 0) {
        if (!policy.carryForwardAllowed) {
          throw new ValidationError(
            'Carry forward is not allowed for this policy',
            null,
            'CARRY_FORWARD_NOT_ALLOWED'
          );
        }
        
        if (policy.maxCarryForwardDays && balanceData.carryForwardDays > policy.maxCarryForwardDays) {
          throw new ValidationError(
            'Carry forward days cannot exceed ${policy.maxCarryForwardDays}',
            null,
            'CARRY_FORWARD_EXCEEDS_LIMIT'
          );
        }
      }

      // Calculate remaining days
      const totalDays = balanceData.allocatedDays + balanceData.carryForwardDays + balanceData.adjustmentDays;
      const remainingDays = totalDays;

      // Create the leave balance
      const newBalance = await prisma.leaveBalance.create({
        data: {
          employeeId: balanceData.employeeId,
          policyId: balanceData.policyId,
          year: balanceData.year,
          allocatedDays: balanceData.allocatedDays,
          carryForwardDays: balanceData.carryForwardDays,
          adjustmentDays: balanceData.adjustmentDays,
          adjustmentReason: balanceData.adjustmentReason,
          usedDays: 0,
          remainingDays: remainingDays,
          createdById: req.user.id,
        },
        include: {
          employee: {
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              employeeId: true 
            },
          },
          policy: {
            select: { 
              id: true, 
              name: true, 
              leaveType: true 
            },
          },
        },
      });

      await createAuditLog(req.user.id, 'CREATE', 'leave_balances', newBalance.id, null, newBalance, req);
      res.status(201).json({ 
        status: 'success', 
        message: 'Leave balance created successfully',
        data: newBalance 
      });
    } catch (error) {
      logger.error('Error creating leave balance', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * PUT /api/leave-balances/:id - Update leave balance
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema.merge(updateBalanceSchema)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingBalance = await prisma.leaveBalance.findUnique({
        where: { id },
        include: {
          policy: {
            select: { 
              carryForwardAllowed: true,
              maxCarryForwardDays: true
            }
          }
        }
      });

      if (!existingBalance) {
        throw new AppError('Leave balance not found', 404, null, 'NOT_FOUND');
      }

      // Validate carry forward if being updated
      if (updateData.carryForwardDays !== undefined && updateData.carryForwardDays > 0) {
        if (!existingBalance.policy.carryForwardAllowed) {
          throw new ValidationError(
            'Carry forward is not allowed for this policy',
            null,
            'CARRY_FORWARD_NOT_ALLOWED'
          );
        }
        
        if (existingBalance.policy.maxCarryForwardDays && 
            updateData.carryForwardDays > existingBalance.policy.maxCarryForwardDays) {
          throw new ValidationError(
            'Carry forward days cannot exceed ${existingBalance.policy.maxCarryForwardDays}',
            null,
            'CARRY_FORWARD_EXCEEDS_LIMIT'
          );
        }
      }

      // Check if there are pending/approved leave requests that would exceed new balance
      if (updateData.allocatedDays !== undefined || updateData.carryForwardDays !== undefined || updateData.adjustmentDays !== undefined) {
        const pendingRequests = await prisma.leaveRequest.findMany({
          where: {
            employeeId: existingBalance.employeeId,
            policyId: existingBalance.policyId,
            status: { in: ['PENDING', 'APPROVED'] },
          },
          select: { approvedDays: true, requestedDays: true, status: true }
        });

        const totalPendingDays = pendingRequests.reduce((sum, req) => 
          sum + (req.status === 'APPROVED' ? req.approvedDays : req.requestedDays), 0
        );

        const newAllocated = updateData.allocatedDays !== undefined ? updateData.allocatedDays : existingBalance.allocatedDays;
        const newCarryForward = updateData.carryForwardDays !== undefined ? updateData.carryForwardDays : existingBalance.carryForwardDays;
        const newAdjustment = updateData.adjustmentDays !== undefined ? updateData.adjustmentDays : existingBalance.adjustmentDays;
        const newTotalDays = newAllocated + newCarryForward + newAdjustment;

        if (newTotalDays < (existingBalance.usedDays + totalPendingDays)) {
          throw new ValidationError(
            'Updated balance would be insufficient for existing used days and pending requests',
            null,
            'INSUFFICIENT_BALANCE_FOR_UPDATE'
          );
        }
      }

      // Process update data
      const processedData = { ...updateData };
      processedData.updatedById = req.user.id;

      // Recalculate remaining days if any balance components changed
      if (updateData.allocatedDays !== undefined || updateData.carryForwardDays !== undefined || 
          updateData.usedDays !== undefined || updateData.adjustmentDays !== undefined) {
        
        const finalAllocated = updateData.allocatedDays !== undefined ? updateData.allocatedDays : existingBalance.allocatedDays;
        const finalCarryForward = updateData.carryForwardDays !== undefined ? updateData.carryForwardDays : existingBalance.carryForwardDays;
        const finalUsed = updateData.usedDays !== undefined ? updateData.usedDays : existingBalance.usedDays;
        const finalAdjustment = updateData.adjustmentDays !== undefined ? updateData.adjustmentDays : existingBalance.adjustmentDays;
        
        processedData.remainingDays = finalAllocated + finalCarryForward + finalAdjustment - finalUsed;
      }

      const updatedBalance = await prisma.leaveBalance.update({
        where: { id },
        data: processedData,
        include: {
          employee: {
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              employeeId: true 
            },
          },
          policy: {
            select: { 
              id: true, 
              name: true, 
              leaveType: true 
            },
          },
          createdBy: {
            select: { 
              id: true, 
              email: true 
            },
          },
          updatedBy: {
            select: { 
              id: true, 
              email: true 
            },
          },
        },
      });

      await createAuditLog(req.user.id, 'UPDATE', 'leave_balances', id, existingBalance, updatedBalance, req);
      res.json({ 
        status: 'success', 
        message: 'Leave balance updated successfully',
        data: updatedBalance 
      });
    } catch (error) {
      logger.error('Error updating leave balance', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/leave-balances/:id - Delete leave balance
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const existingBalance = await prisma.leaveBalance.findUnique({
        where: { id },
      });

      if (!existingBalance) {
        throw new AppError('Leave balance not found', 404, null, 'NOT_FOUND');
      }

      // Check if there are active leave requests for this balance
      const activeRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId: existingBalance.employeeId,
          policyId: existingBalance.policyId,
          status: { in: ['PENDING', 'APPROVED'] },
        },
        select: { id: true, status: true }
      });

      if (activeRequests.length > 0) {
        throw new ValidationError(
          'Cannot delete balance with pending or approved leave requests',
          null,
          'BALANCE_HAS_ACTIVE_REQUESTS'
        );
      }

      // Check if balance has been used
      if (existingBalance.usedDays > 0) {
        logger.warn('Deleting balance with used days', {
          balanceId: id,
          usedDays: existingBalance.usedDays,
          userId: req.user?.id
        });
      }

      await prisma.leaveBalance.delete({ where: { id } });

      await createAuditLog(req.user.id, 'DELETE', 'leave_balances', id, existingBalance, null, req);
      res.json({
        status: 'success',
        message: 'Leave balance deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting leave balance', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * GET /api/leave-balances/employee/:employeeId - Get leave balances for specific employee
 */
router.get(
  '/employee/:employeeId',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(employeeIdSchema),
  async (req, res, next) => {
    try {
      const { employeeId } = req.validatedData.params;
      const { year } = req.query;

      // Check access permissions
      const userRole = req.user.role.toUpperCase();
      let hasAccess = false;

      if (userRole === 'ADMIN' || userRole === 'HR') {
        hasAccess = true;
      } else if (userRole === 'EMPLOYEE' && req.user.employee) {
        // Employee can only access their own balances
        hasAccess = employeeId === req.user.employee.id;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        // Manager can access their own and subordinates' balances
        if (employeeId === req.user.employee.id) {
          hasAccess = true;
        } else {
          // Check if the employee is a subordinate
          const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { managerId: true },
          });
          hasAccess = employee?.managerId === req.user.employee.id;
        }
      }

      if (!hasAccess) {
        throw new AppError('Access denied to this employee\'s leave balances', 403, null, 'ACCESS_DENIED');
      }

      // Build filters
      const filters = { employeeId };
      if (year) {
        const yearNum = parseInt(year, 10);
        if (isNaN(yearNum) || !isValidYear(yearNum)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid year. Must be between 2000 and 2030',
            code: 'INVALID_YEAR'
          });
        }
        filters.year = yearNum;
      }

      // Execute queries
      const balances = await prisma.leaveBalance.findMany({
        where: filters,
        orderBy: [
          { year: 'desc' },
          { policy: { leaveType: 'asc' } }
        ],
        include: {
          policy: {
            select: { 
              id: true, 
              name: true, 
              leaveType: true,
              maxDaysPerYear: true,
              carryForwardAllowed: true,
              maxCarryForwardDays: true
            },
          },
        },
      });

      await createAuditLog(req.user.id, 'READ', 'leave_balances', null, null, null, req);
      
      res.json({
        status: 'success',
        data: {
          balances,
          total: balances.length
        },
      });
    } catch (error) {
      logger.error('Error fetching employee leave balances', { 
        error: error.message, 
        employeeId: req.params.employeeId,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/leave-balances/bulk-create - Create multiple leave balances
 */
router.post(
  '/bulk-create',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(bulkCreateSchema),
  async (req, res, next) => {
    try {
      const { balances: balanceDataArray, year, overwriteExisting } = req.validatedData.body;

      // Validate all employees exist
      const employeeIds = [...new Set(balanceDataArray.map(b => b.employeeId))];
      const employees = await prisma.employee.findMany({
        where: { 
          id: { in: employeeIds },
          employmentStatus: 'ACTIVE'
        },
        include: {
          user: { select: { isActive: true } }
        }
      });

      const activeEmployeeIds = employees
        .filter(emp => emp.user?.isActive)
        .map(emp => emp.id);

      const invalidEmployeeIds = employeeIds.filter(id => !activeEmployeeIds.includes(id));
      if (invalidEmployeeIds.length > 0) {
        throw new ValidationError(
          `Invalid or inactive employees: ${invalidEmployeeIds.join(', ')}`,
          null,
          'INVALID_EMPLOYEES'
        );
      }

      // Validate all policies exist
      const policyIds = [...new Set(balanceDataArray.map(b => b.policyId))];
      const policies = await prisma.leavePolicy.findMany({
        where: { 
          id: { in: policyIds },
          isActive: true
        }
      });

      const validPolicyIds = policies.map(p => p.id);
      const invalidPolicyIds = policyIds.filter(id => !validPolicyIds.includes(id));
      if (invalidPolicyIds.length > 0) {
        throw new ValidationError(
          `Invalid or inactive policies: ${invalidPolicyIds.join(', ')}`,
          null,
          'INVALID_POLICIES'
        );
      }

      // Check for existing balances
      const existingBalances = await prisma.leaveBalance.findMany({
        where: {
          year,
          OR: balanceDataArray.map(b => ({
            employeeId: b.employeeId,
            policyId: b.policyId
          }))
        },
        select: { employeeId: true, policyId: true }
      });

      if (existingBalances.length > 0 && !overwriteExisting) {
        throw new ValidationError(
          `${existingBalances.length} balance(s) already exist for this year. Set overwriteExisting to true to replace them.`,
          null,
          'BALANCES_ALREADY_EXIST'
        );
      }

      // Create policy lookup for validation
      const policyLookup = Object.fromEntries(
        policies.map((p) => [p.id, p])
      );

      // Validate carry forward for each balance
      const validationErrors = [];

      balanceDataArray.forEach((balance, index) => {
        const policy = policyLookup[balance.policyId];

        // Safety check in case policyId doesn't match anything
        if (!policy) {
          validationErrors.push(
            `Balance ${index + 1}: No matching policy found for policyId ${balance.policyId}`
          );
          return;
        }

        if (balance.carryForwardDays > 0) {
          if (!policy.carryForwardAllowed) {
            validationErrors.push(
              `Balance ${index + 1}: Carry forward not allowed for policy "${policy.name}"`
            );
          } else if (
            policy.maxCarryForwardDays &&
            balance.carryForwardDays > policy.maxCarryForwardDays
          ) {
            validationErrors.push(
              `Balance ${index + 1}: Carry forward exceeds limit of ${policy.maxCarryForwardDays} for policy "${policy.name}"`
            );
          }
        }
      });

      if (validationErrors.length > 0) {
        throw new ValidationError(
          `Validation errors: ${validationErrors.join('; ')}`,
          null,
          'BULK_VALIDATION_ERRORS'
        );
      }

      try {
        // Execute bulk create in transaction
        const result = await prisma.$transaction(async (tx) => {
          // Delete existing balances if overwriting
          if (overwriteExisting && existingBalances.length > 0) {
            await tx.leaveBalance.deleteMany({
              where: {
                year,
                OR: balanceDataArray.map((b) => ({
                  employeeId: b.employeeId,
                  policyId: b.policyId,
                })),
              },
            });
          }

          // Create new balances
          const createdBalances = [];
          for (const balanceData of balanceDataArray) {
            const totalDays =
              balanceData.allocatedDays + balanceData.carryForwardDays;

            const balance = await tx.leaveBalance.create({
              data: {
                employeeId: balanceData.employeeId,
                policyId: balanceData.policyId,
                year,
                allocatedDays: balanceData.allocatedDays,
                carryForwardDays: balanceData.carryForwardDays,
                adjustmentDays: 0,
                usedDays: 0,
                remainingDays: totalDays,
                createdById: req.user.id,
              },
              include: {
                employee: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    employeeId: true,
                  },
                },
                policy: {
                  select: {
                    id: true,
                    name: true,
                    leaveType: true,
                  },
                },
              },
            });

            createdBalances.push(balance);
          }

          return createdBalances;
        });

        // Audit log
        await createAuditLog(
          req.user.id,
          'BULK_CREATE',
          'leave_balances',
          null,
          null,
          { count: result.length, year, overwriteExisting },
          req
        );

        // Response
        res.status(201).json({
          status: 'success',
          message: `${result.length} leave balances created successfully`,
          data: {
            balances: result,
            count: result.length,
            year,
          },
        });
      } catch (error) {
        logger.error('Error creating bulk leave balances', {
          error: error.message,
          count: req.validatedData?.body?.balances?.length,
          userId: req.user?.id,
        });
        next(error);
      }
    } catch (error) {
      logger.error('Error in bulk create leave balances', {
        error: error.message,
        count: req.validatedData?.body?.balances?.length,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * GET /api/leave-balances/summary/:employeeId - Get leave balance summary for employee
 */
router.get(
  '/summary/:employeeId',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(employeeIdSchema),
  async (req, res, next) => {
    try {
      const { employeeId } = req.validatedData.params;
      const { year } = req.query;

      // Check access permissions (same logic as above)
      const userRole = req.user.role.toUpperCase();
      let hasAccess = false;

      if (userRole === 'ADMIN' || userRole === 'HR') {
        hasAccess = true;
      } else if (userRole === 'EMPLOYEE' && req.user.employee) {
        hasAccess = employeeId === req.user.employee.id;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        if (employeeId === req.user.employee.id) {
          hasAccess = true;
        } else {
          const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            select: { managerId: true },
          });
          hasAccess = employee?.managerId === req.user.employee.id;
        }
      }

      if (!hasAccess) {
        throw new AppError('Access denied to this employee\'s balance summary', 403, null, 'ACCESS_DENIED');
      }

      const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
      if (isNaN(targetYear) || !isValidYear(targetYear)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid year. Must be between 2000 and 2030',
          code: 'INVALID_YEAR'
        });
      }

      // Get balances for the year
      const balances = await prisma.leaveBalance.findMany({
        where: {
          employeeId,
          year: targetYear,
        },
        include: {
          policy: {
            select: { 
              id: true, 
              name: true, 
              leaveType: true,
              maxDaysPerYear: true,
              carryForwardAllowed: true,
              maxCarryForwardDays: true
            },
          },
        },
        orderBy: { policy: { leaveType: 'asc' } },
      });

      // Get recent leave requests for context
      const recentRequests = await prisma.leaveRequest.findMany({
        where: { 
          employeeId,
          createdAt: {
            gte: new Date(targetYear, 0, 1),
            lt: new Date(targetYear + 1, 0, 1),
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          policy: {
            select: { 
              name: true, 
              leaveType: true 
            },
          },
        },
      });

      // Calculate summary statistics
      const summary = {
        totalAllocated: balances.reduce((sum, b) => sum + b.allocatedDays, 0),
        totalCarryForward: balances.reduce((sum, b) => sum + b.carryForwardDays, 0),
        totalAdjustments: balances.reduce((sum, b) => sum + b.adjustmentDays, 0),
        totalUsed: balances.reduce((sum, b) => sum + b.usedDays, 0),
        totalRemaining: balances.reduce((sum, b) => sum + b.remainingDays, 0),
        balancesByType: {}
      };

      // Group by leave type
      balances.forEach(balance => {
        const leaveType = balance.policy.leaveType;
        if (!summary.balancesByType[leaveType]) {
          summary.balancesByType[leaveType] = [];
        }
        summary.balancesByType[leaveType].push(balance);
      });

      await createAuditLog(req.user.id, 'READ', 'leave_balance_summary', employeeId, null, null, req);

      res.json({
        status: 'success',
        data: {
          year: targetYear,
          summary,
          balances,
          recentRequests,
        },
      });
    } catch (error) {
      logger.error('Error fetching balance summary', { 
        error: error.message, 
        employeeId: req.params.employeeId,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/leave-balances/:id/adjustment - Make adjustment to leave balance
 */
router.post(
  '/:id/adjustment',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema.merge(z.object({
    body: z.object({
      adjustmentDays: z.number().min(-999, 'Adjustment too low').max(999, 'Adjustment too high'),
      adjustmentReason: z.string().min(1, 'Adjustment reason is required').max(500, 'Reason too long'),
    })
  }))),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const { adjustmentDays, adjustmentReason } = req.validatedData.body;

      const existingBalance = await prisma.leaveBalance.findUnique({
        where: { id },
        include: {
          employee: {
            select: { firstName: true, lastName: true, employeeId: true }
          },
          policy: {
            select: { name: true, leaveType: true }
          }
        }
      });

      if (!existingBalance) {
        throw new AppError('Leave balance not found', 404, null, 'NOT_FOUND');
      }

      // Calculate new balance
      const newRemainingDays = existingBalance.remainingDays + adjustmentDays;
      
      // Ensure balance doesn't go negative
      if (newRemainingDays < 0) {
        throw new ValidationError(
          'Adjustment would result in negative balance',
          null,
          'NEGATIVE_BALANCE_NOT_ALLOWED'
        );
      }

      // Update the balance
      const updatedBalance = await prisma.leaveBalance.update({
        where: { id },
        data: {
          adjustmentDays: existingBalance.adjustmentDays + adjustmentDays,
          adjustmentReason: adjustmentReason,
          remainingDays: newRemainingDays,
          updatedById: req.user.id,
        },
        include: {
          employee: {
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              employeeId: true 
            },
          },
          policy: {
            select: { 
              id: true, 
              name: true, 
              leaveType: true 
            },
          },
        },
      });

      await createAuditLog(
        req.user.id, 
        'ADJUST', 
        'leave_balances', 
        id, 
        existingBalance, 
        updatedBalance, 
        req
      );

      res.json({
        status: 'success',
        message: 'Leave balance adjusted successfully',
        data: updatedBalance
      });
    } catch (error) {
      logger.error('Error adjusting leave balance', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * GET /api/leave-balances/stats/overview - Get overall balance statistics
 */
router.get(
  '/stats/overview',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  async (req, res, next) => {
    try {
      const { year } = req.query;
      const targetYear = year ? parseInt(year, 10) : new Date().getFullYear();
      
      if (isNaN(targetYear) || !isValidYear(targetYear)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid year. Must be between 2000 and 2030',
          code: 'INVALID_YEAR'
        });
      }

      // Build filter based on user role
      let employeeFilter = {};
      if (req.user.role === 'MANAGER' && req.user.employee) {
        const subordinates = await prisma.employee.findMany({
          where: { managerId: req.user.employee.id },
          select: { id: true },
        });
        const subordinateIds = subordinates.map(sub => sub.id);
        subordinateIds.push(req.user.employee.id);
        employeeFilter.employeeId = { in: subordinateIds };
      }

      // Get statistics
      const [
        totalBalances,
        balancesByLeaveType,
        totalDaysStats,
        utilizationStats
      ] = await Promise.all([
        prisma.leaveBalance.count({
          where: { year: targetYear, ...employeeFilter }
        }),
        prisma.leaveBalance.groupBy({
          by: ['policy'],
          where: { year: targetYear, ...employeeFilter },
          _count: { id: true },
          _sum: {
            allocatedDays: true,
            usedDays: true,
            remainingDays: true
          }
        }),
        prisma.leaveBalance.aggregate({
          where: { year: targetYear, ...employeeFilter },
          _sum: {
            allocatedDays: true,
            carryForwardDays: true,
            adjustmentDays: true,
            usedDays: true,
            remainingDays: true
          }
        }),
        prisma.leaveBalance.findMany({
          where: { 
            year: targetYear,
            allocatedDays: { gt: 0 },
            ...employeeFilter
          },
          select: {
            usedDays: true,
            allocatedDays: true,
            policy: { select: { leaveType: true } }
          }
        })
      ]);

      // Calculate utilization rate
      const utilizationByType = {};
      utilizationStats.forEach(balance => {
        const leaveType = balance.policy.leaveType;
        if (!utilizationByType[leaveType]) {
          utilizationByType[leaveType] = { used: 0, allocated: 0 };
        }
        utilizationByType[leaveType].used += balance.usedDays;
        utilizationByType[leaveType].allocated += balance.allocatedDays;
      });

      Object.keys(utilizationByType).forEach(type => {
        const data = utilizationByType[type];
        data.utilizationRate = data.allocated > 0 ? (data.used / data.allocated * 100).toFixed(2) : 0;
      });

      await createAuditLog(req.user.id, 'READ', 'leave_balance_stats', null, null, null, req);

      res.json({
        status: 'success',
        data: {
          year: targetYear,
          overview: {
            totalEmployeesWithBalances: totalBalances,
            totalAllocated: totalDaysStats._sum.allocatedDays || 0,
            totalCarryForward: totalDaysStats._sum.carryForwardDays || 0,
            totalAdjustments: totalDaysStats._sum.adjustmentDays || 0,
            totalUsed: totalDaysStats._sum.usedDays || 0,
            totalRemaining: totalDaysStats._sum.remainingDays || 0,
            overallUtilizationRate: totalDaysStats._sum.allocatedDays > 0 ? 
              ((totalDaysStats._sum.usedDays / totalDaysStats._sum.allocatedDays) * 100).toFixed(2) : 0
          },
          utilizationByType
        }
      });
    } catch (error) {
      logger.error('Error fetching balance statistics', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

export default router;