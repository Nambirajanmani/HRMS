// src/routes/leaveRequestRoutes.js - Updated to match database schema
import express from 'express';
import { z } from 'zod';
import { authenticate, authorize, authorizeEmployee } from '../middleware/auth.js';
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

// Helper function to validate date string
const isValidDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && date.toISOString().slice(0, 10) === dateString.slice(0, 10);
};

// Helper function to calculate leave days
const calculateLeaveDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const timeDifference = end.getTime() - start.getTime();
  return Math.ceil(timeDifference / (1000 * 3600 * 24)) + 1; // Include both start and end dates
};

// Helper function to get date in YYYY-MM-DD format
const formatDateForComparison = (date) => {
  return new Date(date).toISOString().split('T')[0];
};

// Validation schemas - Updated to match database schema
const leaveRequestSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    policyId: z.string().uuid('Invalid policy ID'),
    startDate: z.string().refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, 'Invalid start date format'),
    endDate: z.string().refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, 'Invalid end date format'),
    reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long'),
    attachments: z.array(z.string()).optional().default([]),
  }).refine(data => {
    // Start date must be before or equal to end date
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  }, {
    message: 'Start date must be before or equal to end date',
  }),
});

const updateLeaveRequestSchema = z.object({
  body: z.object({
    startDate: z.string().refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, 'Invalid start date format').optional(),
    endDate: z.string().refine((date) => {
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime());
    }, 'Invalid end date format').optional(),
    reason: z.string().min(1, 'Reason is required').max(500, 'Reason too long').optional(),
    attachments: z.array(z.string()).optional(),
  }).refine(data => {
    // If dates are provided, start date must be before or equal to end date
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return start <= end;
    }
    return true;
  }, {
    message: 'Start date must be before or equal to end date',
  }),
});

const approveRejectSchema = z.object({
  body: z.object({
    action: z.enum(['APPROVE', 'REJECT']),
    rejectionReason: z.string().max(500, 'Rejection reason too long').optional(),
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid leave request ID'),
  }),
});

const employeeIdSchema = z.object({
  params: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
  }),
});

