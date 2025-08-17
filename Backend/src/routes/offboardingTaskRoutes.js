import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { AppError, ValidationError } from '../utils/errors.js';
import prisma from '../config/prisma.js';

const router = express.Router();

// Validation schema
const offboardingTaskSchemas = {
  create: z.object({
    body: z.object({
      employeeId: z.string().uuid('Invalid employee ID'),
      assigneeId: z.string().uuid('Invalid assignee ID').optional(),
      title: z.string().min(1, 'Title is required'),
      description: z.string().optional(),
      dueDate: z.string().datetime().optional(),
      sortOrder: z.number().min(0).optional().default(0),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid task ID') }),
    body: z.object({
      title: z.string().min(1, 'Title is required').optional(),
      description: z.string().optional(),
      dueDate: z.string().datetime().optional(),
      isCompleted: z.boolean().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().min(0).optional(),
    }),
  }),
  getAll: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).optional().default('1'),
      limit: z.string().regex(/^\d+$/).optional().default('10'),
      employeeId: z.string().uuid('Invalid employee ID').optional(),
      isCompleted: z.enum(['true', 'false']).optional(),
    }),
  }),
};

// GET / - List tasks
router.get('/', authenticate, authorize('ADMIN', 'HR'), validate(offboardingTaskSchemas.getAll), async (req, res, next) => {
  try {
    const { page, limit, employeeId, isCompleted } = req.validatedData.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (isCompleted !== undefined) where.isCompleted = isCompleted === 'true';

    const [tasks, total] = await Promise.all([
      prisma.offboardingTask.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
          assignee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.offboardingTask.count({ where }),
    ]);

    await createAuditLog(req.user.id, 'READ', 'offboarding_tasks', null, null, null, req);

    res.json({
      success: true,
      data: {
        tasks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /:id - Get task details
router.get('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const task = await prisma.offboardingTask.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!task) throw new AppError('Offboarding task not found', 404);

    await createAuditLog(req.user.id, 'READ', 'offboarding_tasks', id, null, null, req);

    res.json({ success: true, data: { task } });
  } catch (error) {
    next(error);
  }
});

// POST / - Create task
router.post('/', authenticate, authorize('ADMIN', 'HR'), validate(offboardingTaskSchemas.create), async (req, res, next) => {
  try {
    const { employeeId, assigneeId, title, description, dueDate, sortOrder } = req.validatedData.body;

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new ValidationError('Employee not found');

    // Validate assignee exists if provided
    if (assigneeId) {
      const assignee = await prisma.employee.findUnique({
        where: { id: assigneeId, employmentStatus: 'ACTIVE' },
      });
      if (!assignee) throw new ValidationError('Assignee not found or inactive');
    }

    const task = await prisma.offboardingTask.create({
      data: {
        employeeId,
        assigneeId,
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder,
        isCompleted: false,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await createAuditLog(req.user.id, 'CREATE', 'offboarding_tasks', task.id, null, task, req);

    res.status(201).json({
      success: true,
      message: 'Offboarding task created successfully',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /:id - Update task
router.put('/:id', authenticate, authorize('ADMIN', 'HR'), validate(offboardingTaskSchemas.update), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    const updateData = req.validatedData.body;

    const existingTask = await prisma.offboardingTask.findUnique({ where: { id } });
    if (!existingTask) throw new AppError('Offboarding task not found', 404);

    // Handle completion
    if (updateData.isCompleted && !existingTask.isCompleted) {
      updateData.completedAt = new Date();
    } else if (updateData.isCompleted === false) {
      updateData.completedAt = null;
    }

    const formattedData = {
      ...updateData,
      dueDate: updateData.dueDate ? new Date(updateData.dueDate) : undefined,
    };

    const task = await prisma.offboardingTask.update({
      where: { id },
      data: formattedData,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
        assignee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await createAuditLog(req.user.id, 'UPDATE', 'offboarding_tasks', id, existingTask, task, req);

    res.json({
      success: true,
      message: 'Offboarding task updated successfully',
      data: { task },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Delete task
router.delete('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  const { id } = req.params;
  try {
    const { id } = req.params;

    const existingTask = await prisma.offboardingTask.findUnique({ where: { id } });
    if (!existingTask) throw new AppError('Offboarding task not found', 404);

    await prisma.offboardingTask.delete({ where: { id } });

    await createAuditLog(req.user.id, 'DELETE', 'offboarding_tasks', id, existingTask, null, req);

    res.json({
      success: true,
      message: 'Offboarding task deleted successfully',
    });
  } catch (error) {
    next(error);
  }   
});

export default router;

