import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { AppError, ValidationError, NotFoundError } from '../utils/errors.js';
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

// Simplified validation schema for listing - let the route handle parameter processing
const listSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.undefined()]).optional(),
    limit: z.union([z.string(), z.undefined()]).optional(),
    status: z.union([z.string(), z.undefined()]).optional(),
    departmentId: z.union([z.string(), z.undefined()]).optional(),
    employmentType: z.union([z.string(), z.undefined()]).optional(),
    search: z.union([z.string(), z.undefined()]).optional(),
  }),
});

// Validation schemas
const jobPostingSchemas = {
  create: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
      description: z.string().min(1, 'Description is required').max(5000, 'Description too long'),
      requirements: z.array(z.string()).optional().default([]),
      departmentId: z.string().uuid('Invalid department ID').optional(),
      positionId: z.string().uuid('Invalid position ID').optional(),
      salaryMin: z.number().min(0, 'Minimum salary must be non-negative').optional(),
      salaryMax: z.number().min(0, 'Maximum salary must be non-negative').optional(),
      location: z.string().max(200, 'Location too long').optional(),
      employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT']).default('FULL_TIME'),
      status: z.enum(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED', 'CANCELLED']).default('OPEN'),
      expiresAt: z.string().datetime('Invalid expiration date format').optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid job posting ID') }),
    body: z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
      description: z.string().min(1, 'Description is required').max(5000, 'Description too long').optional(),
      requirements: z.array(z.string()).optional(),
      departmentId: z.string().uuid('Invalid department ID').optional(),
      positionId: z.string().uuid('Invalid position ID').optional(),
      salaryMin: z.number().min(0, 'Minimum salary must be non-negative').optional(),
      salaryMax: z.number().min(0, 'Maximum salary must be non-negative').optional(),
      location: z.string().max(200, 'Location too long').optional(),
      employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT']).optional(),
      status: z.enum(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED', 'CANCELLED']).optional(),
      expiresAt: z.string().datetime('Invalid expiration date format').optional(),
    }),
  }),
  getById: z.object({
    params: z.object({ id: z.string().uuid('Invalid job posting ID') }),
  }),
};

/**
 * GET /api/job-postings - List job postings with pagination and filtering
 * 
 * Public endpoint for job seekers (shows only open positions)
 * Authenticated users (ADMIN, HR, MANAGER) can see all postings with filters
 */
router.get('/', async (req, res, next) => {
  try {
    // Manual parameter processing with proper error handling
    const rawQuery = req.query || {};
    
    // Process pagination parameters
    const page = safeParseInt(rawQuery.page, 1, 1, 1000);
    const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
    
    // Process search parameter
    const search = isEmpty(rawQuery.search) ? null : rawQuery.search.trim();
    
    // Process departmentId with UUID validation
    let departmentId = null;
    if (!isEmpty(rawQuery.departmentId)) {
      const deptId = rawQuery.departmentId.trim();
      if (!isValidUUID(deptId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid department ID format',
          code: 'INVALID_DEPARTMENT_ID'
        });
      }
      departmentId = deptId;
    }
    
    // Process status with validation
    const validStatuses = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'CLOSED', 'CANCELLED'];
    let status = null;
    if (!isEmpty(rawQuery.status)) {
      const statusValue = rawQuery.status.trim().toUpperCase();
      if (!validStatuses.includes(statusValue)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status',
          code: 'INVALID_STATUS',
          validValues: validStatuses
        });
      }
      status = statusValue;
    }
    
    // Process employment type with validation
    const validTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN', 'CONSULTANT'];
    let employmentType = null;
    if (!isEmpty(rawQuery.employmentType)) {
      const type = rawQuery.employmentType.trim().toUpperCase();
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid employment type',
          code: 'INVALID_EMPLOYMENT_TYPE',
          validValues: validTypes
        });
      }
      employmentType = type;
    }
    
    // Build filters object
    const where = {};
    
    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (employmentType) where.employmentType = employmentType;
    
    // Add search functionality
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // For public access, only show open positions that haven't expired
    if (!req.user) {
      where.status = 'OPEN';
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gte: new Date() } }
      ];
    }

    // Execute database queries with error handling
    let postings = [];
    let total = 0;

    try {
      [postings, total] = await Promise.all([
        prisma.jobPosting.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            department: {
              select: { id: true, name: true },
            },
            position: {
              select: { id: true, title: true, level: true },
            },
            _count: {
              select: { applications: true },
            },
          },
          orderBy: { postedAt: 'desc' },
        }),
        prisma.jobPosting.count({ where }),
      ]);
    } catch (dbError) {
      logger.error('Database error in job posting query', {
        error: dbError.message,
        stack: dbError.stack,
        where,
        userId: req.user?.id
      });
      throw new AppError('Database query failed', 500, null, 'DATABASE_ERROR');
    }

    // Log audit trail for authenticated users
    try {
      if (req.user?.id) {
        await createAuditLog(req.user.id, 'READ', 'job_postings', null, null, null, req);
      }
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id 
      });
    }

    res.json({
      success: true,
      data: {
        postings,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching job postings', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id,
      query: req.query,
      url: req.url
    });
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to fetch job postings', 500, null, 'SERVER_ERROR'));
    }
  }
});

