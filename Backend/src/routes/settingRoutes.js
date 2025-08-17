// src/routes/settingRoutes.js - Updated version based on employeeRoutes.js patterns
import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
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

// Helper function to check if string is empty or just whitespace
const isEmpty = (str) => {
  return !str || typeof str !== 'string' || str.trim() === '';
};

// Validation schemas
const settingSchemas = {
  create: z.object({
    body: z.object({
      key: z.string().min(1, 'Key is required').max(100, 'Key too long'),
      value: z.string().min(1, 'Value is required').max(1000, 'Value too long'),
      description: z.string().max(500, 'Description too long').optional(),
      category: z.string().max(50, 'Category too long').optional(),
      isPublic: z.boolean().optional().default(false),
    }),
  }),
  update: z.object({
    params: z.object({ 
      id: z.string().uuid('Invalid setting ID') 
    }),
    body: z.object({
      key: z.string().min(1, 'Key is required').max(100, 'Key too long').optional(),
      value: z.string().min(1, 'Value is required').max(1000, 'Value too long').optional(),
      description: z.string().max(500, 'Description too long').optional(),
      category: z.string().max(50, 'Category too long').optional(),
      isPublic: z.boolean().optional(),
    }),
  }),
  getById: z.object({
    params: z.object({ 
      id: z.string().uuid('Invalid setting ID') 
    }),
  }),
  delete: z.object({
    params: z.object({ 
      id: z.string().uuid('Invalid setting ID') 
    }),
  }),
};

/**
 * GET /api/settings - Get all settings with pagination and filtering
 * 
 * Returns a paginated list of settings with optional filtering by category and visibility.
 * Accessible only to ADMIN roles.
 */
router.get('/', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    // Manual parameter processing with proper error handling
    const rawQuery = req.query || {};
    
    // Process pagination parameters
    const page = safeParseInt(rawQuery.page, 1, 1, 1000);
    const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
    
    // Process category parameter
    const category = isEmpty(rawQuery.category) ? null : rawQuery.category.trim();
    
    // Process isPublic parameter with validation
    let isPublic = null;
    if (!isEmpty(rawQuery.isPublic)) {
      const publicValue = rawQuery.isPublic.trim().toLowerCase();
      if (publicValue !== 'true' && publicValue !== 'false') {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid isPublic value. Must be true or false',
          code: 'INVALID_IS_PUBLIC'
        });
      }
      isPublic = publicValue === 'true';
    }
    
    // Build filters object - only include non-null values
    const filters = {};
    
    if (category) {
      filters.category = category;
    }
    
    if (isPublic !== null) {
      filters.isPublic = isPublic;
    }

    // Execute database queries with error handling
    let settings = [];
    let total = 0;

    try {
      [settings, total] = await Promise.all([
        prisma.setting.findMany({
          where: filters,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { key: 'asc' },
          select: {
            id: true,
            key: true,
            value: true,
            description: true,
            category: true,
            isPublic: true,
            createdAt: true,
            updatedAt: true,
            createdBy: {
              select: { id: true, firstName: true, lastName: true }
            },
            updatedBy: {
              select: { id: true, firstName: true, lastName: true }
            }
          }
        }),
        prisma.setting.count({ where: filters }),
      ]);
    } catch (dbError) {
      logger.error('Database error in settings query', {
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
        await createAuditLog(req.user.id, 'READ', 'settings', null, null, null, req);
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
        settings,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit)
        }
      },
    });
  } catch (error) {
    logger.error('Error fetching settings', { 
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
      next(new AppError('Failed to fetch settings', 500, null, 'SERVER_ERROR'));
    }
  }
});

/**
 * GET /api/settings/:id - Get setting details
 * 
 * Returns detailed information about a specific setting.
 * Accessible only to ADMIN roles.
 */
