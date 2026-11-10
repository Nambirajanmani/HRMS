// src/middleware/auth.js
import { AuthenticationError, AuthorizationError, ValidationError } from '../utils/errors.js';
import { verifyAccessToken } from '../utils/authUtils.js';
import logger from '../utils/logger.js';
import prisma from '../config/prisma.js';

// Helper for environment variables
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Authentication middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const authError = new AuthenticationError('Access token required', null, 'TOKEN_REQUIRED');
      logger.error('Authentication error', { error: authError.message, url: req.originalUrl });
      return res.status(authError.statusCode).json({
        status: authError.status,
        message: authError.message,
        code: authError.code
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    // Use correct model casing from Prisma schema
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        employee: {
          select: {
            id: true,
            departmentId: true,
            positionId: true,
            managerId: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      const authError = new AuthenticationError('User not found or inactive', null, 'USER_NOT_FOUND');
      logger.error('Authentication error', { error: authError.message, url: req.originalUrl });
      return res.status(authError.statusCode).json({
        status: authError.status,
        message: authError.message,
        code: authError.code
      });
    }

    // Use the role from database, not from token
    req.user = { ...user };
    logger.info('User authenticated', { userId: user.id, role: user.role, url: req.originalUrl });
    next();
  } catch (error) {
    logger.error('Authentication error', { error: error.message, url: req.originalUrl });
    const statusCode = error.statusCode || 401;
    const message = error.message || 'Authentication failed';
    const code = error.code || 'AUTH_ERROR';
    res.status(statusCode).json({
      status: 'fail',
      message: message,
      code: code
    });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      logger.error('Authentication required', { url: req.originalUrl });
      return next(new AuthenticationError('Authentication required', null, 'AUTH_REQUIRED'));
    }

    // Ensure roles are in uppercase to match database
    const normalizedRoles = roles.map(role => role.toUpperCase());
    const userRole = req.user.role.toUpperCase();

    if (!normalizedRoles.includes(userRole)) {
      logger.error('Insufficient permissions', { userId: req.user.id, role: req.user.role, url: req.originalUrl });
      return next(new AuthorizationError('Insufficient permissions', null, 'INSUFFICIENT_PERMISSIONS'));
    }

    next();
  };
};

// Employee-specific authorization middleware
const authorizeEmployee = async (req, res, next) => {
  try {
    const employeeId = req.params.employeeId || req.params.id;
    if (
      !employeeId ||
      !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(employeeId)
    ) {
      throw new ValidationError('Invalid employee ID', null, 'INVALID_ID');
    }

    if (!req.user) {
      throw new AuthenticationError('Authentication required', null, 'AUTH_REQUIRED');
    }

    const userRole = req.user.role.toUpperCase();
    
    if (['ADMIN', 'HR'].includes(userRole)) {
      return next();
    }

    if (userRole === 'MANAGER' && req.user.employee) {
      const subordinates = await prisma.employee.findMany({
        where: { managerId: req.user.employee.id },
        select: { id: true },
      });
      const subordinateIds = subordinates.map((sub) => sub.id);
      if (subordinateIds.includes(employeeId)) {
        return next();
      }
    }

    if (req.user.employee && req.user.employee.id === employeeId) {
      return next();
    }

    logger.error('Employee access denied', {
      userId: req.user.id,
      role: req.user.role,
      employeeId,
      url: req.originalUrl,
    });
    return next(new AuthorizationError('Access denied', null, 'ACCESS_DENIED'));
  } catch (error) {
    logger.error('Employee authorization error', { error: error.message, url: req.originalUrl });
    next(error);
  }
};

export { authenticate, authorize, authorizeEmployee };
