import express from 'express';
import { z } from 'zod';
import { authenticate, authorize, authorizeEmployee } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { AppError, ValidationError } from '../utils/errors.js';
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

// Validation schemas - Updated to match actual database schema
const onboardingTaskSchemas = {
  create: z.object({
    body: z.object({
      templateId: z.string().uuid('Invalid template ID').optional(),
      employeeId: z.string().uuid('Invalid employee ID').optional(),
      assigneeId: z.string().uuid('Invalid assignee ID').optional(),
      title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
      description: z.string().max(1000, 'Description too long').optional(),
      dueDate: z.string().datetime('Invalid date format').optional(),
      sortOrder: z.number().min(0, 'Sort order must be non-negative').max(9999, 'Sort order too large').optional().default(0),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid task ID') }),
    body: z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
      description: z.string().max(1000, 'Description too long').optional(),
      dueDate: z.string().datetime('Invalid date format').optional(),
      status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
      notes: z.string().max(2000, 'Notes too long').optional(),
      sortOrder: z.number().min(0, 'Sort order must be non-negative').max(9999, 'Sort order too large').optional(),
      completedAt: z.string().datetime('Invalid date format').optional(),
      assigneeId: z.string().uuid('Invalid assignee ID').optional(),
    }),
  }),
  idSchema: z.object({
    params: z.object({
      id: z.string().uuid('Invalid task ID'),
    }),
  }),
  bulkUpdateSchema: z.object({
    body: z.object({
      taskIds: z.array(z.string().uuid('Invalid task ID')).min(1, 'At least one task ID required').max(100, 'Too many task IDs'),
      updates: z.object({
        status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
        assigneeId: z.string().uuid('Invalid assignee ID').optional(),
        dueDate: z.string().datetime('Invalid date format').optional(),
      }),
    }),
  }),
};

/**
 * GET /api/onboarding-tasks - Get all onboarding tasks with pagination and filtering
 */
