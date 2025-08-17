// src/routes/auditLogRoutes.js - Complete updated version
import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { AppError } from '../utils/errors.js';
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

// Validation schemas
const listAuditLogsSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.undefined()]).optional(),
    limit: z.union([z.string(), z.undefined()]).optional(),
    userId: z.union([z.string(), z.undefined()]).optional(),
    action: z.union([z.string(), z.undefined()]).optional(),
    resource: z.union([z.string(), z.undefined()]).optional(),
    resourceId: z.union([z.string(), z.undefined()]).optional(),
    startDate: z.union([z.string(), z.undefined()]).optional(),
    endDate: z.union([z.string(), z.undefined()]).optional(),
    ipAddress: z.union([z.string(), z.undefined()]).optional(),
  }),
});

const auditLogIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid audit log ID'),
  }),
});

/**
 * GET /api/audit-logs - Get all audit logs with pagination and filtering
 * 
 * Returns a paginated list of audit logs with optional filtering by:
 * - userId, action, resource, resourceId
 * - Date range (startDate, endDate)
 * - IP address
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  async (req, res, next) => {
    try {
      // Manual parameter processing with proper error handling
      const rawQuery = req.query || {};
      
      // Process pagination parameters
      const page = safeParseInt(rawQuery.page, 1, 1, 1000);
      const limit = safeParseInt(rawQuery.limit, 20, 1, 100);
      
      // Process userId with UUID validation
      let userId = null;
      if (!isEmpty(rawQuery.userId)) {
        const uId = rawQuery.userId.trim();
        if (!isValidUUID(uId)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid user ID format',
            code: 'INVALID_USER_ID'
          });
        }
        userId = uId;
      }
      
      // Process action with validation
      const validActions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE'];
      let action = null;
      if (!isEmpty(rawQuery.action)) {
        const actionValue = rawQuery.action.trim().toUpperCase();
        if (!validActions.includes(actionValue)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid action type',
            code: 'INVALID_ACTION',
            validValues: validActions
          });
        }
        action = actionValue;
      }
      
      // Process resource filter
      const resource = isEmpty(rawQuery.resource) ? null : rawQuery.resource.trim();
      
      // Process resourceId with UUID validation
      let resourceId = null;
      if (!isEmpty(rawQuery.resourceId)) {
        const resId = rawQuery.resourceId.trim();
        if (!isValidUUID(resId)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid resource ID format',
            code: 'INVALID_RESOURCE_ID'
          });
        }
        resourceId = resId;
      }
      
      // Process date range filters
      let startDate = null;
      let endDate = null;
      
      if (!isEmpty(rawQuery.startDate)) {
        try {
          startDate = new Date(rawQuery.startDate);
          if (isNaN(startDate.getTime())) {
            throw new Error('Invalid start date');
          }
        } catch (dateError) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid start date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)',
            code: 'INVALID_START_DATE'
          });
        }
      }
      
      if (!isEmpty(rawQuery.endDate)) {
        try {
          endDate = new Date(rawQuery.endDate);
          if (isNaN(endDate.getTime())) {
            throw new Error('Invalid end date');
          }
        } catch (dateError) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid end date format. Use ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)',
            code: 'INVALID_END_DATE'
          });
        }
      }
      
      // Validate date range
      if (startDate && endDate && startDate > endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'Start date cannot be later than end date',
          code: 'INVALID_DATE_RANGE'
        });
      }
      
      // Process IP address filter
      const ipAddress = isEmpty(rawQuery.ipAddress) ? null : rawQuery.ipAddress.trim();
      
      // Build filters object
      const filters = {};
      
      if (userId) {
        filters.userId = userId;
      }
      
      if (action) {
        filters.action = action;
      }
      
      if (resource) {
        filters.resource = { contains: resource, mode: 'insensitive' };
      }
      
      if (resourceId) {
        filters.resourceId = resourceId;
      }
      
      if (ipAddress) {
        filters.ipAddress = { contains: ipAddress, mode: 'insensitive' };
      }
      
      // Add date range filter
      if (startDate || endDate) {
        filters.timestamp = {};
        if (startDate) {
          filters.timestamp.gte = startDate;
        }
        if (endDate) {
          filters.timestamp.lte = endDate;
        }
      }

      // Execute database queries with error handling
      let auditLogs = [];
      let total = 0;

      try {
        [auditLogs, total] = await Promise.all([
          prisma.audit_logs.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { timestamp: 'desc' },
            include: {
              user: {
                select: { 
                  id: true, 
                  email: true, 
                  role: true,
                  employee: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      employeeId: true
                    }
                  }
                },
              },
            },
          }),
          prisma.audit_logs.count({ where: filters }),
        ]);
      } catch (dbError) {
        logger.error('Database error in audit logs query', {
          error: dbError.message,
          stack: dbError.stack,
          filters,
          userId: req.user?.id
        });
        throw new AppError('Database query failed', 500, null, 'DATABASE_ERROR');
      }

      // Log this audit access
      try {
        if (req.user?.id) {
          await createAuditLog(req.user.id, 'READ', 'audit_logs', null, null, null, req);
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
          auditLogs,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
          },
          filters: {
            userId,
            action,
            resource,
            resourceId,
            startDate,
            endDate,
            ipAddress
          }
        },
      });
    } catch (error) {
      logger.error('Error fetching audit logs', { 
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
        next(new AppError('Failed to fetch audit logs', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/audit-logs/:id - Get single audit log
 * 
 * Returns detailed information about a specific audit log entry including:
 * - Basic log info (action, resource, timestamp)
 * - User information who performed the action
 * - Old and new values (if applicable)
 * - Request metadata (IP, user agent)
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(auditLogIdSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const auditLog = await prisma.audit_logs.findUnique({
        where: { id },
        include: {
          user: {
            select: { 
              id: true, 
              email: true, 
              role: true,
              employee: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeId: true,
                  department: {
                    select: { id: true, name: true }
                  },
                  position: {
                    select: { id: true, title: true }
                  }
                }
              }
            },
          },
        },
      });

      if (!auditLog) {
        throw new AppError('Audit log entry not found', 404, null, 'NOT_FOUND');
      }

      // Log this specific audit log access
      try {
        if (req.user?.id) {
          await createAuditLog(req.user.id, 'READ', 'audit_logs', id, null, null, req);
        }
      } catch (auditError) {
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id 
        });
      }
      
      res.json({ 
        status: 'success', 
        data: auditLog 
      });
    } catch (error) {
      logger.error('Error fetching audit log', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * GET /api/audit-logs/stats/summary - Get audit logs statistics
 * 
 * Returns summary statistics about audit logs:
 * - Total count by action type
 * - Activity over time (last 30 days)
 * - Top users by activity
 * - Most accessed resources
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.get(
  '/stats/summary',
  authenticate,
  authorize('ADMIN', 'HR'),
  async (req, res, next) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get statistics in parallel
      const [
        totalCount,
        actionCounts,
        recentActivity,
        topUsers,
        topResources
      ] = await Promise.all([
        // Total audit logs count
        prisma.audit_logs.count(),
        
        // Count by action type
        prisma.audit_logs.groupBy({
          by: ['action'],
          _count: { action: true },
          orderBy: { _count: { action: 'desc' } }
        }),
        
        // Recent activity (last 30 days) grouped by day
        prisma.audit_logs.findMany({
          where: {
            timestamp: { gte: thirtyDaysAgo }
          },
          select: {
            timestamp: true,
            action: true
          }
        }),
        
        // Top 10 most active users
        prisma.audit_logs.groupBy({
          by: ['userId'],
          where: {
            userId: { not: null },
            timestamp: { gte: thirtyDaysAgo }
          },
          _count: { userId: true },
          orderBy: { _count: { userId: 'desc' } },
          take: 10
        }),
        
        // Top 10 most accessed resources
        prisma.audit_logs.groupBy({
          by: ['resource'],
          where: {
            timestamp: { gte: thirtyDaysAgo }
          },
          _count: { resource: true },
          orderBy: { _count: { resource: 'desc' } },
          take: 10
        })
      ]);

      // Process recent activity data for daily counts
      const dailyActivity = {};
      recentActivity.forEach(log => {
        const date = log.timestamp.toISOString().split('T')[0];
        if (!dailyActivity[date]) {
          dailyActivity[date] = { total: 0, CREATE: 0, UPDATE: 0, DELETE: 0, LOGIN: 0, LOGOUT: 0, PASSWORD_CHANGE: 0 };
        }
        dailyActivity[date].total++;
        dailyActivity[date][log.action] = (dailyActivity[date][log.action] || 0) + 1;
      });

      // Get user details for top users
      const userIds = topUsers.map(u => u.userId).filter(Boolean);
      const userDetails = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeId: true
            }
          }
        }
      });

      // Merge user details with activity counts
      const topUsersWithDetails = topUsers.map(userActivity => {
        const user = userDetails.find(u => u.id === userActivity.userId);
        return {
          userId: userActivity.userId,
          activityCount: userActivity._count.userId,
          user: user || null
        };
      });

      // Log this stats access
      try {
        if (req.user?.id) {
          await createAuditLog(req.user.id, 'READ', 'audit_logs_stats', null, null, null, req);
        }
      } catch (auditError) {
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id 
        });
      }

      res.json({
        status: 'success',
        data: {
          summary: {
            totalLogs: totalCount,
            last30Days: Object.keys(dailyActivity).length
          },
          actionCounts: actionCounts.map(item => ({
            action: item.action,
            count: item._count.action
          })),
          dailyActivity,
          topUsers: topUsersWithDetails,
          topResources: topResources.map(item => ({
            resource: item.resource,
            count: item._count.resource
          })),
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Error fetching audit log statistics', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(new AppError('Failed to fetch audit log statistics', 500, null, 'SERVER_ERROR'));
    }
  }
);

/**
 * DELETE /api/audit-logs/cleanup - Cleanup old audit logs
 * 
 * Deletes audit logs older than specified days (default 365 days).
 * This is a maintenance endpoint for system administrators.
 * 
 * Accessible only to ADMIN role.
 */