router.get('/:id', authenticate, authorize('ADMIN'), validate(settingSchemas.getById), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    
    const setting = await prisma.setting.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    if (!setting) {
      throw new AppError('Setting not found', 404, null, 'NOT_FOUND');
    }

    // Log audit trail
    try {
      await createAuditLog(req.user.id, 'READ', 'settings', id, null, null, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        settingId: id
      });
    }

    res.json({ 
      status: 'success', 
      data: setting 
    });
  } catch (error) {
    logger.error('Error fetching setting', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * POST /api/settings - Create setting
 * 
 * Creates a new setting with validation for unique keys.
 * Accessible only to ADMIN roles.
 */
router.post('/', authenticate, authorize('ADMIN'), validate(settingSchemas.create), async (req, res, next) => {
  try {
    const { key, value, description, category, isPublic } = req.validatedData.body;

    // Check if setting key already exists
    const existingSetting = await prisma.setting.findFirst({
      where: { key },
    });
    
    if (existingSetting) {
      throw new ValidationError('Setting key already exists', null, 'DUPLICATE_SETTING_KEY');
    }

    // Create the setting
    const setting = await prisma.setting.create({
      data: {
        key,
        value,
        description,
        category,
        isPublic,
        createdById: req.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    // Log audit trail
    try {
      await createAuditLog(req.user.id, 'CREATE', 'settings', setting.id, null, setting, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        settingId: setting.id
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Setting created successfully',
      data: setting,
    });
  } catch (error) {
    logger.error('Error creating setting', { 
      error: error.message,
      userId: req.user?.id,
      requestBody: req.body
    });
    next(error);
  }
});

/**
 * PUT /api/settings/:id - Update setting
 * 
 * Updates an existing setting with validation for unique keys.
 * Accessible only to ADMIN roles.
 */
router.put('/:id', authenticate, authorize('ADMIN'), validate(settingSchemas.update), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    const updateData = req.validatedData.body;

    // Check if setting exists
    const existingSetting = await prisma.setting.findUnique({ 
      where: { id } 
    });
    
    if (!existingSetting) {
      throw new AppError('Setting not found', 404, null, 'NOT_FOUND');
    }

    // Check key uniqueness if key is being updated
    if (updateData.key && updateData.key !== existingSetting.key) {
      const keyConflict = await prisma.setting.findFirst({
        where: { 
          key: updateData.key,
          id: { not: id } // Exclude current setting from check
        },
      });
      if (keyConflict) {
        throw new ValidationError('Setting key already exists', null, 'DUPLICATE_SETTING_KEY');
      }
    }

    // Update the setting
    const setting = await prisma.setting.update({
      where: { id },
      data: {
        ...updateData,
        updatedById: req.user.id,
      },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        updatedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    // Log audit trail
    try {
      await createAuditLog(req.user.id, 'UPDATE', 'settings', id, existingSetting, setting, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        settingId: id
      });
    }

    res.json({
      status: 'success',
      message: 'Setting updated successfully',
      data: setting,
    });
  } catch (error) {
    logger.error('Error updating setting', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id,
      requestBody: req.body
    });
    next(error);
  }
});

/**
 * DELETE /api/settings/:id - Delete setting
 * 
 * Permanently deletes a setting from the database.
 * Accessible only to ADMIN roles.
 */
router.delete('/:id', authenticate, authorize('ADMIN'), validate(settingSchemas.delete), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;

    // Check if setting exists
    const existingSetting = await prisma.setting.findUnique({ 
      where: { id },
      include: {
        createdBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
    
    if (!existingSetting) {
      throw new AppError('Setting not found', 404, null, 'NOT_FOUND');
    }

    // Delete the setting
    await prisma.setting.delete({ where: { id } });

    // Log audit trail
    try {
      await createAuditLog(req.user.id, 'DELETE', 'settings', id, existingSetting, null, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        settingId: id
      });
    }

    res.json({
      status: 'success',
      message: 'Setting deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting setting', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * GET /api/settings/public - Get public settings
 * 
 * Returns all public settings (isPublic: true) without pagination.
 * This endpoint can be accessed without authentication for public configuration.
 */
router.get('/public', async (req, res, next) => {
  try {
    const publicSettings = await prisma.setting.findMany({
      where: { isPublic: true },
      select: {
        id: true,
        key: true,
        value: true,
        description: true,
        category: true,
      },
      orderBy: { key: 'asc' },
    });

    res.json({
      status: 'success',
      data: publicSettings,
    });
  } catch (error) {
    logger.error('Error fetching public settings', { 
      error: error.message, 
      stack: error.stack
    });
    next(new AppError('Failed to fetch public settings', 500, null, 'SERVER_ERROR'));
  }
});

/**
 * GET /api/settings/categories - Get all setting categories
 * 
 * Returns a list of all unique categories used in settings.
 * Accessible only to ADMIN roles.
 */
router.get('/categories', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const categories = await prisma.setting.findMany({
      where: {
        category: { not: null }
      },
      select: {
        category: true,
      },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    const categoryList = categories
      .map(setting => setting.category)
      .filter(category => category && category.trim() !== '');

    res.json({
      status: 'success',
      data: categoryList,
    });
  } catch (error) {
    logger.error('Error fetching setting categories', { 
      error: error.message,
      userId: req.user?.id 
    });
    next(new AppError('Failed to fetch setting categories', 500, null, 'SERVER_ERROR'));
  }
});

export default router;