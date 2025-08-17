import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { AppError, ValidationError } from '../utils/errors.js';
import prisma from '../config/prisma.js';

const router = express.Router();

// Validation schema
const disciplinaryActionSchemas = {
  create: z.object({
    body: z.object({
      employeeId: z.string().uuid('Invalid employee ID'),
      type: z.string().min(1, 'Type is required'),
      reason: z.string().min(1, 'Reason is required'),
      description: z.string().optional(),
      actionDate: z.string().datetime().optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      followUpDate: z.string().datetime().optional(),
      documents: z.array(z.string()).optional().default([]),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid action ID') }),
    body: z.object({
      type: z.string().min(1, 'Type is required').optional(),
      reason: z.string().min(1, 'Reason is required').optional(),
      description: z.string().optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
      followUpDate: z.string().datetime().optional(),
      resolution: z.string().optional(),
      documents: z.array(z.string()).optional(),
    }),
  }),
  getAll: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).optional().default('1'),
      limit: z.string().regex(/^\d+$/).optional().default('10'),
      employeeId: z.string().uuid('Invalid employee ID').optional(),
      type: z.string().optional(),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    }),
  }),
};

// GET / - List actions
router.get('/', authenticate, authorize('ADMIN', 'HR'), validate(disciplinaryActionSchemas.getAll), async (req, res, next) => {
  try {
    const { page, limit, employeeId, type, severity } = req.validatedData.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (type) where.type = type;
    if (severity) where.severity = severity;

    const [actions, total] = await Promise.all([
      prisma.disciplinaryAction.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true },
          },
          issuedBy: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { actionDate: 'desc' },
      }),
      prisma.disciplinaryAction.count({ where }),
    ]);

    await createAuditLog(req.user.id, 'READ', 'disciplinary_actions', null, null, null, req);

    res.json({
      success: true,
      data: {
        actions,
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

// GET /:id - Get action details
router.get('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const action = await prisma.disciplinaryAction.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
        issuedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!action) throw new AppError('Disciplinary action not found', 404);

    await createAuditLog(req.user.id, 'READ', 'disciplinary_actions', id, null, null, req);

    res.json({ success: true, data: { action } });
  } catch (error) {
    next(error);
  }
});

// POST / - Create action
router.post('/', authenticate, authorize('ADMIN', 'HR'), validate(disciplinaryActionSchemas.create), async (req, res, next) => {
  try {
    const { employeeId, type, reason, description, actionDate, severity, followUpDate, documents } = req.validatedData.body;

    // Validate employee exists
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) throw new ValidationError('Employee not found');

    const action = await prisma.disciplinaryAction.create({
      data: {
        employeeId,
        issuedById: req.user.employee?.id,
        type,
        reason,
        description,
        actionDate: actionDate ? new Date(actionDate) : new Date(),
        severity,
        followUpDate: followUpDate ? new Date(followUpDate) : null,
        documents,
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
        issuedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await createAuditLog(req.user.id, 'CREATE', 'disciplinary_actions', action.id, null, action, req);

    res.status(201).json({
      success: true,
      message: 'Disciplinary action created successfully',
      data: { action },
    });
  } catch (error) {
    next(error);
  }
});

// PUT /:id - Update action
router.put('/:id', authenticate, authorize('ADMIN', 'HR'), validate(disciplinaryActionSchemas.update), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    const updateData = req.validatedData.body;

    const existingAction = await prisma.disciplinaryAction.findUnique({ where: { id } });
    if (!existingAction) throw new AppError('Disciplinary action not found', 404);

    const formattedData = {
      ...updateData,
      followUpDate: updateData.followUpDate ? new Date(updateData.followUpDate) : undefined,
    };

    const action = await prisma.disciplinaryAction.update({
      where: { id },
      data: formattedData,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true },
        },
        issuedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    await createAuditLog(req.user.id, 'UPDATE', 'disciplinary_actions', id, existingAction, action, req);

    res.json({
      success: true,
      message: 'Disciplinary action updated successfully',
      data: { action },
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /:id - Delete action
router.delete('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const existingAction = await prisma.disciplinaryAction.findUnique({ where: { id } });
    if (!existingAction) throw new AppError('Disciplinary action not found', 404);

    await prisma.disciplinaryAction.delete({ where: { id } });

    await createAuditLog(req.user.id, 'DELETE', 'disciplinary_actions', id, existingAction, null, req);

    res.json({
      success: true,
      message: 'Disciplinary action deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
