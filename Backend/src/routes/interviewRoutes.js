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

// Helper function to validate UUID
const isValidUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === 'string' && uuid.trim() !== '' && uuidRegex.test(uuid);
};

// Helper function to check if string is empty or just whitespace
const isEmpty = (str) => {
  return !str || typeof str !== 'string' || str.trim() === '';
};

// Validation Schemas
const interviewSchemas = {
  create: z.object({
    body: z.object({
      applicationId: z.string().uuid('Invalid application ID'),
      scheduledAt: z.string().datetime('Invalid date format'),
      duration: z.number().min(15, 'Duration must be at least 15 minutes').max(480, 'Duration cannot exceed 8 hours').default(60),
      location: z.string().min(1, 'Location is required').max(200, 'Location too long').optional(),
      type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON', 'PANEL', 'TECHNICAL', 'BEHAVIORAL']).default('IN_PERSON'),
      interviewers: z.array(z.string().uuid('Invalid interviewer ID')).min(1, 'At least one interviewer is required').max(10, 'Too many interviewers').default([]),
      notes: z.string().max(1000, 'Notes too long').optional(),
    }),
  }),
  update: z.object({
    params: z.object({ id: z.string().uuid('Invalid interview ID') }),
    body: z.object({
      scheduledAt: z.string().datetime('Invalid date format').optional(),
      duration: z.number().min(15, 'Duration must be at least 15 minutes').max(480, 'Duration cannot exceed 8 hours').optional(),
      location: z.string().min(1, 'Location is required').max(200, 'Location too long').optional(),
      type: z.enum(['PHONE', 'VIDEO', 'IN_PERSON', 'PANEL', 'TECHNICAL', 'BEHAVIORAL']).optional(),
      interviewers: z.array(z.string().uuid('Invalid interviewer ID')).min(1, 'At least one interviewer is required').max(10, 'Too many interviewers').optional(),
      status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW']).optional(),
      feedback: z.string().max(2000, 'Feedback too long').optional(),
      rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5').optional(),
      notes: z.string().max(1000, 'Notes too long').optional(),
    }),
  }),
  listSchema: z.object({
    query: z.object({
      page: z.union([z.string(), z.undefined()]).optional(),
      limit: z.union([z.string(), z.undefined()]).optional(),
      applicationId: z.union([z.string(), z.undefined()]).optional(),
      status: z.union([z.string(), z.undefined()]).optional(),
      type: z.union([z.string(), z.undefined()]).optional(),
      dateFrom: z.union([z.string(), z.undefined()]).optional(),
      dateTo: z.union([z.string(), z.undefined()]).optional(),
      search: z.union([z.string(), z.undefined()]).optional(),
    }),
  }),
  idSchema: z.object({
    params: z.object({
      id: z.string().uuid('Invalid interview ID'),
    }),
  }),
};