router.delete(
  '/cleanup',
  authenticate,
  authorize('ADMIN'),
  async (req, res, next) => {
    try {
      // Get retention days from query parameter, default to 365
      const retentionDays = safeParseInt(req.query.days, 365, 30, 3650); // Min 30 days, max 10 years
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Count logs that will be deleted
      const logsToDeleteCount = await prisma.audit_logs.count({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });

      if (logsToDeleteCount === 0) {
        return res.json({
          status: 'success',
          message: 'No audit logs found to cleanup',
          data: {
            deletedCount: 0,
            cutoffDate: cutoffDate.toISOString(),
            retentionDays
          }
        });
      }

      // Delete old audit logs
      const deleteResult = await prisma.audit_logs.deleteMany({
        where: {
          timestamp: { lt: cutoffDate }
        }
      });

      // Log the cleanup action
      await createAuditLog(
        req.user.id, 
        'DELETE', 
        'audit_logs_cleanup', 
        null, 
        null, 
        { 
          deletedCount: deleteResult.count, 
          cutoffDate: cutoffDate.toISOString(),
          retentionDays 
        }, 
        req
      );

      res.json({
        status: 'success',
        message: `Successfully cleaned up ${deleteResult.count} old audit log entries`,
        data: {
          deletedCount: deleteResult.count,
          cutoffDate: cutoffDate.toISOString(),
          retentionDays
        }
      });
    } catch (error) {
      logger.error('Error cleaning up audit logs', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(new AppError('Failed to cleanup audit logs', 500, null, 'SERVER_ERROR'));
    }
  }
);

export default router;