/**
 * GET /api/leave-requests - Get all leave requests with pagination
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
      
      // Process status with validation - Updated to match schema
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
      let status = null;
      if (!isEmpty(rawQuery.status)) {
        const stat = rawQuery.status.trim().toUpperCase();
        if (!validStatuses.includes(stat)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid status',
            code: 'INVALID_STATUS',
            validValues: validStatuses
          });
        }
        status = stat;
      }
      
      // Process leave type with validation - Updated to match schema
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
      
      // Process date filters
      let startDate = null;
      let endDate = null;
      
      if (!isEmpty(rawQuery.startDate)) {
        if (!isValidDate(rawQuery.startDate)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid start date format. Use YYYY-MM-DD format',
            code: 'INVALID_START_DATE'
          });
        }
        startDate = new Date(rawQuery.startDate);
      }
      
      if (!isEmpty(rawQuery.endDate)) {
        if (!isValidDate(rawQuery.endDate)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid end date format. Use YYYY-MM-DD format',
            code: 'INVALID_END_DATE'
          });
        }
        endDate = new Date(rawQuery.endDate);
      }
      
      // Build filters object
      const filters = {};
      
      if (employeeId) {
        filters.employeeId = employeeId;
      }
      
      if (policyId) {
        filters.policyId = policyId;
      }
      
      if (status) {
        filters.status = status;
      }
      
      // Date range filtering
      if (startDate || endDate) {
        if (startDate && endDate) {
          // Requests that overlap with the date range
          filters.OR = [
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: startDate } }
              ]
            }
          ];
        } else if (startDate) {
          filters.endDate = { gte: startDate };
        } else if (endDate) {
          filters.startDate = { lte: endDate };
        }
      }
      
      // Add leave type filter through policy relationship
      if (leaveType) {
        filters.policy = {
          leaveType: leaveType
        };
      }

      // Role-based filtering
      if (req.user && req.user.role) {
        const userRole = req.user.role.toUpperCase();
        
        if (userRole === 'EMPLOYEE' && req.user.employee) {
          // Employees can only see their own requests
          filters.employeeId = req.user.employee.id;
        } else if (userRole === 'MANAGER' && req.user.employee) {
          // Managers can see their own and subordinates' requests
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
                message: 'Access denied to this employee\'s leave requests',
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
            // Fallback to only own requests
            filters.employeeId = req.user.employee.id;
          }
        }
        // ADMIN and HR can see all requests (no additional filtering)
      }

      // Execute database queries with error handling
      let leaveRequests = [];
      let total = 0;

      try {
        [leaveRequests, total] = await Promise.all([
          prisma.leaveRequest.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
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
              policy: {
                select: { 
                  id: true, 
                  name: true, 
                  leaveType: true, 
                  daysAllowed: true 
                },
              },
              approvedBy: {
                select: { 
                  id: true, 
                  firstName: true, 
                  lastName: true 
                },
              },
            },
          }),
          prisma.leaveRequest.count({ where: filters }),
        ]);
      } catch (dbError) {
        logger.error('Database error in leave request query', {
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
          await createAuditLog(req.user.id, 'READ', 'leave_requests', null, null, null, req);
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
          leaveRequests,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
          }
        },
      });
    } catch (error) {
      logger.error('Error fetching leave requests', { 
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
        next(new AppError('Failed to fetch leave requests', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/leave-requests/:id - Get single leave request
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const leaveRequest = await prisma.leaveRequest.findUnique({
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
              daysAllowed: true
            },
          },
          approvedBy: {
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              email: true 
            },
          },
        },
      });

      if (!leaveRequest) {
        throw new AppError('Leave request not found', 404, null, 'NOT_FOUND');
      }

      // Check access permissions
      const userRole = req.user.role.toUpperCase();
      let hasAccess = false;

      if (userRole === 'ADMIN' || userRole === 'HR') {
        hasAccess = true;
      } else if (userRole === 'EMPLOYEE' && req.user.employee) {
        // Employee can only access their own requests
        hasAccess = leaveRequest.employeeId === req.user.employee.id;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        // Manager can access their own and subordinates' requests
        hasAccess = leaveRequest.employeeId === req.user.employee.id || 
                   leaveRequest.employee.managerId === req.user.employee.id;
      }

      if (!hasAccess) {
        throw new AppError('Access denied to this leave request', 403, null, 'ACCESS_DENIED');
      }

      await createAuditLog(req.user.id, 'READ', 'leave_requests', id, null, null, req);
      res.json({ status: 'success', data: leaveRequest });
    } catch (error) {
      logger.error('Error fetching leave request', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/leave-requests - Create a new leave request
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(leaveRequestSchema),
  async (req, res, next) => {
    try {
      const requestData = req.validatedData.body;
      
      // Check if user can create request for the specified employee
      const userRole = req.user.role.toUpperCase();
      if (userRole === 'EMPLOYEE' && req.user.employee) {
        if (requestData.employeeId !== req.user.employee.id) {
          throw new AppError('Employees can only create requests for themselves', 403, null, 'ACCESS_DENIED');
        }
      }

      // Validate employee exists and is active
      const employee = await prisma.employee.findUnique({
        where: { id: requestData.employeeId },
        include: {
          user: { select: { isActive: true } },
        },
      });

      if (!employee || employee.employmentStatus !== 'ACTIVE' || !employee.user?.isActive) {
        throw new ValidationError('Employee not found or inactive', null, 'EMPLOYEE_NOT_FOUND');
      }

      // Validate policy exists and is active
      const policy = await prisma.leavePolicy.findUnique({
        where: { id: requestData.policyId, isActive: true },
      });

      if (!policy) {
        throw new ValidationError('Leave policy not found or inactive', null, 'POLICY_NOT_FOUND');
      }

      // Validate date range
      const startDate = new Date(requestData.startDate);
      const endDate = new Date(requestData.endDate);
      const requestedDays = calculateLeaveDays(startDate, endDate);

      // Check if start date is in the future (allow same day requests)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        throw new ValidationError('Leave start date cannot be in the past', null, 'INVALID_START_DATE');
      }

      // Check for overlapping leave requests
      const overlappingRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId: requestData.employeeId,
          status: { in: ['PENDING', 'APPROVED'] },
          OR: [
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: startDate } }
              ]
            }
          ]
        },
      });

      if (overlappingRequests.length > 0) {
        throw new ValidationError('Leave request overlaps with existing request', null, 'OVERLAPPING_REQUEST');
      }

      // Check leave balance
      const currentYear = new Date().getFullYear();
      const leaveBalance = await prisma.leaveBalance.findFirst({
        where: {
          employeeId: requestData.employeeId,
          policyId: requestData.policyId,
          year: currentYear,
        },
      });

      if (leaveBalance && leaveBalance.remaining < requestedDays) {
        throw new ValidationError('Insufficient leave balance', null, 'INSUFFICIENT_BALANCE');
      }

      // Create the leave request
      const newLeaveRequest = await prisma.leaveRequest.create({
        data: {
          employeeId: requestData.employeeId,
          policyId: requestData.policyId,
          startDate,
          endDate,
          days: requestedDays,
          reason: requestData.reason,
          status: 'PENDING',
          appliedAt: new Date(),
          attachments: requestData.attachments || [],
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

      await createAuditLog(req.user.id, 'CREATE', 'leave_requests', newLeaveRequest.id, null, newLeaveRequest, req);
      res.status(201).json({ status: 'success', data: newLeaveRequest });
    } catch (error) {
      logger.error('Error creating leave request', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * PUT /api/leave-requests/:id - Update leave request
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(idSchema.merge(updateLeaveRequestSchema)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingRequest = await prisma.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: { select: { id: true, managerId: true } },
        },
      });

      if (!existingRequest) {
        throw new AppError('Leave request not found', 404, null, 'NOT_FOUND');
      }

      // Only pending requests can be updated
      if (existingRequest.status !== 'PENDING') {
        throw new ValidationError('Only pending requests can be updated', null, 'INVALID_STATUS');
      }

      // Check access permissions
      const userRole = req.user.role.toUpperCase();
      let hasAccess = false;

      if (userRole === 'ADMIN' || userRole === 'HR') {
        hasAccess = true;
      } else if (userRole === 'EMPLOYEE' && req.user.employee) {
        hasAccess = existingRequest.employeeId === req.user.employee.id;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        hasAccess = existingRequest.employeeId === req.user.employee.id || 
                   existingRequest.employee.managerId === req.user.employee.id;
      }

      if (!hasAccess) {
        throw new AppError('Access denied to update this leave request', 403, null, 'ACCESS_DENIED');
      }

      // Process date fields and recalculate days if dates changed
      const processedData = { ...updateData };

      if (updateData.startDate || updateData.endDate) {
        const startDate = updateData.startDate ? new Date(updateData.startDate) : existingRequest.startDate;
        const endDate = updateData.endDate ? new Date(updateData.endDate) : existingRequest.endDate;
        
        // Validate dates
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        startDate.setHours(0, 0, 0, 0);
        
        if (startDate < today) {
          throw new ValidationError('Leave start date cannot be in the past', null, 'INVALID_START_DATE');
        }

        if (updateData.startDate) {
          processedData.startDate = startDate;
        }
        if (updateData.endDate) {
          processedData.endDate = endDate;
        }
        
        processedData.days = calculateLeaveDays(startDate, endDate);

        // Check for overlapping requests (excluding current request)
        const overlappingRequests = await prisma.leaveRequest.findMany({
          where: {
            id: { not: id },
            employeeId: existingRequest.employeeId,
            status: { in: ['PENDING', 'APPROVED'] },
            OR: [
              {
                AND: [
                  { startDate: { lte: endDate } },
                  { endDate: { gte: startDate } }
                ]
              }
            ]
          },
        });

        if (overlappingRequests.length > 0) {
          throw new ValidationError('Updated leave request overlaps with existing request', null, 'OVERLAPPING_REQUEST');
        }

        // Check leave balance
        const currentYear = new Date().getFullYear();
        const leaveBalance = await prisma.leaveBalance.findFirst({
          where: {
            employeeId: existingRequest.employeeId,
            policyId: existingRequest.policyId,
            year: currentYear,
          },
        });

        if (leaveBalance) {
          // Calculate available balance (add back current request days)
          const availableBalance = leaveBalance.remaining + existingRequest.days;
          if (availableBalance < processedData.days) {
            throw new ValidationError('Insufficient leave balance for updated request', null, 'INSUFFICIENT_BALANCE');
          }
        }
      }

      const updatedRequest = await prisma.leaveRequest.update({
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
        },
      });

      await createAuditLog(req.user.id, 'UPDATE', 'leave_requests', id, existingRequest, updatedRequest, req);
      res.json({ status: 'success', data: updatedRequest });
    } catch (error) {
      logger.error('Error updating leave request', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/leave-requests/:id/approve-reject - Approve or reject leave request
 */