/**
 * GET /api/job-postings/:id - Get job posting details
 * 
 * Public endpoint that shows open positions to everyone
 * Authenticated HR/ADMIN users can see applications
 */
router.get('/:id', validate(jobPostingSchemas.getById), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    
    const posting = await prisma.jobPosting.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true },
        },
        position: {
          select: { id: true, title: true, level: true, description: true },
        },
        applications: req.user && ['ADMIN', 'HR'].includes(req.user.role) ? {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            email: true, 
            status: true, 
            appliedAt: true 
          },
          orderBy: { appliedAt: 'desc' },
        } : false,
      },
    });

    if (!posting) {
      throw new NotFoundError('Job posting not found', null, 'NOT_FOUND');
    }

    // For public access, only show open positions that haven't expired
    if (!req.user) {
      const isExpired = posting.expiresAt && posting.expiresAt < new Date();
      if (posting.status !== 'OPEN' || isExpired) {
        throw new NotFoundError('Job posting not found', null, 'NOT_FOUND');
      }
    }

    // Log audit trail for authenticated users
    try {
      if (req.user?.id) {
        await createAuditLog(req.user.id, 'READ', 'job_postings', id, null, null, req);
      }
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        postingId: id 
      });
    }

    res.json({ success: true, data: { posting } });
  } catch (error) {
    logger.error('Error fetching job posting', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * POST /api/job-postings - Create job posting
 * 
 * Creates a new job posting with validation for department, position, and salary range
 * Accessible only to ADMIN and HR roles
 */
router.post('/', authenticate, authorize('ADMIN', 'HR'), validate(jobPostingSchemas.create), async (req, res, next) => {
  try {
    const postingData = req.validatedData.body;

    // Validate department exists if provided
    if (postingData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: postingData.departmentId, isActive: true },
      });
      if (!department) {
        throw new ValidationError('Department not found or inactive', null, 'DEPARTMENT_NOT_FOUND');
      }
    }

    // Validate position exists if provided
    if (postingData.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: postingData.positionId, isActive: true },
      });
      if (!position) {
        throw new ValidationError('Position not found or inactive', null, 'POSITION_NOT_FOUND');
      }
    }

    // Validate salary range
    if (postingData.salaryMin && postingData.salaryMax && postingData.salaryMin > postingData.salaryMax) {
      throw new ValidationError('Minimum salary cannot be greater than maximum salary', null, 'INVALID_SALARY_RANGE');
    }

    // Validate expiration date is in the future
    if (postingData.expiresAt) {
      const expirationDate = new Date(postingData.expiresAt);
      if (expirationDate <= new Date()) {
        throw new ValidationError('Expiration date must be in the future', null, 'INVALID_EXPIRATION_DATE');
      }
    }

    const formattedData = {
      ...postingData,
      expiresAt: postingData.expiresAt ? new Date(postingData.expiresAt) : null,
      postedAt: new Date(),
      createdById: req.user.id,
    };

    const posting = await prisma.jobPosting.create({
      data: formattedData,
      include: {
        department: {
          select: { id: true, name: true },
        },
        position: {
          select: { id: true, title: true, level: true },
        },
      },
    });

    await createAuditLog(req.user.id, 'CREATE', 'job_postings', posting.id, null, posting, req);

    res.status(201).json({
      success: true,
      message: 'Job posting created successfully',
      data: { posting },
    });
  } catch (error) {
    logger.error('Error creating job posting', { 
      error: error.message,
      userId: req.user?.id,
      data: req.body
    });
    next(error);
  }
});

