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

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && email.trim() !== '' && emailRegex.test(email.trim());
};

// Simplified validation schema for listing - let the route handle parameter processing
const listSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.undefined()]).optional(),
    limit: z.union([z.string(), z.undefined()]).optional(),
    jobPostingId: z.union([z.string(), z.undefined()]).optional(),
    status: z.union([z.string(), z.undefined()]).optional(),
    search: z.union([z.string(), z.undefined()]).optional(),
  }),
});

// Validation Schemas
const jobApplicationSchemas = {
  create: z.object({
    body: z.object({
      jobPostingId: z.string().uuid('Invalid job posting ID'),
      firstName: z.string().min(1, 'First name is required').max(50, 'First name too long'),
      lastName: z.string().min(1, 'Last name is required').max(50, 'Last name too long'),
      email: z.string().email('Invalid email format'),
      phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, 'Invalid phone format').optional(),
      resumeUrl: z.string().url('Invalid resume URL format').optional(),
      coverLetter: z.string().max(2000, 'Cover letter too long').optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid application ID') }),
    body: z.object({
      status: z.enum(['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'REJECTED']).optional(),
      notes: z.string().max(1000, 'Notes too long').optional(),
      rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5').optional(),
      screenedAt: z.string().datetime('Invalid screened date format').optional(),
      interviewedAt: z.string().datetime('Invalid interviewed date format').optional(),
    }),
  }),
  getById: z.object({
    params: z.object({ id: z.string().uuid('Invalid application ID') }),
  }),
};

/**
 * GET /api/job-applications - List job applications with pagination and filtering
 * 
 * Returns a paginated list of job applications with optional filtering.
 * Accessible to ADMIN and HR roles only.
 * Includes related job posting and interview information.
 */
router.get('/', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  try {
    // Manual parameter processing with proper error handling
    const rawQuery = req.query || {};
    
    // Process pagination parameters
    const page = safeParseInt(rawQuery.page, 1, 1, 1000);
    const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
    
    // Process search parameter
    const search = isEmpty(rawQuery.search) ? null : rawQuery.search.trim();
    
    // Process jobPostingId with UUID validation
    let jobPostingId = null;
    if (!isEmpty(rawQuery.jobPostingId)) {
      const postingId = rawQuery.jobPostingId.trim();
      if (!isValidUUID(postingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid job posting ID format',
          code: 'INVALID_JOB_POSTING_ID'
        });
      }
      jobPostingId = postingId;
    }
    
    // Process status with validation
    const validStatuses = ['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'REJECTED'];
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
    
    // Build filters object
    const where = {};
    
    if (jobPostingId) where.jobPostingId = jobPostingId;
    if (status) where.status = status;
    
    // Add search functionality
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { jobPosting: { title: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Execute database queries with error handling
    let applications = [];
    let total = 0;

    try {
      [applications, total] = await Promise.all([
        prisma.jobApplication.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            jobPosting: {
              select: { 
                id: true, 
                title: true, 
                status: true,
                department: { select: { id: true, name: true } } 
              },
            },
            interviews: {
              select: { 
                id: true, 
                scheduledAt: true, 
                status: true, 
                type: true,
                rating: true 
              },
              orderBy: { scheduledAt: 'desc' },
            },
          },
          orderBy: { appliedAt: 'desc' },
        }),
        prisma.jobApplication.count({ where }),
      ]);
    } catch (dbError) {
      logger.error('Database error in job application query', {
        error: dbError.message,
        stack: dbError.stack,
        where,
        userId: req.user?.id
      });
      throw new AppError('Database query failed', 500, null, 'DATABASE_ERROR');
    }

    // Log audit trail
    try {
      if (req.user?.id) {
        await createAuditLog(req.user.id, 'READ', 'job_applications', null, null, null, req);
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
        applications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching job applications', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id,
      query: req.query,
      url: req.url
    });
    
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError('Failed to fetch job applications', 500, null, 'SERVER_ERROR'));
    }
  }
});

/**
 * GET /api/job-applications/:id - Get job application details
 * 
 * Returns detailed information about a specific job application including:
 * - Application details
 * - Related job posting information
 * - Interview history and feedback
 * 
 * Accessible to ADMIN and HR roles only.
 */