/**
 * GET /api/interviews - Get all interviews with pagination and filtering
 * 
 * Returns a paginated list of interviews with optional filtering by:
 * - Application ID
 * - Status (scheduled, completed, cancelled, etc.)
 * - Type (phone, video, in-person, etc.)
 * - Date range
 * - Search term (candidate name, email, job title)
 * 
 * Accessible to ADMIN and HR roles.
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
    
    // Process applicationId with UUID validation
    let applicationId = null;
    if (!isEmpty(rawQuery.applicationId)) {
      const appId = rawQuery.applicationId.trim();
      if (!isValidUUID(appId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid application ID format',
          code: 'INVALID_APPLICATION_ID'
        });
      }
      applicationId = appId;
    }
    
    // Process status with validation
    const validStatuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'];
    let status = null;
    if (!isEmpty(rawQuery.status)) {
      const statusValue = rawQuery.status.trim().toUpperCase();
      if (!validStatuses.includes(statusValue)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid interview status',
          code: 'INVALID_STATUS',
          validValues: validStatuses
        });
      }
      status = statusValue;
    }
    
    // Process type with validation
    const validTypes = ['PHONE', 'VIDEO', 'IN_PERSON', 'PANEL', 'TECHNICAL', 'BEHAVIORAL'];
    let type = null;
    if (!isEmpty(rawQuery.type)) {
      const typeValue = rawQuery.type.trim().toUpperCase();
      if (!validTypes.includes(typeValue)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid interview type',
          code: 'INVALID_TYPE',
          validValues: validTypes
        });
      }
      type = typeValue;
    }
    
    // Process date range
    let dateFrom = null;
    let dateTo = null;
    if (!isEmpty(rawQuery.dateFrom)) {
      try {
        dateFrom = new Date(rawQuery.dateFrom);
        if (isNaN(dateFrom.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid dateFrom format',
            code: 'INVALID_DATE_FROM'
          });
        }
      } catch (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid dateFrom format',
          code: 'INVALID_DATE_FROM'
        });
      }
    }
    
    if (!isEmpty(rawQuery.dateTo)) {
      try {
        dateTo = new Date(rawQuery.dateTo);
        if (isNaN(dateTo.getTime())) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid dateTo format',
            code: 'INVALID_DATE_TO'
          });
        }
      } catch (error) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid dateTo format',
          code: 'INVALID_DATE_TO'
        });
      }
    }
    
    // Build filters object
    const filters = {};
    
    if (applicationId) {
      filters.applicationId = applicationId;
    }
    
    if (status) {
      filters.status = status;
    }
    
    if (type) {
      filters.type = type;
    }
    
    // Date range filtering
    if (dateFrom || dateTo) {
      filters.scheduledAt = {};
      if (dateFrom) {
        filters.scheduledAt.gte = dateFrom;
      }
      if (dateTo) {
        // Include the entire day for dateTo
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        filters.scheduledAt.lte = endOfDay;
      }
    }
    
    // Add search functionality
    if (search) {
      filters.application = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { jobPosting: { title: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    // Execute database queries with error handling
    let interviews = [];
    let total = 0;

    try {
      [interviews, total] = await Promise.all([
        prisma.interview.findMany({
          where: filters,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            application: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                jobPosting: {
                  select: { id: true, title: true, department: { select: { name: true } } },
                },
              },
            },
          },
          orderBy: { scheduledAt: 'asc' },
        }),
        prisma.interview.count({ where: filters }),
      ]);
    } catch (dbError) {
      logger.error('Database error in interview query', {
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
        await createAuditLog(req.user.id, 'READ', 'interviews', null, null, null, req);
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
        interviews,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / limit),
        },
        filters: {
          applicationId,
          status,
          type,
          dateFrom,
          dateTo,
          search,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching interviews', { 
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
      next(new AppError('Failed to fetch interviews', 500, null, 'SERVER_ERROR'));
    }
  }
});

/**
 * GET /api/interviews/:id - Get interview details
 * 
 * Returns detailed information about a specific interview including:
 * - Interview details and status
 * - Candidate information
 * - Job posting details
 * - Feedback and ratings
 * 
 * Accessible to ADMIN and HR roles.
 */