router.post(
  '/:id/approve-reject',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  validate(idSchema.merge(approveRejectSchema)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const { action, rejectionReason } = req.validatedData.body;

      const existingRequest = await prisma.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: { 
            select: { 
              id: true, 
              firstName: true, 
              lastName: true, 
              managerId: true 
            } 
          },
        },
      });

      if (!existingRequest) {
        throw new AppError('Leave request not found', 404, null, 'NOT_FOUND');
      }

      // Only pending requests can be approved/rejected
      if (existingRequest.status !== 'PENDING') {
        throw new ValidationError('Only pending requests can be approved or rejected', null, 'INVALID_STATUS');
      }

      // Check if user has permission to approve/reject this request
      const userRole = req.user.role.toUpperCase();
      let hasPermission = false;

      if (userRole === 'ADMIN' || userRole === 'HR') {
        hasPermission = true;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        // Manager can approve subordinates' requests
        hasPermission = existingRequest.employee.managerId === req.user.employee.id;
      }

      if (!hasPermission) {
        throw new AppError('Access denied to approve/reject this leave request', 403, null, 'ACCESS_DENIED');
      }

      // Start transaction for approval/rejection
      const result = await prisma.$transaction(async (tx) => {
        // Update the leave request
        const updateData = {
          status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        };

        if (action === 'APPROVE') {
          updateData.approvedAt = new Date();
          updateData.approvedById = req.user.employee?.id;
        } else {
          updateData.rejectedAt = new Date();
          updateData.rejectionReason = rejectionReason;
        }

        const updatedRequest = await tx.leaveRequest.update({
          where: { id },
          data: updateData,
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
            approvedBy: {
              select: { 
                id: true, 
                firstName: true, 
                lastName: true 
              },
            },
          },
        });

        // Update leave balance if approved
        if (action === 'APPROVE') {
          const currentYear = new Date().getFullYear();
          
          const leaveBalance = await tx.leaveBalance.findFirst({
            where: {
              employeeId: existingRequest.employeeId,
              policyId: existingRequest.policyId,
              year: currentYear,
            },
          });

          if (leaveBalance) {
            // Check if there's sufficient balance
            if (leaveBalance.remaining < existingRequest.days) {
              throw new ValidationError('Insufficient leave balance', null, 'INSUFFICIENT_BALANCE');
            }

            // Update the balance
            await tx.leaveBalance.update({
              where: { id: leaveBalance.id },
              data: {
                used: { increment: existingRequest.days },
                remaining: { decrement: existingRequest.days },
              },
            });
          }
        }

        return updatedRequest;
      });

      await createAuditLog(
        req.user.id, 
        action === 'APPROVE' ? 'UPDATE' : 'UPDATE', 
        'leave_requests', 
        id, 
        existingRequest, 
        result, 
        req
      );

      res.json({ 
        status: 'success', 
        message: `Leave request ${action.toLowerCase()}d successfully`,
        data: result 
      });
    } catch (error) {
      logger.error(
        `Error ${req.validatedData?.body?.action?.toLowerCase() || 'processing'} leave request`, 
        { 
          error: error.message, 
          id: req.params.id,
          userId: req.user?.id 
        }
      );
      next(error);
    }
  }
);

