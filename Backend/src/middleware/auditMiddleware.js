// src/middleware/auditMiddleware.js
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient({
  errorFormat: 'pretty',
});

// Get environment variable with logging
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Audit log validation schema
const auditLogSchema = z.object({
  userId: z.string().uuid('Invalid user ID').nullable(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT', 'PASSWORD_CHANGE']),
  resource: z.string().min(1, 'Resource is required'),
  resourceId: z.string().uuid('Invalid resource ID').nullable(),
  oldValues: z.any().optional(),
  newValues: z.any().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
});

// Audit middleware for request/response logging
const auditMiddleware = async (req, res, next) => {
  if (getEnvVariable('AUDIT_LOGGING_ENABLED', 'true') === 'false') {
    return next();
  }

  const startTime = Date.now();
  const auditData = {
    userId: req.user?.id || null,
    requestId: req.logger?.requestContext?.requestId || null,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  };

  // Capture response status
  const originalEnd = res.end;
  res.end = function (...args) {
    auditData.statusCode = res.statusCode;
    auditData.responseTime = Date.now() - startTime;
    req.logger.info('API Call', auditData);
    originalEnd.apply(this, args);
  };

  next();
};

// Create audit log for specific actions
const createAuditLog = async (userId, action, resource, resourceId, oldValues = null, newValues = null, req = null) => {
  if (getEnvVariable('AUDIT_LOGGING_ENABLED', 'true') === 'false') {
    return;
  }

  try {
    const validatedData = auditLogSchema.parse({
      userId,
      action,
      resource,
      resourceId,
      oldValues,
      newValues,
      ipAddress: req?.ip,
      userAgent: req?.get('User-Agent'),
    });

    await prisma.auditLog.create({
      data: {
        userId: validatedData.userId,
        action: validatedData.action,
        resource: validatedData.resource,
        resourceId: validatedData.resourceId,
        oldValues: validatedData.oldValues ? JSON.stringify(validatedData.oldValues, null, 2) : null,
        newValues: validatedData.newValues ? JSON.stringify(validatedData.newValues, null, 2) : null,
        ipAddress: validatedData.ipAddress,
        userAgent: validatedData.userAgent,
      },
    });

    req?.logger.info('Audit log created', {
      userId: validatedData.userId,
      action: validatedData.action,
      resource: validatedData.resource,
      resourceId: validatedData.resourceId,
    });
  } catch (error) {
    const errorMessage = error instanceof z.ZodError
      ? `Invalid audit log data: ${error.errors.map((e) => e.message).join(', ')}`
      : `Failed to create audit log: ${error.message}`;
    req?.logger.error(errorMessage, { userId, action, resource, resourceId });
    throw new ValidationError(errorMessage, error.errors || null, 'AUDIT_LOG_FAILED');
  }
};

// Export for ES Modules
export { auditMiddleware, createAuditLog };