router.get('/:id', authenticate, authorize('ADMIN', 'HR'), validate(interviewSchemas.idSchema), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    
    const interview = await prisma.interview.findUnique({
      where: { id },
      include: {
        application: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            resumeUrl: true,
            coverLetterUrl: true,
            applicationDate: true,
            status: true,
            jobPosting: {
              select: { 
                id: true, 
                title: true, 
                description: true,
                requirements: true,
                department: { select: { name: true } },
                location: true,
                employmentType: true,
              },
            },
          },
        },
      },
    });

    if (!interview) {
      throw new AppError('Interview not found', 404, null, 'NOT_FOUND');
    }

    // Log audit trail
    try {
      await createAuditLog(req.user.id, 'READ', 'interviews', id, null, null, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        interviewId: id
      });
    }

    res.json({
      status: 'success',
      data: { interview },
    });
  } catch (error) {
    logger.error('Error fetching interview', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * POST /api/interviews - Create interview
 * 
 * Creates a new interview with validation for:
 * - Valid application ID
 * - Future scheduling date
 * - Valid interviewers
 * 
 * Accessible to ADMIN and HR roles.
 */
router.post('/', authenticate, authorize('ADMIN', 'HR'), validate(interviewSchemas.create), async (req, res, next) => {
  try {
    const { applicationId, scheduledAt, duration, location, type, interviewers, notes } = req.validatedData.body;

    // Validate application exists and is in appropriate status
    const application = await prisma.jobApplication.findUnique({
      where: { id: applicationId },
      include: {
        jobPosting: {
          select: { id: true, title: true, isActive: true },
        },
      },
    });
    
    if (!application) {
      throw new ValidationError('Job application not found', null, 'APPLICATION_NOT_FOUND');
    }

    if (!application.jobPosting.isActive) {
      throw new ValidationError('Cannot schedule interview for inactive job posting', null, 'INACTIVE_JOB_POSTING');
    }

    const validApplicationStatuses = ['UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW_SCHEDULED'];
    if (!validApplicationStatuses.includes(application.status)) {
      throw new ValidationError(
        'Application must be under review, shortlisted, or already have interview scheduled',
        null,
        'INVALID_APPLICATION_STATUS'
      );
    }

    // Validate scheduled time is in the future
    const scheduleDate = new Date(scheduledAt);
    const now = new Date();
    const minScheduleTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
    
    if (scheduleDate <= minScheduleTime) {
      throw new ValidationError(
        'Interview must be scheduled at least 30 minutes in the future',
        null,
        'INVALID_SCHEDULE_TIME'
      );
    }
// Validate interviewers exist (if provided)
if (interviewers && interviewers.length > 0) {
  const existingInterviewers = await prisma.employee.findMany({
    where: {
      id: { in: interviewers },
      employmentStatus: 'ACTIVE',
    },
    select: { id: true },
  });

  if (existingInterviewers.length !== interviewers.length) {
    const existingIds = existingInterviewers.map(emp => emp.id);
    const invalidIds = interviewers.filter(id => !existingIds.includes(id));
    throw new ValidationError(
      `Invalid or inactive interviewer IDs: ${invalidIds.join(', ')}`,
      null,
      'INVALID_INTERVIEWERS'
    );
  }
}

    // Check for scheduling conflicts (optional - same interviewer at same time)
    if (interviewers && interviewers.length > 0) {
      const conflictingInterviews = await prisma.interview.findMany({
        where: {
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          scheduledAt: {
            gte: new Date(scheduleDate.getTime() - (duration * 60 * 1000)),
            lte: new Date(scheduleDate.getTime() + (duration * 60 * 1000)),
          },
          interviewers: {
            hasSome: interviewers,
          },
        },
        select: { id: true, scheduledAt: true },
      });

      if (conflictingInterviews.length > 0) {
        logger.warn('Potential interviewer scheduling conflict detected', {
          newInterview: { scheduledAt, interviewers },
          conflicts: conflictingInterviews,
          userId: req.user.id,
        });
      }
    }

    const interview = await prisma.interview.create({
      data: {
        applicationId,
        scheduledAt: scheduleDate,
        duration,
        location,
        type,
        interviewers,
        notes,
        status: 'SCHEDULED',
        createdById: req.user.id,
      },
      include: {
        application: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobPosting: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    // Update application status if needed
    if (application.status !== 'INTERVIEW_SCHEDULED') {
      await prisma.jobApplication.update({
        where: { id: applicationId },
        data: { 
          status: 'INTERVIEW_SCHEDULED',
          updatedById: req.user.id,
        },
      });
    }

    // Log audit trail
    try {
      await createAuditLog(req.user.id, 'CREATE', 'interviews', interview.id, null, interview, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        interviewId: interview.id
      });
    }

    res.status(201).json({
      status: 'success',
      message: 'Interview scheduled successfully',
      data: { interview },
    });
  } catch (error) {
    logger.error('Error creating interview', { 
      error: error.message,
      userId: req.user?.id,
      data: req.body
    });
    next(error);
  }
});

/**
 * PUT /api/interviews/:id - Update interview
 * 
 * Updates an existing interview with validation for:
 * - Future scheduling date (if rescheduling)
 * - Valid status transitions
 * - Valid interviewers
 * 
 * Accessible to ADMIN and HR roles.
 */
router.put('/:id', authenticate, authorize('ADMIN', 'HR'), validate(interviewSchemas.update), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;
    const updateData = req.validatedData.body;

    const existingInterview = await prisma.interview.findUnique({ 
      where: { id },
      include: {
        application: {
          select: { id: true, status: true },
        },
      },
    });
    
    if (!existingInterview) {
      throw new AppError('Interview not found', 404, null, 'NOT_FOUND');
    }
// Validate status transitions
if (updateData.status) {
  const validTransitions = {
    'SCHEDULED': ['IN_PROGRESS', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW'],
    'IN_PROGRESS': ['COMPLETED', 'CANCELLED'],
    'COMPLETED': [], // Cannot change from completed
    'CANCELLED': ['SCHEDULED'], // Can reschedule cancelled interviews
    'RESCHEDULED': ['SCHEDULED', 'CANCELLED'],
    'NO_SHOW': ['SCHEDULED'], // Can reschedule no-shows
  };

  const allowedTransitions = validTransitions[existingInterview.status] || [];
  if (!allowedTransitions.includes(updateData.status)) {
    throw new ValidationError(
      `Cannot change status from ${existingInterview.status} to ${updateData.status}`,
      null,
      'INVALID_STATUS_TRANSITION'
    );
  }
}

    // Validate scheduled time is in the future if being updated
    if (updateData.scheduledAt) {
      const scheduleDate = new Date(updateData.scheduledAt);
      const now = new Date();
      const minScheduleTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
      
      if (scheduleDate <= minScheduleTime) {
        throw new ValidationError(
          'Interview must be scheduled at least 30 minutes in the future',
          null,
          'INVALID_SCHEDULE_TIME'
        );
      }
      updateData.scheduledAt = scheduleDate;
    }
// Validate interviewers exist (if provided)
if (updateData.interviewers && updateData.interviewers.length > 0) {
  const existingInterviewers = await prisma.employee.findMany({
    where: {
      id: { in: updateData.interviewers },
      employmentStatus: 'ACTIVE',
    },
    select: { id: true },
  });

  if (existingInterviewers.length !== updateData.interviewers.length) {
    const existingIds = existingInterviewers.map(emp => emp.id);
    const invalidIds = updateData.interviewers.filter(
      id => !existingIds.includes(id)
    );
    throw new ValidationError(
      `Invalid or inactive interviewer IDs: ${invalidIds.join(', ')}`,
      null,
      'INVALID_INTERVIEWERS'
    );
  }
}


    // Validate feedback and rating requirements
    if (updateData.status === 'COMPLETED') {
      if (!updateData.feedback && !existingInterview.feedback) {
        throw new ValidationError(
          'Feedback is required when marking interview as completed',
          null,
          'FEEDBACK_REQUIRED'
        );
      }
      if (!updateData.rating && !existingInterview.rating) {
        throw new ValidationError(
          'Rating is required when marking interview as completed',
          null,
          'RATING_REQUIRED'
        );
      }
    }

    const interview = await prisma.interview.update({
      where: { id },
      data: {
        ...updateData,
        updatedById: req.user.id,
      },
      include: {
        application: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            jobPosting: {
              select: { id: true, title: true },
            },
          },
        },
      },
    });

    // Update application status based on interview status
    let applicationStatus = existingInterview.application.status;
    if (updateData.status === 'COMPLETED' && interview.rating >= 3) {
      applicationStatus = 'UNDER_REVIEW'; // Move to next stage
    } else if (updateData.status === 'COMPLETED' && interview.rating < 3) {
      applicationStatus = 'REJECTED';
    } else if (updateData.status === 'NO_SHOW') {
      applicationStatus = 'REJECTED';
    }

    if (applicationStatus !== existingInterview.application.status) {
      await prisma.jobApplication.update({
        where: { id: existingInterview.applicationId },
        data: { 
          status: applicationStatus,
          updatedById: req.user.id,
        },
      });
    }

    // Log audit trail
    try {
      await createAuditLog(req.user.id, 'UPDATE', 'interviews', id, existingInterview, interview, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        interviewId: id
      });
    }

    res.json({
      status: 'success',
      message: 'Interview updated successfully',
      data: { interview },
    });
  } catch (error) {
    logger.error('Error updating interview', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id,
      data: req.body
    });
    next(error);
  }
});

