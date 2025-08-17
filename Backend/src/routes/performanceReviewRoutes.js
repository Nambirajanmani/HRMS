import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import performanceReviewService from '../services/performanceReviewService.js';

const router = express.Router();

// Validation schemas
const performanceReviewSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  reviewerId: z.string().uuid('Invalid reviewer ID'),
  overallRating: z.enum(['OUTSTANDING', 'SATISFACTORY', 'NEEDS_IMPROVEMENT', 'UNSATISFACTORY']).optional(),
});

const performanceReviewUpdateSchema = performanceReviewSchema.partial();

// GET /: List reviews
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  async (req, res, next) => {
    try {
      const { page = 1, limit = 10, employeeId, status } = req.query;
      const reviews = await performanceReviewService.getPerformanceReviews({
        userRole: req.user.role,
        userId: req.user.employee?.id,
        page: Number(page),
        limit: Number(limit),
        employeeId,
        status,
      });
      res.json({ success: true, data: reviews });
    } catch (error) {
      next(error);
    }
  }
);

// GET /:id: Get review details
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  async (req, res, next) => {
    try {
      const review = await performanceReviewService.getPerformanceReviewById({
        id: req.params.id,
        userRole: req.user.role,
        userId: req.user.employee?.id,
      });
      res.json({ success: true, data: review });
    } catch (error) {
      next(error);
    }
  }
);

// POST /: Create review
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  validate(z.object({ body: performanceReviewSchema })),
  async (req, res, next) => {
    try {
      const newReview = await performanceReviewService.createPerformanceReview({
        data: req.body,
        userRole: req.user.role,
      });
      res.status(201).json({ success: true, data: newReview });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /:id: Update review
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  validate(z.object({ body: performanceReviewUpdateSchema })),
  async (req, res, next) => {
    try {
      const updatedReview = await performanceReviewService.updatePerformanceReview({
        id: req.params.id,
        data: req.body,
        userRole: req.user.role,
      });
      res.json({ success: true, data: updatedReview });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /:id: Delete review
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  async (req, res, next) => {
    try {
      await performanceReviewService.deletePerformanceReview({
        id: req.params.id,
        userRole: req.user.role,
      });
      res.json({ success: true, message: 'Performance review deleted' });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