/**
 * DELETE /api/leave-requests/:id - Cancel/withdraw leave request
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const existingRequest = await prisma.leaveRequest.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              managerId: true,
            },
          },
        },
      });

      if (!existingRequest) {
        throw new AppError('Leave request not found', 404, null, 'NOT_FOUND');
      }

      // Check if request can be cancelled
      if (!['PENDING', 'APPROVED'].includes(existingRequest.status)) {
        throw new ValidationError(
          'Only pending or approved requests can be cancelled',
          null,
          'INVALID_STATUS'
        );
      }

      // Check access permissions
      const userRole = req.user.role.toUpperCase();
      let hasAccess = false;

      if (userRole === 'ADMIN' || userRole === 'HR') {
        hasAccess = true;
      } else if (userRole === 'EMPLOYEE' && req.user.employee) {
        // Employee can only cancel their own requests
        hasAccess = existingRequest.employeeId === req.user.employee.id;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        // Manager can cancel their own and subordinates' requests
        hasAccess =
          existingRequest.employeeId === req.user.employee.id ||
          existingRequest.employee.managerId === req.user.employee.id;
      }

      if (!hasAccess) {
        throw new AppError(
          'Access denied to cancel this leave request',
          403,
          null,
          'ACCESS_DENIED'
        );
      }

      // Start transaction for cancellation
      const result = await prisma.$transaction(async (tx) => {
        // Update the leave request status
        const cancelledRequest = await tx.leaveRequest.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: req.body?.reason || 'Request cancelled by user',
          },
        });

        // Restore leave balance if cancelling an approved request
        if (existingRequest.status === 'APPROVED') {
          const currentYear = new Date().getFullYear();
          const leaveBalance = await tx.leaveBalance.findFirst({
            where: {
              employeeId: existingRequest.employeeId,
              policyId: existingRequest.policyId,
              year: currentYear,
            },
          });

          if (leaveBalance) {
            await tx.leaveBalance.update({
              where: { id: leaveBalance.id },
              data: {
                used: { decrement: existingRequest.days },
                remaining: { increment: existingRequest.days },
              },
            });
          }
        }

        return cancelledRequest;
      });

      await createAuditLog(
        req.user.id,
        'DELETE',
        'leave_requests',
        id,
        existingRequest,
        result,
        req
      );

      res.json({
        status: 'success',
        message: 'Leave request cancelled successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error cancelling leave request', {
        error: error.message,
        id: req.params.id,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * GET /api/leave-requests/employee/:employeeId - Get leave requests for specific employee
 */
