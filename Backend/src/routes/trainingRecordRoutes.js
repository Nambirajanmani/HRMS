import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { trainingRecordService } from '../services/trainingRecordService.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

// Validation schemas
const trainingRecordSchemas = {
  create: z.object({
    body: z.object({
      employeeId: z.string().uuid('Invalid employee ID'),
      programId: z.string().uuid('Invalid program ID'),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid record ID') }),
    body: z.object({
      startedAt: z.string().datetime().optional(),
      completedAt: z.string().datetime().optional(),
      score: z.number().min(0).max(100).optional(),
      certificate: z.string().url().optional(),
      notes: z.string().optional(),
    }),
  }),
  getAll: z.object({
    query: z.object({
      page: z.string().regex(/^\d+$/).optional().default('1'),
      limit: z.string().regex(/^\d+$/).optional().default('10'),
      employeeId: z.string().uuid('Invalid employee ID').optional(),
      programId: z.string().uuid('Invalid program ID').optional(),
      search: z.string().optional(),
    }),
  }),
};

// GET / - List records
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(trainingRecordSchemas.getAll),
  async (req, res, next) => {
    try {
      const { page, limit, employeeId, programId, search } = req.validatedData.query;
      
      const result = await trainingRecordService.getTrainingRecords({
        userRole: req.user.role,
        userId: req.user.employee?.id,
        page: parseInt(page),
        limit: parseInt(limit),
        employeeId,
        programId,
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

// GET /:id - Get record details
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      
      const record = await trainingRecordService.getTrainingRecordById({
        id,
        userRole: req.user.role,
        userId: req.user.employee?.id
      });

      res.json({ success: true, data: { record } });
    } catch (error) {
      next(error);
    }
  }
);

// POST / - Create record
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(trainingRecordSchemas.create),
  async (req, res, next) => {
    try {
      const record = await trainingRecordService.createTrainingRecord({
        data: req.validatedData.body,
        userRole: req.user.role,
        req
      });

      res.status(201).json({
        success: true,
        message: 'Training record created successfully',
        data: { record },
      });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id - Update record
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(trainingRecordSchemas.update),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const record = await trainingRecordService.updateTrainingRecord({
        id,
        data: req.validatedData.body,
        userRole: req.user.role,
        req
      });

      res.json({
        success: true,
        message: 'Training record updated successfully',
        data: { record },
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id - Delete record
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  async (req, res, next) => {
    try {
      const { id } = req.params;

      await trainingRecordService.deleteTrainingRecord({
        id,
        userRole: req.user.role,
        req
      });

      res.json({
        success: true,
        message: 'Training record deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;