router.get('/:id', authenticate, authorize('ADMIN', 'HR'), validate(jobApplicationSchemas.getById), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    
    const application = await prisma.jobApplication.findUnique({
      where: { id },
      include: {
        jobPosting: {
          select: { 
            id: true, 
            title: true, 
            description: true, 
            status: true,
            department: { select: { id: true, name: true } },
            position: { select: { id: true, title: true, level: true } }
          },
        },
        interviews: {
          select: { 
            id: true, 
            scheduledAt: true, 
            duration: true, 
            location: true, 
            type: true, 
            status: true, 
            feedback: true, 
            rating: true,
            interviewerName: true,
            createdAt: true
          },
          orderBy: { scheduledAt: 'desc' },
        },
      },
    });

    if (!application) {
      throw new NotFoundError('Job application not found', null, 'NOT_FOUND');
    }

    // Log audit trail
    try {
      if (req.user?.id) {
        await createAuditLog(req.user.id, 'READ', 'job_applications', id, null, null, req);
      }
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        applicationId: id 
      });
    }

    res.json({ success: true, data: { application } });
  } catch (error) {
    logger.error('Error fetching job application', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * POST /api/job-applications - Create job application (Public endpoint)
 * 
 * Creates a new job application with validation for:
 * - Valid job posting that is open and not expired
 * - No duplicate applications for the same email/job posting
 * - Required applicant information
 * 
 * Public endpoint accessible without authentication.
 */
router.post('/', validate(jobApplicationSchemas.create), async (req, res, next) => {
  try {
    const { jobPostingId, firstName, lastName, email, phone, resumeUrl, coverLetter } = req.validatedData.body;

    // Validate job posting exists and is open
    const jobPosting = await prisma.jobPosting.findUnique({
      where: { id: jobPostingId },
      select: {
        id: true,
        title: true,
        status: true,
        expiresAt: true
      }
    });

    if (!jobPosting) {
      throw new ValidationError('Job posting not found', null, 'JOB_POSTING_NOT_FOUND');
    }

    if (jobPosting.status !== 'OPEN') {
      throw new ValidationError('Job posting is not accepting applications', null, 'JOB_POSTING_CLOSED');
    }

    if (jobPosting.expiresAt && jobPosting.expiresAt < new Date()) {
      throw new ValidationError('Job posting has expired', null, 'JOB_POSTING_EXPIRED');
    }

    // Check for duplicate application
    const existingApplication = await prisma.jobApplication.findFirst({
      where: { 
        jobPostingId, 
        email: email.toLowerCase().trim() 
      },
    });
    
    if (existingApplication) {
      throw new ValidationError(
        'You have already applied for this position', 
        null, 
        'DUPLICATE_APPLICATION'
      );
    }

    // Create the application
    const applicationData = {
      jobPostingId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : null,
      resumeUrl: resumeUrl ? resumeUrl.trim() : null,
      coverLetter: coverLetter ? coverLetter.trim() : null,
      status: 'APPLIED',
      appliedAt: new Date(),
    };

    const application = await prisma.jobApplication.create({
      data: applicationData,
      include: {
        jobPosting: {
          select: { id: true, title: true },
        },
      },
    });

    // Log the application creation (no user context for public endpoint)
    logger.info('New job application created', {
      applicationId: application.id,
      jobPostingId: jobPostingId,
      applicantEmail: email,
      jobTitle: jobPosting.title
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { 
        application: {
          id: application.id,
          jobPosting: application.jobPosting,
          firstName: application.firstName,
          lastName: application.lastName,
          email: application.email,
          status: application.status,
          appliedAt: application.appliedAt
        }
      },
    });
  } catch (error) {
    logger.error('Error creating job application', { 
      error: error.message,
      jobPostingId: req.body?.jobPostingId,
      email: req.body?.email
    });
    next(error);
  }
});

/**
 * PUT /api/job-applications/:id - Update job application
 * 
 * Updates an existing job application with validation for:
 * - Valid status transitions
 * - Proper date formats
 * - Rating within valid range
 * 
 * Accessible to ADMIN and HR roles only.
 */
router.put('/:id', authenticate, authorize('ADMIN', 'HR'), validate(jobApplicationSchemas.update), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    const updateData = req.validatedData.body;

    const existingApplication = await prisma.jobApplication.findUnique({ 
      where: { id },
      include: {
        jobPosting: {
          select: { id: true, title: true, status: true }
        }
      }
    });
    
    if (!existingApplication) {
      throw new NotFoundError('Job application not found', null, 'NOT_FOUND');
    }
// Validate status transitions
if (updateData.status) {
  const validTransitions = {
    'APPLIED': ['SCREENING', 'REJECTED'],
    'SCREENING': ['INTERVIEW', 'REJECTED'],
    'INTERVIEW': ['ASSESSMENT', 'OFFER', 'REJECTED'],
    'ASSESSMENT': ['OFFER', 'REJECTED'],
    'OFFER': ['HIRED', 'REJECTED'],
    'HIRED': [], // Final state
    'REJECTED': [] // Final state
  };

  const currentStatus = existingApplication.status;
  const newStatus = updateData.status;

  if (
    currentStatus !== newStatus &&
    !validTransitions[currentStatus]?.includes(newStatus)
  ) {
    throw new ValidationError(
      `Invalid status transition from ${currentStatus} to ${newStatus}`,
      null,
      'INVALID_STATUS_TRANSITION'
    );
  }
}

    // Process date fields and auto-set timestamps based on status
    const formattedData = { ...updateData };
    
    if (updateData.screenedAt) {
      formattedData.screenedAt = new Date(updateData.screenedAt);
    } else if (updateData.status === 'SCREENING' && !existingApplication.screenedAt) {
      formattedData.screenedAt = new Date();
    }
    
    if (updateData.interviewedAt) {
      formattedData.interviewedAt = new Date(updateData.interviewedAt);
    } else if (updateData.status === 'INTERVIEW' && !existingApplication.interviewedAt) {
      formattedData.interviewedAt = new Date();
    }

    // Add updatedById tracking
    formattedData.updatedById = req.user.id;

    const application = await prisma.jobApplication.update({
      where: { id },
      data: formattedData,
      include: {
        jobPosting: {
          select: { id: true, title: true, status: true },
        },
        interviews: {
          select: { id: true, scheduledAt: true, status: true, type: true },
          orderBy: { scheduledAt: 'desc' },
          take: 3
        },
      },
    });

    await createAuditLog(req.user.id, 'UPDATE', 'job_applications', id, existingApplication, application, req);

    res.json({
      success: true,
      message: 'Job application updated successfully',
      data: { application },
    });
  } catch (error) {
    logger.error('Error updating job application', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * DELETE /api/job-applications/:id - Delete job application
 * 
 * Deletes a job application and all related interviews.
 * Validates that user has permission to delete.
 * 
 * Accessible to ADMIN and HR roles only.
 */
router.delete('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      throw new ValidationError('Invalid job application ID format', null, 'INVALID_ID');
    }

    const existingApplication = await prisma.jobApplication.findUnique({
      where: { id },
      include: {
        interviews: {
          select: { id: true, scheduledAt: true, status: true },
        },
        jobPosting: {
          select: { id: true, title: true }
        }
      },
    });

    if (!existingApplication) {
      throw new NotFoundError('Job application not found', null, 'NOT_FOUND');
    }
// Check if application is in a state that allows deletion
const nonDeletableStatuses = ['HIRED'];
if (nonDeletableStatuses.includes(existingApplication.status)) {
  throw new ValidationError(
    `Cannot delete application with status: ${existingApplication.status}`,
    null,
    'INVALID_DELETE_STATUS'
  );
}

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Delete related interviews first
      if (existingApplication.interviews.length > 0) {
        await tx.interview.deleteMany({
          where: { applicationId: id },
        });
      }

      // Delete the application
      await tx.jobApplication.delete({ 
        where: { id } 
      });
    });

    await createAuditLog(req.user.id, 'DELETE', 'job_applications', id, existingApplication, null, req);

    logger.info('Job application deleted', {
      applicationId: id,
      jobTitle: existingApplication.jobPosting.title,
      applicantEmail: existingApplication.email,
      deletedBy: req.user.id,
      interviewsDeleted: existingApplication.interviews.length
    });

    res.json({
      success: true,
      message: 'Job application deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting job application', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

export default router;