router.get('/', authenticate, authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const rawQuery = req.query || {};
    const page = safeParseInt(rawQuery.page, 1, 1, 1000);
    const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
    const search = isEmpty(rawQuery.search) ? null : rawQuery.search.trim();
    
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
    
    let templateId = null;
    if (!isEmpty(rawQuery.templateId)) {
      const tplId = rawQuery.templateId.trim();
      if (!isValidUUID(tplId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid template ID format',
          code: 'INVALID_TEMPLATE_ID'
        });
      }
      templateId = tplId;
    }
    
    let assigneeId = null;
    if (!isEmpty(rawQuery.assigneeId)) {
      const asgId = rawQuery.assigneeId.trim();
      if (!isValidUUID(asgId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid assignee ID format',
          code: 'INVALID_ASSIGNEE_ID'
        });
      }
      assigneeId = asgId;
    }
    
    // Updated valid statuses to match schema
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    let status = null;
    if (!isEmpty(rawQuery.status)) {
      const statusValue = rawQuery.status.trim().toUpperCase();
      if (!validStatuses.includes(statusValue)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid task status',
          code: 'INVALID_STATUS',
          validValues: validStatuses
        });
      }
      status = statusValue;
    }
    
    let dueDateFrom = null;
    let dueDateTo = null;
    if (!isEmpty(rawQuery.dueDateFrom)) {
      try {
        dueDateFrom = new Date(rawQuery.dueDateFrom);
        if (isNaN(dueDateFrom.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid dueDateFrom format',
            code: 'INVALID_DATE_FROM'
          });
        }
      } catch (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid dueDateFrom format',
          code: 'INVALID_DATE_FROM'
        });
      }
    }
    
    if (!isEmpty(rawQuery.dueDateTo)) {
      try {
        dueDateTo = new Date(rawQuery.dueDateTo);
        if (isNaN(dueDateTo.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid dueDateTo format',
            code: 'INVALID_DATE_TO'
          });
        }
      } catch (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid dueDateTo format',
          code: 'INVALID_DATE_TO'
        });
      }
    }
    
    const overdue = rawQuery.overdue === 'true';
    
    const filters = {};
    
    if (employeeId) {
      filters.employeeId = employeeId;
    }
    
    if (templateId) {
      filters.templateId = templateId;
    }
    
    if (assigneeId) {
      filters.assigneeId = assigneeId;
    }
    
    if (status) {
      filters.status = status;
    }
    
    if (dueDateFrom || dueDateTo) {
      filters.dueDate = {};
      if (dueDateFrom) {
        filters.dueDate.gte = dueDateFrom;
      }
      if (dueDateTo) {
        const endOfDay = new Date(dueDateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filters.dueDate.lte = endOfDay;
      }
    }
    
    if (overdue) {
      filters.dueDate = {
        ...filters.dueDate,
        lt: new Date(),
      };
      filters.status = {
        in: ['PENDING', 'IN_PROGRESS']
      };
    }
    
    if (search) {
      filters.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (req.user && req.user.role) {
      const userRole = req.user.role.toUpperCase();
      if (userRole === 'EMPLOYEE' && req.user.employee) {
        filters.employeeId = req.user.employee.id;
      } else if (userRole === 'MANAGER' && req.user.employee) {
        try {
          const subordinates = await prisma.employee.findMany({
            where: { managerId: req.user.employee.id },
            select: { id: true },
          });
          const subordinateIds = subordinates.map(sub => sub.id);
          subordinateIds.push(req.user.employee.id);
          
          if (!employeeId) {
            filters.employeeId = { in: subordinateIds };
          } else if (!subordinateIds.includes(employeeId)) {
            return res.status(403).json({
              status: 'error',
              message: 'Access denied to tasks for this employee',
              code: 'ACCESS_DENIED'
            });
          }
        } catch (managerError) {
          logger.error('Error fetching manager subordinates for tasks', { 
            error: managerError.message,
            userId: req.user.id,
            managerId: req.user.employee?.id
          });
        }
      }
    }

    let tasks = [];
    let total = 0;

    try {
      [tasks, total] = await Promise.all([
        prisma.onboardingTask.findMany({
          where: filters,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            template: {
              select: { id: true, name: true, description: true },
            },
            employee: {
              select: { 
                id: true, 
                firstName: true, 
                lastName: true, 
                employeeId: true,
                hireDate: true,
                department: { select: { name: true } },
                position: { select: { title: true } }
              },
            },
            assignee: {
              select: { 
                id: true, 
                firstName: true, 
                lastName: true,
                department: { select: { name: true } }
              },
            },
          },
          // Updated orderBy to use fields that exist in the schema
          orderBy: [
            { dueDate: 'asc' },
            { sortOrder: 'asc' }, 
            { createdAt: 'asc' }
          ],
        }),
        prisma.onboardingTask.count({ where: filters }),
      ]);
    } catch (dbError) {
      logger.error('Database error in onboarding task query', {
        error: dbError.message,
        stack: dbError.stack,
        filters,
        userId: req.user?.id
      });
      throw new AppError('Database query failed', 500, null, 'DATABASE_ERROR');
    }

    let metrics = {};
    try {
      if (req.user.role !== 'EMPLOYEE') {
        const metricsFilters = { ...filters };
        delete metricsFilters.OR;
        
        metrics = await prisma.onboardingTask.aggregate({
          where: metricsFilters,
          _count: {
            id: true,
          },
        });

        const statusCounts = await prisma.onboardingTask.groupBy({
          by: ['status'],
          where: metricsFilters,
          _count: {
            id: true,
          },
        });

        metrics.statusBreakdown = statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {});
      }
    } catch (metricsError) {
      logger.warn('Error calculating metrics', { 
        error: metricsError.message,
        userId: req.user?.id 
      });
      metrics = {};
    }

    try {
      if (req.user?.id) {
        await createAuditLog(req.user.id, 'READ', 'onboarding_tasks', null, null, null, req);
      }
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id 
      });
    }

    res.json({
      status: 'success',
      data: {
        tasks,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
        filters: {
          employeeId,
          templateId,
          assigneeId,
          status,
          dueDateFrom,
          dueDateTo,
          search,
          overdue,
        },
        metrics,
      },
    });
  } catch (error) {
    logger.error('Error fetching onboarding tasks', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id,
      query: req.query,
      url: req.url
    });
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to fetch onboarding tasks', 500, null, 'SERVER_ERROR'));
    }
  }
});

/**
 * GET /api/onboarding-tasks/:id - Get onboarding task details
 */