/**
 * PUT /api/job-postings/:id - Update job posting
 * 
 * Updates an existing job posting with validation
 * Accessible only to ADMIN and HR roles
 */
router.put('/:id', authenticate, authorize('ADMIN', 'HR'), validate(jobPostingSchemas.update), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    const updateData = req.validatedData.body;

    const existingPosting = await prisma.jobPosting.findUnique({ where: { id } });
    if (!existingPosting) {
      throw new NotFoundError('Job posting not found', null, 'NOT_FOUND');
    }

    // Validate department exists if provided
    if (updateData.departmentId) {
      const department = await prisma.department.findUnique({
        where: { id: updateData.departmentId, isActive: true },
      });
      if (!department) {
        throw new ValidationError('Department not found or inactive', null, 'DEPARTMENT_NOT_FOUND');
      }
    }

    // Validate position exists if provided
    if (updateData.positionId) {
      const position = await prisma.position.findUnique({
        where: { id: updateData.positionId, isActive: true },
      });
      if (!position) {
        throw new ValidationError('Position not found or inactive', null, 'POSITION_NOT_FOUND');
      }
    }

    // Validate salary range
    const salaryMin = updateData.salaryMin !== undefined ? updateData.salaryMin : existingPosting.salaryMin;
    const salaryMax = updateData.salaryMax !== undefined ? updateData.salaryMax : existingPosting.salaryMax;
    if (salaryMin && salaryMax && salaryMin > salaryMax) {
      throw new ValidationError('Minimum salary cannot be greater than maximum salary', null, 'INVALID_SALARY_RANGE');
    }

    // Validate expiration date is in the future (if being updated)
    if (updateData.expiresAt) {
      const expirationDate = new Date(updateData.expiresAt);
      if (expirationDate <= new Date()) {
        throw new ValidationError('Expiration date must be in the future', null, 'INVALID_EXPIRATION_DATE');
      }
    }

    const formattedData = {
      ...updateData,
      expiresAt: updateData.expiresAt ? new Date(updateData.expiresAt) : undefined,
      closedAt: updateData.status === 'CLOSED' && existingPosting.status !== 'CLOSED' ? new Date() : undefined,
      updatedById: req.user.id,
    };

    const posting = await prisma.jobPosting.update({
      where: { id },
      data: formattedData,
      include: {
        department: {
          select: { id: true, name: true },
        },
        position: {
          select: { id: true, title: true, level: true },
        },
      },
    });

    await createAuditLog(req.user.id, 'UPDATE', 'job_postings', id, existingPosting, posting, req);

    res.json({
      success: true,
      message: 'Job posting updated successfully',
      data: { posting },
    });
  } catch (error) {
    logger.error('Error updating job posting', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * DELETE /api/job-postings/:id - Delete job posting
 * 
 * Deletes a job posting only if it has no applications
 * Otherwise suggests closing the posting instead
 * Accessible only to ADMIN and HR roles
 */
router.delete('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid job posting ID format', null, 'INVALID_ID');
    }

    const existingPosting = await prisma.jobPosting.findUnique({
      where: { id },
      include: {
        applications: {
          select: { id: true },
        },
      },
    });

    if (!existingPosting) {
      throw new NotFoundError('Job posting not found', null, 'NOT_FOUND');
    }

    // Check if there are applications
    if (existingPosting.applications.length > 0) {
      throw new ValidationError(
        'Cannot delete job posting with applications. Close it instead.',
        null,
        'HAS_APPLICATIONS'
      );
    }

    await prisma.jobPosting.delete({ where: { id } });

    await createAuditLog(req.user.id, 'DELETE', 'job_postings', id, existingPosting, null, req);

    res.json({
      success: true,
      message: 'Job posting deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting job posting', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

export default router;