router.get(
  '/employee/:employeeId',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(employeeIdSchema),
  async (req, res, next) => {
    try {
      const { employeeId } = req.validatedData.params;

      // Check access permissions
      const userRole = req.user.role.toUpperCase();
      let hasAccess = false;

      if (userRole === 'ADMIN' || userRole === 'HR') {
        hasAccess = true;
      } else if (userRole === 'EMPLOYEE' && req.user.employee) {
        // Employee can only access their own requests
        hasAccess = employeeId === req.user.employee.id;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        // Manager can access their own and subordinates' requests
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
        throw new AppError('Access denied to this employee\'s leave requests', 403, null, 'ACCESS_DENIED');
      }

      // Process pagination
      const rawQuery = req.query || {};
      const page = safeParseInt(rawQuery.page, 1, 1, 1000);
      const limit = safeParseInt(rawQuery.limit, 10, 1, 100);

      // Process status filter
      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
      let status = null;
      if (!isEmpty(rawQuery.status)) {
        const stat = rawQuery.status.trim().toUpperCase();
        if (!validStatuses.includes(stat)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid status',
            code: 'INVALID_STATUS',
            validValues: validStatuses
          });
        }
        status = stat;
      }

      // Build filters
      const filters = { employeeId };
      if (status) {
        filters.status = status;
      }

      // Execute queries
      const [leaveRequests, total] = await Promise.all([
        prisma.leaveRequest.findMany({
          where: filters,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            policy: {
              select: { 
                id: true, 
                name: true, 
                leaveType: true 
              },
            },
            approvedBy: {
              select: { 
                id: true, 
                firstName: true, 
                lastName: true 
              },
            },
          },
        }),
        prisma.leaveRequest.count({ where: filters }),
      ]);

      await createAuditLog(req.user.id, 'READ', 'leave_requests', null, null, null, req);

      res.json({
        status: 'success',
        data: {
          leaveRequests,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
          }
        },
      });
    } catch (error) {
      logger.error('Error fetching employee leave requests', {
        error: error.message,
        employeeId: req.params.employeeId,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * GET /api/leave-requests/summary/:employeeId - Get leave summary for an employee
 */
router.get(
  '/summary/:employeeId',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(employeeIdSchema),
  async (req, res, next) => {
    try {
      const { employeeId } = req.validatedData.params;
      const currentYear = new Date().getFullYear();

      // Check access permissions (same as employee route)
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
        throw new AppError('Access denied to this employee\'s leave summary', 403, null, 'ACCESS_DENIED');
      }

      // Get leave balances
      const leaveBalances = await prisma.leaveBalance.findMany({
        where: {
          employeeId,
          year: currentYear,
        },
        include: {
          policy: {
            select: {
              id: true,
              name: true,
              leaveType: true,
              daysAllowed: true,
            },
          },
        },
      });

      // Get leave request statistics
      const leaveStats = await prisma.leaveRequest.groupBy({
        by: ['status'],
        where: {
          employeeId,
          startDate: {
            gte: new Date(currentYear, 0, 1),
            lt: new Date(currentYear + 1, 0, 1),
          },
        },
        _count: {
          status: true,
        },
        _sum: {
          days: true,
        },
      });

      // Get recent leave requests
      const recentRequests = await prisma.leaveRequest.findMany({
        where: { employeeId },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          policy: {
            select: {
              id: true,
              name: true,
              leaveType: true,
            },
          },
        },
      });

      // Format statistics
      const statusCounts = {};
      const totalDaysByStatus = {};
      
      leaveStats.forEach(stat => {
        statusCounts[stat.status] = stat._count.status;
        totalDaysByStatus[stat.status] = stat._sum.days || 0;
      });

      const summary = {
        employeeId,
        year: currentYear,
        leaveBalances,
        statistics: {
          totalRequests: leaveStats.reduce((acc, stat) => acc + stat._count.status, 0),
          statusCounts,
          totalDaysByStatus,
          totalDaysUsed: totalDaysByStatus.APPROVED || 0,
        },
        recentRequests,
      };

      await createAuditLog(req.user.id, 'READ', 'leave_summary', employeeId, null, null, req);

      res.json({
        status: 'success',
        data: summary,
      });
    } catch (error) {
      logger.error('Error fetching leave summary', {
        error: error.message,
        employeeId: req.params.employeeId,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * GET /api/leave-requests/calendar/:employeeId - Get leave calendar data for an employee
 */
router.get(
  '/calendar/:employeeId',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(employeeIdSchema),
  async (req, res, next) => {
    try {
      const { employeeId } = req.validatedData.params;
      const rawQuery = req.query || {};

      // Check access permissions
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
        throw new AppError('Access denied to this employee\'s leave calendar', 403, null, 'ACCESS_DENIED');
      }

      // Parse date range (default to current year)
      const currentYear = new Date().getFullYear();
      const year = safeParseInt(rawQuery.year, currentYear, 2000, 2100);
      const month = safeParseInt(rawQuery.month, null, 1, 12);

      let startDate, endDate;

      if (month) {
        // Get specific month
        startDate = new Date(year, month - 1, 1);
        endDate = new Date(year, month, 0); // Last day of the month
      } else {
        // Get entire year
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
      }

      // Get leave requests for the period
      const leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: { in: ['APPROVED', 'PENDING'] },
          OR: [
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: startDate } }
              ]
            }
          ]
        },
        include: {
          policy: {
            select: {
              id: true,
              name: true,
              leaveType: true,
            },
          },
        },
        orderBy: { startDate: 'asc' },
      });

      // Format for calendar display
      const calendarData = leaveRequests.map(request => ({
        id: request.id,
        title: `${request.policy.leaveType} - ${request.policy.name}`,
        start: request.startDate,
        end: new Date(request.endDate.getTime() + 24 * 60 * 60 * 1000), // Add 1 day for calendar display
        status: request.status,
        days: request.days,
        reason: request.reason,
        leaveType: request.policy.leaveType,
        color: getLeaveTypeColor(request.policy.leaveType),
      }));

      await createAuditLog(req.user.id, 'READ', 'leave_calendar', employeeId, null, null, req);

      res.json({
        status: 'success',
        data: {
          employeeId,
          period: {
            year,
            month,
            startDate,
            endDate,
          },
          leaveRequests: calendarData,
        },
      });
    } catch (error) {
      logger.error('Error fetching leave calendar', {
        error: error.message,
        employeeId: req.params.employeeId,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * Helper function to get color for leave types
 */
function getLeaveTypeColor(leaveType) {
  const colors = {
    ANNUAL: '#3498db',
    SICK: '#e74c3c',
    MATERNITY: '#f39c12',
    PATERNITY: '#f39c12',
    EMERGENCY: '#e67e22',
    UNPAID: '#95a5a6',
    SABBATICAL: '#9b59b6',
  };
  return colors[leaveType] || '#7f8c8d';
}

/**
 * POST /api/leave-requests/bulk-approve - Bulk approve leave requests
 */
router.post(
  '/bulk-approve',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  async (req, res, next) => {
    try {
      const { requestIds } = req.body;

      if (!Array.isArray(requestIds) || requestIds.length === 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Request IDs array is required and cannot be empty',
          code: 'INVALID_INPUT'
        });
      }

      // Validate all IDs are UUIDs
      const invalidIds = requestIds.filter(id => !isValidUUID(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid request ID format',
          code: 'INVALID_UUID',
          invalidIds
        });
      }

      const userRole = req.user.role.toUpperCase();
      const results = [];
      const errors = [];

      // Process each request
      for (const requestId of requestIds) {
        try {
          const existingRequest = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: {
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  managerId: true,
                },
              },
            },
          });

          if (!existingRequest) {
            errors.push({
              requestId,
              error: 'Leave request not found',
            });
            continue;
          }

          if (existingRequest.status !== 'PENDING') {
            errors.push({
              requestId,
              error: 'Only pending requests can be approved',
            });
            continue;
          }

          // Check permission for this specific request
          let hasPermission = false;
          if (userRole === 'ADMIN' || userRole === 'HR') {
            hasPermission = true;
          } else if (userRole === 'MANAGER' && req.user.employee) {
            hasPermission = existingRequest.employee.managerId === req.user.employee.id;
          }

          if (!hasPermission) {
            errors.push({
              requestId,
              error: 'Access denied to approve this request',
            });
            continue;
          }

          // Approve the request
          const result = await prisma.$transaction(async (tx) => {
            const updatedRequest = await tx.leaveRequest.update({
              where: { id: requestId },
              data: {
                status: 'APPROVED',
                approvedAt: new Date(),
                approvedById: req.user.employee?.id,
              },
            });

            // Update leave balance
            const currentYear = new Date().getFullYear();
            const leaveBalance = await tx.leaveBalance.findFirst({
              where: {
                employeeId: existingRequest.employeeId,
                policyId: existingRequest.policyId,
                year: currentYear,
              },
            });

            if (leaveBalance) {
              if (leaveBalance.remaining < existingRequest.days) {
                throw new Error('Insufficient leave balance');
              }

              await tx.leaveBalance.update({
                where: { id: leaveBalance.id },
                data: {
                  used: { increment: existingRequest.days },
                  remaining: { decrement: existingRequest.days },
                },
              });
            }

            return updatedRequest;
          });

          results.push({
            requestId,
            status: 'approved',
            data: result,
          });

          // Log audit
          await createAuditLog(
            req.user.id,
            'UPDATE',
            'leave_requests',
            requestId,
            existingRequest,
            result,
            req
          );
        } catch (error) {
          errors.push({
            requestId,
            error: error.message,
          });
        }
      }

      res.json({
        status: 'success',
        message: `Processed ${requestIds.length} requests`,
        data: {
          approved: results,
          errors,
          summary: {
            total: requestIds.length,
            successful: results.length,
            failed: errors.length,
          },
        },
      });
    } catch (error) {
      logger.error('Error in bulk approve', {
        error: error.message,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

export default router;