router.get('/:id', authenticate, authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'), validate(onboardingTaskSchemas.idSchema), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    
    const task = await prisma.onboardingTask.findUnique({
      where: { id },
      include: {
        template: {
          select: { 
            id: true, 
            name: true, 
            description: true,
          },
        },
        employee: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            employeeId: true,
            email: true,
            hireDate: true,
            department: { select: { id: true, name: true } },
            position: { select: { id: true, title: true } },
            manager: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        assignee: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true,
            email: true,
            department: { select: { name: true } },
            position: { select: { title: true } },
          },
        },
      },
    });

    if (!task) {
      throw new AppError('Onboarding task not found', 404, null, 'NOT_FOUND');
    }

    const userRole = req.user.role?.toUpperCase();
    if (userRole === 'EMPLOYEE') {
      if (req.user.employee?.id !== task.employeeId && req.user.employee?.id !== task.assigneeId) {
        throw new AppError('Access denied to this task', 403, null, 'ACCESS_DENIED');
      }
    } else if (userRole === 'MANAGER' && req.user.employee) {
      const subordinates = await prisma.employee.findMany({
        where: { managerId: req.user.employee.id },
        select: { id: true },
      });
      const subordinateIds = subordinates.map(sub => sub.id);
      subordinateIds.push(req.user.employee.id);
      
      if (!subordinateIds.includes(task.employeeId) && task.assigneeId !== req.user.employee.id) {
        throw new AppError('Access denied to this task', 403, null, 'ACCESS_DENIED');
      }
    }

    try {
      await createAuditLog(req.user.id, 'READ', 'onboarding_tasks', id, null, null, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        taskId: id
      });
    }

    res.json({
      status: 'success',
      data: { task },
    });
  } catch (error) {
    logger.error('Error fetching onboarding task', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * POST /api/onboarding-tasks - Create onboarding task
 */
router.post('/', authenticate, authorize('ADMIN', 'HR'), validate(onboardingTaskSchemas.create), async (req, res, next) => {
  try {
    const { 
      templateId, 
      employeeId, 
      assigneeId, 
      title, 
      description, 
      dueDate, 
      sortOrder
    } = req.validatedData.body;

    if (templateId) {
      const template = await prisma.onboardingTemplate.findUnique({
        where: { id: templateId, isActive: true },
      });
      if (!template) {
        throw new ValidationError('Onboarding template not found or inactive', null, 'TEMPLATE_NOT_FOUND');
      }
    }

    if (employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId, employmentStatus: { in: ['ACTIVE', 'PROBATION'] } },
      });
      if (!employee) {
        throw new ValidationError('Employee not found or not in active/probation status', null, 'EMPLOYEE_NOT_FOUND');
      }
    }

    if (assigneeId) {
      const assignee = await prisma.employee.findUnique({
        where: { id: assigneeId, employmentStatus: 'ACTIVE' },
      });
      if (!assignee) {
        throw new ValidationError('Assignee not found or inactive', null, 'ASSIGNEE_NOT_FOUND');
      }
    }

    if (dueDate) {
      const dueDateObj = new Date(dueDate);
      const now = new Date();
      if (dueDateObj <= now) {
        throw new ValidationError('Due date must be in the future', null, 'INVALID_DUE_DATE');
      }
    }

    if (employeeId) {
      const existingTask = await prisma.onboardingTask.findFirst({
        where: {
          employeeId,
          title,
          status: { in: ['PENDING', 'IN_PROGRESS'] }
        },
      });

      if (existingTask) {
        throw new ValidationError(
          'A task with the same title already exists for this employee',
          null,
          'DUPLICATE_TASK'
        );
      }
    }

    const task = await prisma.onboardingTask.create({
      data: {
        templateId,
        employeeId,
        assigneeId,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder,
        status: 'PENDING',
      },
      include: {
        template: {
          select: { id: true, name: true },
        },
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    try {
      await createAuditLog(req.user.id, 'CREATE', 'onboarding_tasks', task.id, null, task, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        taskId: task.id
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Onboarding task created successfully',
      data: { task },
    });
  } catch (error) {
    logger.error('Error creating onboarding task', { 
      error: error.message,
      userId: req.user?.id,
      data: req.body
    });
    next(error);
  }
});
/**
 * PUT /api/onboarding-tasks/:id - Update onboarding task
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(onboardingTaskSchemas.update),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingTask = await prisma.onboardingTask.findUnique({
        where: { id },
        include: {
          employee: { select: { id: true, managerId: true } },
        },
      });

      if (!existingTask) {
        throw new AppError('Onboarding task not found', 404, null, 'NOT_FOUND');
      }

      const userRole = req.user.role?.toUpperCase();

      // Employee permissions check
      if (userRole === 'EMPLOYEE') {
        if (
          req.user.employee?.id !== existingTask.assigneeId &&
          req.user.employee?.id !== existingTask.employeeId
        ) {
          throw new AppError(
            'Access denied to update this task',
            403,
            null,
            'ACCESS_DENIED'
          );
        }

        const allowedFields = ['status', 'notes', 'completedAt'];
        const attemptedFields = Object.keys(updateData);
        const unauthorizedFields = attemptedFields.filter(
          (field) => !allowedFields.includes(field)
        );

        if (unauthorizedFields.length > 0) {
          throw new AppError(
            `Employees cannot update these fields: ${unauthorizedFields.join(', ')}`,
            403,
            null,
            'INSUFFICIENT_PERMISSIONS'
          );
        }
      }
      // Manager permissions check
      else if (userRole === 'MANAGER' && req.user.employee) {
        const subordinates = await prisma.employee.findMany({
          where: { managerId: req.user.employee.id },
          select: { id: true },
        });
        const subordinateIds = subordinates.map((sub) => sub.id);
        subordinateIds.push(req.user.employee.id);

        if (
          !subordinateIds.includes(existingTask.employeeId) &&
          existingTask.assigneeId !== req.user.employee.id
        ) {
          throw new AppError(
            'Access denied to update this task',
            403,
            null,
            'ACCESS_DENIED'
          );
        }
      }

      // Status validation
      if (updateData.status) {
        const validTransitions = {
          PENDING: ['IN_PROGRESS', 'CANCELLED'],
          IN_PROGRESS: ['COMPLETED', 'PENDING', 'CANCELLED'],
          COMPLETED: ['IN_PROGRESS'],
          CANCELLED: ['PENDING', 'IN_PROGRESS'],
        };

        const currentStatus = existingTask.status;
        const newStatus = updateData.status;

        if (
          currentStatus !== newStatus &&
          !validTransitions[currentStatus]?.includes(newStatus)
        ) {
          throw new ValidationError(
            `Invalid status transition from ${currentStatus} to ${newStatus}`,
            null,
            'INVALID_STATUS_TRANSITION'
          );
        }

        if (newStatus === 'COMPLETED' && !updateData.completedAt) {
          updateData.completedAt = new Date().toISOString();
        }

        if (currentStatus === 'COMPLETED' && newStatus !== 'COMPLETED') {
          updateData.completedAt = null;
        }
      }

      // Due date validation
      if (updateData.dueDate) {
        const dueDateObj = new Date(updateData.dueDate);
        const now = new Date();
        if (dueDateObj <= now) {
          throw new ValidationError(
            'Due date must be in the future',
            null,
            'INVALID_DUE_DATE'
          );
        }
      }

      // Assignee validation
      if (updateData.assigneeId) {
        const assignee = await prisma.employee.findFirst({
          where: { id: updateData.assigneeId, employmentStatus: 'ACTIVE' },
        });
        if (!assignee) {
          throw new ValidationError(
            'Assignee not found or inactive',
            null,
            'ASSIGNEE_NOT_FOUND'
          );
        }
      }

      // Prepare processed data
      const processedData = { ...updateData };
      if (updateData.dueDate) {
        processedData.dueDate = new Date(updateData.dueDate);
      }
      if (updateData.completedAt) {
        processedData.completedAt = new Date(updateData.completedAt);
      }

      const updatedTask = await prisma.onboardingTask.update({
        where: { id },
        data: processedData,
        include: {
          template: {
            select: { id: true, name: true, description: true },
          },
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: { select: { name: true } },
              position: { select: { title: true } },
            },
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: { select: { name: true } },
            },
          },
        },
      });

      // Audit log
      try {
        await createAuditLog(
          req.user.id,
          'UPDATE',
          'onboarding_tasks',
          id,
          existingTask,
          updatedTask,
          req
        );
      } catch (auditError) {
        logger.warn('Audit log creation failed', {
          error: auditError.message,
          userId: req.user?.id,
          taskId: id,
        });
      }

      res.json({
        status: 'success',
        message: 'Onboarding task updated successfully',
        data: { task: updatedTask },
      });
    } catch (error) {
      logger.error('Error updating onboarding task', {
        error: error.message,
        id: req.params.id,
        userId: req.user?.id,
        data: req.body,
      });
      next(error);
    }
  }
);
/**
 * DELETE /api/onboarding-tasks/:id - Soft delete onboarding task
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(onboardingTaskSchemas.idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const { force } = req.query;

      const existingTask = await prisma.onboardingTask.findUnique({
        where: { id },
        include: {
          employee: { select: { firstName: true, lastName: true } },
        },
      });

      if (!existingTask) {
        throw new AppError('Onboarding task not found', 404, null, 'NOT_FOUND');
      }

      if (existingTask.status === 'CANCELLED') {
        throw new ValidationError('Task is already cancelled', null, 'ALREADY_CANCELLED');
      }

      if (existingTask.status === 'COMPLETED' && force !== 'true') {
        throw new ValidationError(
          'Cannot delete completed tasks. Use force=true query parameter to override.',
          null,
          'CANNOT_DELETE_COMPLETED'
        );
      }

      const cancelledNote = `[CANCELLED by ${req.user.firstName} ${req.user.lastName} on ${new Date().toISOString()}]`;
      const cancelledTask = await prisma.onboardingTask.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: existingTask.notes
            ? `${existingTask.notes}\n\n${cancelledNote}`
            : cancelledNote,
        },
      });

      try {
        await createAuditLog(
          req.user.id,
          'DELETE',
          'onboarding_tasks',
          id,
          existingTask,
          cancelledTask,
          req
        );
      } catch (auditError) {
        logger.warn('Audit log creation failed', {
          error: auditError.message,
          userId: req.user?.id,
          taskId: id,
        });
      }

      res.json({
        status: 'success',
        message: 'Onboarding task cancelled successfully',
        data: { task: cancelledTask },
      });
    } catch (error) {
      logger.error('Error deleting onboarding task', {
        error: error.message,
        id: req.params.id,
        userId: req.user?.id,
      });
      next(error);
    }
  }
);

/**
 * POST /api/onboarding-tasks/bulk-update - Bulk update multiple onboarding tasks
 */
router.post(
  '/bulk-update',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  validate(onboardingTaskSchemas.bulkUpdateSchema),
  async (req, res, next) => {
    try {
      const { taskIds, updates } = req.validatedData.body;

      const existingTasks = await prisma.onboardingTask.findMany({
        where: { id: { in: taskIds } },
        include: {
          employee: { select: { id: true, managerId: true, firstName: true, lastName: true } },
        },
      });

      if (existingTasks.length !== taskIds.length) {
        const foundIds = existingTasks.map(task => task.id);
        const missingIds = taskIds.filter(id => !foundIds.includes(id));
        throw new ValidationError(
          `Tasks not found: ${missingIds.join(', ')}`,
          null,
          'TASKS_NOT_FOUND'
        );
      }

      const userRole = req.user.role?.toUpperCase();
      if (userRole === 'MANAGER' && req.user.employee) {
        const subordinates = await prisma.employee.findMany({
          where: { managerId: req.user.employee.id },
          select: { id: true },
        });

        const subordinateIds = subordinates.map(sub => sub.id);
        subordinateIds.push(req.user.employee.id);

        const unauthorizedTasks = existingTasks.filter(
          task =>
            !subordinateIds.includes(task.employeeId) &&
            task.assigneeId !== req.user.employee.id
        );

        if (unauthorizedTasks.length > 0) {
          throw new AppError(
            `Access denied to tasks: ${unauthorizedTasks.map(t => t.id).join(', ')}`,
            403,
            null,
            'ACCESS_DENIED'
          );
        }
      }

      if ('assigneeId' in updates && updates.assigneeId) {
        const assignee = await prisma.employee.findFirst({
          where: { id: updates.assigneeId, employmentStatus: 'ACTIVE' },
        });
        if (!assignee) {
          throw new ValidationError('Assignee not found or inactive', null, 'ASSIGNEE_NOT_FOUND');
        }
      }

      if ('status' in updates && updates.status) {
        const validTransitions = {
          PENDING: ['IN_PROGRESS', 'CANCELLED'],
          IN_PROGRESS: ['COMPLETED', 'PENDING', 'CANCELLED'],
          COMPLETED: ['IN_PROGRESS'],
          CANCELLED: ['PENDING', 'IN_PROGRESS'],
        };

        for (const task of existingTasks) {
          const currentStatus = task.status;
          const newStatus = updates.status;
          if (
            currentStatus !== newStatus &&
            !validTransitions[currentStatus]?.includes(newStatus)
          ) {
            throw new ValidationError(
              `Invalid status transition from ${currentStatus} to ${newStatus} for task ${task.id}`,
              null,
              'INVALID_STATUS_TRANSITION'
            );
          }
        }
      }

      const processedUpdates = { ...updates };
      if (updates.dueDate) {
        processedUpdates.dueDate = new Date(updates.dueDate);
      }
      if (updates.status === 'COMPLETED') {
        processedUpdates.completedAt = new Date();
      }

      const result = await prisma.onboardingTask.updateMany({
        where: { id: { in: taskIds } },
        data: processedUpdates,
      });

      const finalTasks = await prisma.onboardingTask.findMany({
        where: { id: { in: taskIds } },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
            },
          },
          assignee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      try {
        for (const task of existingTasks) {
          const updatedTask = finalTasks.find(t => t.id === task.id);
          await createAuditLog(
            req.user.id,
            'BULK_UPDATE',
            'onboarding_tasks',
            task.id,
            task,
            updatedTask,
            req
          );
        }
      } catch (auditError) {
        logger.warn('Audit log creation failed for bulk update', {
          error: auditError.message,
          userId: req.user?.id,
          taskCount: taskIds.length,
        });
      }

      res.json({
        status: 'success',
        message: `Successfully updated ${result.count} onboarding tasks`,
        data: {
          updatedCount: result.count,
          tasks: finalTasks,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/onboarding-tasks/employee/:employeeId/summary - Get task summary for specific employee
 */
router.get('/employee/:employeeId/summary', authenticate, authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'), async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!isValidUUID(employeeId)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid employee ID format',
        code: 'INVALID_EMPLOYEE_ID'
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { 
        id: true, 
        firstName: true, 
        lastName: true, 
        employeeId: true,
        managerId: true,
        hireDate: true
      },
    });

    if (!employee) {
      throw new AppError('Employee not found', 404, null, 'EMPLOYEE_NOT_FOUND');
    }

    const userRole = req.user.role?.toUpperCase();
    if (userRole === 'EMPLOYEE') {
      if (req.user.employee?.id !== employeeId) {
        throw new AppError('Access denied to this employee summary', 403, null, 'ACCESS_DENIED');
      }
    } else if (userRole === 'MANAGER' && req.user.employee) {
      const subordinates = await prisma.employee.findMany({
        where: { managerId: req.user.employee.id },
        select: { id: true },
      });
      const subordinateIds = subordinates.map(sub => sub.id);
      subordinateIds.push(req.user.employee.id);
      
      if (!subordinateIds.includes(employeeId)) {
        throw new AppError('Access denied to this employee summary', 403, null, 'ACCESS_DENIED');
      }
    }

    const [taskCounts, overdueTasks, recentActivity] = await Promise.all([
      prisma.onboardingTask.groupBy({
        by: ['status'],
        where: { employeeId },
        _count: { id: true },
      }),
      
      prisma.onboardingTask.count({
        where: {
          employeeId,
          dueDate: { lt: new Date() },
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }),
      
      prisma.onboardingTask.findMany({
        where: { employeeId },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      }),
    ]);

    const statusBreakdown = taskCounts.reduce((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    const totalTasks = taskCounts.reduce((sum, item) => sum + item._count.id, 0);
    const completedTasks = statusBreakdown.COMPLETED || 0;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const daysSinceHire = employee.hireDate 
      ? Math.floor((new Date() - new Date(employee.hireDate)) / (1000 * 60 * 60 * 24))
      : null;

    try {
      await createAuditLog(req.user.id, 'READ', 'onboarding_task_summary', employeeId, null, null, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        employeeId
      });
    }

    res.json({
      status: 'success',
      data: {
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          employeeId: employee.employeeId,
          hireDate: employee.hireDate,
          daysSinceHire,
        },
        summary: {
          totalTasks,
          completedTasks,
          progressPercentage,
          overdueTasks,
          statusBreakdown,
        },
        recentActivity,
      },
    });
  } catch (error) {
    logger.error('Error fetching onboarding task summary', { 
      error: error.message, 
      employeeId: req.params.employeeId,
      userId: req.user?.id 
    });
    next(error);
  }
});

export default router;