/**
 * DELETE /api/interviews/:id - Delete interview
 * 
 * Permanently deletes an interview record.
 * Only allows deletion of scheduled or cancelled interviews.
 * 
 * Accessible to ADMIN and HR roles.
 */
router.delete('/:id', authenticate, authorize('ADMIN', 'HR'), validate(interviewSchemas.idSchema), async (req, res, next) => {
  try {
    const { id } = req.validatedData.params;

    const existingInterview = await prisma.interview.findUnique({ 
      where: { id },
      include: {
        application: {
          select: { id: true, status: true },
        },
      },
    });
    if (!existingInterview) {
  throw new AppError('Interview not found', 404, null, 'NOT_FOUND');
}

// Only allow deletion of scheduled or cancelled interviews
const deletableStatuses = ['SCHEDULED', 'CANCELLED', 'RESCHEDULED'];
if (!deletableStatuses.includes(existingInterview.status)) {
  throw new ValidationError(
    `Cannot delete interview with status: ${existingInterview.status}`,
    null,
    'CANNOT_DELETE_INTERVIEW'
  );
}

await prisma.interview.delete({ where: { id } });

    // Update application status back to previous state if needed
    if (existingInterview.application.status === 'INTERVIEW_SCHEDULED') {
      // Check if there are other scheduled interviews for this application
      const otherInterviews = await prisma.interview.findMany({
        where: {
          applicationId: existingInterview.applicationId,
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          id: { not: id },
        },
      });

      // If no other interviews, revert application status
      if (otherInterviews.length === 0) {
        await prisma.jobApplication.update({
          where: { id: existingInterview.applicationId },
          data: { 
            status: 'UNDER_REVIEW',
            updatedById: req.user.id,
          },
        });
      }
    }

    // Log audit trail
    try {
      await createAuditLog(req.user.id, 'DELETE', 'interviews', id, existingInterview, null, req);
    } catch (auditError) {
      logger.warn('Audit log creation failed', { 
        error: auditError.message,
        userId: req.user?.id,
        interviewId: id
      });
    }

    res.json({
      status: 'success',
      message: 'Interview deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting interview', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

export default router;