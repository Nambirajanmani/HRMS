import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { AppError, ValidationError } from '../utils/errors.js';
import prisma from '../config/prisma.js';

const router = express.Router();

// Validation schema
const onboardingTemplateSchemas = {
  create: z.object({
    body: z.object({
      name: z.string().min(1, 'Name is required'),
      description: z.string().optional(),
      isActive: z.boolean().optional().default(true),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid template ID') }),
    body: z.object({
      name: z.string().min(1, 'Name is required').optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  getAll: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).optional().default('1'),
      limit: z.string().regex(/^\d+$/).optional().default('10'),
      isActive: z.enum(['true', 'false']).optional(),
    }),
  }),
};

// GET / - List templates
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(onboardingTemplateSchemas.getAll),
  async (req, res, next) => {
    try {
      const { page, limit, isActive } = req.validatedData.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const where = {};
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const [templates, total] = await Promise.all([
        prisma.onboardingTemplate.findMany({
          where,
          skip,
          take: parseInt(limit),
          include: {
            tasks: {
              select: { id: true, title: true, status: true },
              orderBy: { sortOrder: 'asc' },
            },
            _count: {
              select: { tasks: true },
            },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.onboardingTemplate.count({ where }),
      ]);

      await createAuditLog(req.user.id, 'READ', 'onboarding_templates', null, null, null, req);

      res.json({
        success: true,
        data: {
          templates,
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
  }
);

// GET /:id - Get template details
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const template = await prisma.onboardingTemplate.findUnique({
        where: { id },
        include: {
          tasks: {
            orderBy: { sortOrder: 'asc' },
            include: {
              employee: {
                select: { id: true, firstName: true, lastName: true, employeeId: true },
              },
              assignee: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      if (!template) throw new AppError('Onboarding template not found', 404);

      await createAuditLog(req.user.id, 'READ', 'onboarding_templates', id, null, null, req);

      res.json({ success: true, data: { template } });
    } catch (error) {
      next(error);
    }
  }
);

// POST / - Create template
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(onboardingTemplateSchemas.create),
  async (req, res, next) => {
    try {
      const { name, description, isActive } = req.validatedData.body;

      // Check if template name already exists
      const existingTemplate = await prisma.onboardingTemplate.findFirst({
        where: { name },
      });
      if (existingTemplate) {
        throw new ValidationError('Onboarding template name already exists');
      }

      const template = await prisma.onboardingTemplate.create({
        data: {
          name,
          description,
          isActive,
        },
      });

      await createAuditLog(req.user.id, 'CREATE', 'onboarding_templates', template.id, null, template, req);

      res.status(201).json({
        success: true,
        message: 'Onboarding template created successfully',
        data: { template },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id - Update template
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(onboardingTemplateSchemas.update),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingTemplate = await prisma.onboardingTemplate.findUnique({ where: { id } });
      if (!existingTemplate) throw new AppError('Onboarding template not found', 404);

      // Check name uniqueness if name is being updated
      if (updateData.name && updateData.name !== existingTemplate.name) {
        const nameConflict = await prisma.onboardingTemplate.findFirst({
          where: { name: updateData.name },
        });
        if (nameConflict) throw new ValidationError('Onboarding template name already exists');
      }

      const template = await prisma.onboardingTemplate.update({
        where: { id },
        data: updateData,
      });

      await createAuditLog(req.user.id, 'UPDATE', 'onboarding_templates', id, existingTemplate, template, req);

      res.json({
        success: true,
        message: 'Onboarding template updated successfully',
        data: { template },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id - Soft delete template
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      const existingTemplate = await prisma.onboardingTemplate.findUnique({
        where: { id },
        include: {
          tasks: {
            where: { status: { in: ['PENDING', 'IN_PROGRESS'] } },
          },
        },
      });

      if (!existingTemplate) throw new AppError('Onboarding template not found', 404);

      // Check if template has active tasks
      if (existingTemplate.tasks.length > 0) {
        throw new ValidationError('Cannot delete template with active tasks');
      }

      const template = await prisma.onboardingTemplate.update({
        where: { id },
        data: { isActive: false },
      });

      await createAuditLog(req.user.id, 'DELETE', 'onboarding_templates', id, existingTemplate, template, req);

      res.json({
        success: true,
        message: 'Onboarding template deleted successfully',
        data: { template },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
