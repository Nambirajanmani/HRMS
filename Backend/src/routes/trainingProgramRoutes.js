import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { trainingProgramService } from '../services/trainingProgramService.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

// Validation schemas
const trainingProgramSchemas = {
  create: z.object({
    body: z.object({
      name: z.string().min(1, 'Name is required'),
      description: z.string().optional(),
      duration: z.number().min(1, 'Duration must be at least 1 minute').optional(),
      isActive: z.boolean().optional().default(true),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid program ID') }),
    body: z.object({
      name: z.string().min(1, 'Name is required').optional(),
      description: z.string().optional(),
      duration: z.number().min(1, 'Duration must be at least 1 minute').optional(),
      isActive: z.boolean().optional(),
    }),
  }),
  getAll: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).optional().default('1'),
      limit: z.string().regex(/^\d+$/).optional().default('10'),
      isActive: z.enum(['true', 'false']).optional(),
      search: z.string().optional(),
    }),
  }),
};

// GET / - List programs
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(trainingProgramSchemas.getAll),
  async (req, res, next) => {
    try {
      const { page, limit, isActive, search } = req.validatedData.query;
      
      const result = await trainingProgramService.getTrainingPrograms({
        userRole: req.user.role,
        page: parseInt(page),
        limit: parseInt(limit),
        isActive: isActive === 'true',
        search
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id - Get program details
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const program = await trainingProgramService.getTrainingProgramById({
        id,
        userRole: req.user.role
      });

      res.json({ success: true, data: { program } });
    } catch (error) {
      next(error);
    }
  }
);

// POST / - Create program
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(trainingProgramSchemas.create),
  async (req, res, next) => {
    try {
      const program = await trainingProgramService.createTrainingProgram({
        data: req.validatedData.body,
        userRole: req.user.role,
        req
      });

      res.status(201).json({
        success: true,
        message: 'Training program created successfully',
        data: { program },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id - Update program
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(trainingProgramSchemas.update),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const program = await trainingProgramService.updateTrainingProgram({
        id,
        data: req.validatedData.body,
        userRole: req.user.role,
        req
      });

      res.json({
        success: true,
        message: 'Training program updated successfully',
        data: { program },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id - Soft delete program
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await trainingProgramService.deleteTrainingProgram({
        id,
        userRole: req.user.role,
        req
      });

      res.json({
        success: true,
        message: 'Training program deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;