import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';

const router = express.Router();

// Validation schemas
const positionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  departmentId: z.string().uuid('Invalid department ID'),
  requirements: z.array(z.string()).optional(),
  minSalary: z.number().optional(),
  isActive: z.boolean().optional(),
});

const updatePositionSchema = positionSchema.partial();

const listPositionsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).optional().default('1'),
    limit: z.string().regex(/^\d+$/).optional().default('10'),
    departmentId: z.string().uuid().optional(),
    isActive: z.enum(['true', 'false']).optional(),
  }),
});

// GET /: List positions
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  validate(listPositionsSchema),
  async (req, res) => {
    try {
      const { page, limit, departmentId, isActive } = req.validatedData.query;
      const filters = {};
      if (departmentId) filters.departmentId = departmentId;
      if (isActive) filters.isActive = isActive === 'true';

      // Simulated database query
      const positions = [];
      const total = 0;

      res.json({
        positions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /:id: Get position details
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const position = { id, title: 'Example Position' };
      if (!position) return res.status(404).json({ error: 'Position not found' });
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// POST /: Create position
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(z.object({ body: positionSchema })),
  async (req, res) => {
    try {
      const { title, departmentId, requirements, minSalary } = req.validatedData.body;
      const newPosition = { id: 'uuid', title, departmentId, requirements, minSalary, isActive: true };
      res.status(201).json(newPosition);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// PUT /:id: Update position
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(z.object({ body: updatePositionSchema })),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updatedPosition = { id, ...req.validatedData.body };
      res.json(updatedPosition);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// DELETE /:id: Soft delete position
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const position = { id, isActive: false };
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

export default router;
