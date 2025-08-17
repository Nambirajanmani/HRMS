import { performanceReviewService } from '../services/performanceReviewService.js';

export const performanceReviewController = {
  async createPerformanceReview(req, res) {
    try {
      const performanceReview = await performanceReviewService.createPerformanceReview(req.body);
      res.status(201).json({ message: 'Performance review created successfully', performanceReview });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create performance review', details: error.message });
    }
  },

  async getPerformanceReview(req, res) {
    try {
      const { id } = req.params;
      const performanceReview = await performanceReviewService.getPerformanceReview(id);
      if (!performanceReview) return res.status(404).json({ error: 'Performance review not found' });
      res.json(performanceReview);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch performance review', details: error.message });
    }
  },

  async updatePerformanceReview(req, res) {
    try {
      const { id } = req.params;
      const performanceReview = await performanceReviewService.updatePerformanceReview(id, req.body);
      res.json({ message: 'Performance review updated successfully', performanceReview });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update performance review', details: error.message });
    }
  },

  async deletePerformanceReview(req, res) {
    try {
      const { id } = req.params;
      await performanceReviewService.deletePerformanceReview(id);
      res.json({ message: 'Performance review deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete performance review', details: error.message });
    }
  },
};
import {
  getPerformanceReviews,
  getPerformanceReviewById,
  createPerformanceReview,
  updatePerformanceReview,
  deletePerformanceReview,
} from '../services/performanceReview.service';

export const getAllReviews = async (req, res, next) => {
  try {
    const { user } = req;
    const { page, limit, employeeId, status } = req.query;
    
    const result = await getPerformanceReviews({
      userRole: user.role,
      userId: user.id,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      employeeId,
      status,
    });

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
};

export const getReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const review = await getPerformanceReviewById({
      id,
      userRole: user.role,
      userId: user.id,
    });

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

export const addReview = async (req, res, next) => {
  try {
    const { user } = req;
    const review = await createPerformanceReview({
      data: req.body,
      userRole: user.role,
    });

    res.status(201).json({
      success: true,
      message: 'Performance review created successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

export const modifyReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    const review = await updatePerformanceReview({
      id,
      data: req.body,
      userRole: user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Performance review updated successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

export const removeReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { user } = req;
    
    await deletePerformanceReview({
      id,
      userRole: user.role,
    });

    res.status(200).json({
      success: true,
      message: 'Performance review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};