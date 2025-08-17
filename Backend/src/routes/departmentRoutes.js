// src/routes/departmentRoutes.js - Updated version based on employeeRoutes pattern
import express from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { ValidationError, AppError } from '../utils/errors.js';
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

// Simplified validation schema for listing - handle parameters manually
const listSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.undefined()]).optional(),
    limit: z.union([z.string(), z.undefined()]).optional(),
    search: z.union([z.string(), z.undefined()]).optional(),
    parentId: z.union([z.string(), z.undefined()]).optional(),
    isActive: z.union([z.string(), z.undefined()]).optional(),
    sortBy: z.union([z.string(), z.undefined()]).optional(),
    sortOrder: z.union([z.string(), z.undefined()]).optional(),
  }),
});

// Validation schemas for other operations
const departmentSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
    managerId: z.string().uuid('Invalid manager ID').nullable().optional(),
    parentId: z.string().uuid('Invalid parent department ID').nullable().optional(),
    isActive: z.boolean().default(true),
    description: z.string().max(500, 'Description must be less than 500 characters').nullable().optional(),
  }),
});

const updateDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters').optional(),
    managerId: z.string().uuid('Invalid manager ID').nullable().optional(),
    parentId: z.string().uuid('Invalid parent department ID').nullable().optional(),
    isActive: z.boolean().optional(),
    description: z.string().max(500, 'Description must be less than 500 characters').nullable().optional(),
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid department ID'),
  }),
});

/**
 * Checks for circular parent-child relationships
 */
const checkCircularReference = async (departmentId, parentId) => {
  if (departmentId === parentId) return true;

  let currentParentId = parentId;
  const visitedIds = new Set([departmentId]);

  while (currentParentId) {
    if (visitedIds.has(currentParentId)) return true;
    visitedIds.add(currentParentId);

    try {
      const parent = await prisma.department.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      if (!parent) break;
      currentParentId = parent.parentId;
    } catch (error) {
      logger.error('Error checking circular reference', { 
        error: error.message,
        departmentId,
        parentId 
      });
      break;
    }
  }
  return false;
};

/**
 * GET /api/departments - Get all departments with pagination
 * 
 * Returns a paginated list of departments with optional filtering.
 * Accessible to ADMIN, HR, and MANAGER roles.
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  // Remove validation middleware and handle manually
  async (req, res, next) => {
    try {
      // Manual parameter processing with proper error handling
      const rawQuery = req.query || {};
      
      // Process pagination parameters
      const page = safeParseInt(rawQuery.page, 1, 1, 1000);
      const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
      
      // Process search parameter
      const search = isEmpty(rawQuery.search) ? null : rawQuery.search.trim();
      
      // Process parentId with UUID validation
      let parentId = null;
      if (!isEmpty(rawQuery.parentId)) {
        const pid = rawQuery.parentId.trim();
        if (!isValidUUID(pid)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid parent department ID format',
            code: 'INVALID_PARENT_ID'
          });
        }
        parentId = pid;
      }
      
      // Process isActive parameter
      let isActive = null;
      if (!isEmpty(rawQuery.isActive)) {
        const activeParam = rawQuery.isActive.trim().toLowerCase();
        if (activeParam === 'true') {
          isActive = true;
        } else if (activeParam === 'false') {
          isActive = false;
        } else {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid isActive parameter. Must be true or false',
            code: 'INVALID_IS_ACTIVE'
          });
        }
      }
      
      // Process sortBy parameter
      const validSortFields = ['name', 'createdAt', 'updatedAt'];
      const sortBy = isEmpty(rawQuery.sortBy) ? 'name' : rawQuery.sortBy.trim();
      if (!validSortFields.includes(sortBy)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid sortBy field',
          code: 'INVALID_SORT_FIELD',
          validValues: validSortFields
        });
      }
      
      // Process sortOrder parameter
      const validSortOrders = ['asc', 'desc'];
      const sortOrder = isEmpty(rawQuery.sortOrder) ? 'asc' : rawQuery.sortOrder.trim().toLowerCase();
      if (!validSortOrders.includes(sortOrder)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid sortOrder',
          code: 'INVALID_SORT_ORDER',
          validValues: validSortOrders
        });
      }

      // Build filters object - only include non-null values
      const filters = {};
      
      if (isActive !== null) {
        filters.isActive = isActive;
      }
      
      if (parentId) {
        filters.parentId = parentId;
      }
      
      // Add search functionality
      if (search) {
        filters.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      // Build orderBy object
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      // Execute database queries with error handling
      let departments = [];
      let total = 0;

      try {
        [departments, total] = await Promise.all([
          prisma.department.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
            orderBy,
            include: {
              manager: {
                select: {
                  id: true,
                  employeeId: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  position: { select: { title: true } }
                }
              },
              parent: { 
                select: { id: true, name: true } 
              },
              _count: {
                select: {
                  employees: { where: { employmentStatus: 'ACTIVE' } },
                  children: { where: { isActive: true } }
                }
              },
            },
          }),
          prisma.department.count({ where: filters }),
        ]);
      } catch (dbError) {
        logger.error('Database error in department query', {
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
          await createAuditLog(req.user.id, 'READ', 'departments', null, null, null, req);
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
          departments,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
          }
        },
      });
    } catch (error) {
      logger.error('Error fetching departments', { 
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
        next(new AppError('Failed to fetch departments', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/departments/:id - Get single department
 * 
 * Returns detailed information about a specific department including:
 * - Basic info
 * - Manager and parent department
 * - Child departments and employees
 * - Positions associated with the department
 * 
 * Accessible to ADMIN, HR, and MANAGER roles.
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const department = await prisma.department.findUnique({
        where: { id },
        include: {
          manager: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: { select: { title: true } }
            }
          },
          parent: { 
            select: { id: true, name: true } 
          },
          children: {
            where: { isActive: true },
            select: { 
              id: true, 
              name: true, 
              isActive: true, 
              _count: { select: { employees: true } } 
            },
            orderBy: { name: 'asc' }
          },
          employees: {
            where: { employmentStatus: 'ACTIVE' },
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              employmentStatus: true,
              position: { select: { title: true } },
              hireDate: true
            },
            orderBy: { firstName: 'asc' }
          },
          positions: {
            select: {
              id: true,
              title: true,
              isActive: true,
              _count: {
                select: {
                  employees: { where: { employmentStatus: 'ACTIVE' } }
                }
              }
            },
            orderBy: { title: 'asc' }
          },
        },
      });

      if (!department) {
        throw new AppError('Department not found', 404, null, 'NOT_FOUND');
      }

      await createAuditLog(req.user.id, 'READ', 'departments', id, null, null, req);
      res.json({ status: 'success', data: department });
    } catch (error) {
      logger.error('Error fetching department', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/departments - Create a new department
 * 
 * Creates a new department record with validation for:
 * - Unique department name
 * - Valid manager and parent department references
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(departmentSchema),
  async (req, res, next) => {
    try {
      const departmentData = req.validatedData.body;

      // Check if department name already exists
      const existingDepartment = await prisma.department.findFirst({
        where: { 
          name: { 
            equals: departmentData.name.trim(), 
            mode: 'insensitive' 
          } 
        }
      });

      if (existingDepartment) {
        throw new ValidationError('Department name already exists', null, 'DUPLICATE_DEPARTMENT_NAME');
      }

      // Validate manager exists if provided
      if (departmentData.managerId) {
        const manager = await prisma.employee.findFirst({
          where: { 
            id: departmentData.managerId, 
            employmentStatus: 'ACTIVE' 
          }
        });
        if (!manager) {
          throw new ValidationError('Manager not found or not active', null, 'MANAGER_NOT_FOUND');
        }
      }

      // Validate parent department exists if provided
      if (departmentData.parentId) {
        const parent = await prisma.department.findFirst({
          where: { 
            id: departmentData.parentId, 
            isActive: true 
          }
        });
        if (!parent) {
          throw new ValidationError('Parent department not found or not active', null, 'PARENT_NOT_FOUND');
        }
      }

      const newDepartment = await prisma.department.create({
        data: {
          name: departmentData.name.trim(),
          managerId: departmentData.managerId || null,
          parentId: departmentData.parentId || null,
          description: departmentData.description?.trim() || null,
          isActive: departmentData.isActive ?? true,
          createdById: req.user.id,
        },
        include: {
          manager: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: { select: { title: true } }
            }
          },
          parent: { select: { id: true, name: true } },
        },
      });

      await createAuditLog(req.user.id, 'CREATE', 'departments', newDepartment.id, null, newDepartment, req);
      res.status(201).json({ status: 'success', data: newDepartment });
    } catch (error) {
      logger.error('Error creating department', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * PUT /api/departments/:id - Update department
 * 
 * Updates an existing department record with validation for:
 * - Unique department name
 * - Valid manager and parent department references
 * - Prevents circular parent-child relationships
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema.merge(updateDepartmentSchema)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingDepartment = await prisma.department.findUnique({
        where: { id },
      });

      if (!existingDepartment) {
        throw new AppError('Department not found', 404, null, 'NOT_FOUND');
      }

      // Check name uniqueness if name is being updated
      if (updateData.name && updateData.name.trim() !== existingDepartment.name) {
        const nameConflict = await prisma.department.findFirst({
          where: {
            name: { 
              equals: updateData.name.trim(), 
              mode: 'insensitive' 
            },
            NOT: { id }
          }
        });
        if (nameConflict) {
          throw new ValidationError('Department name already exists', null, 'DUPLICATE_DEPARTMENT_NAME');
        }
      }

      // Validate manager exists if provided
      if (updateData.managerId) {
        const manager = await prisma.employee.findFirst({
          where: { 
            id: updateData.managerId, 
            employmentStatus: 'ACTIVE' 
          }
        });
        if (!manager) {
          throw new ValidationError('Manager not found or not active', null, 'MANAGER_NOT_FOUND');
        }
      }

      // Validate parent department exists if provided and prevent circular references
      if (updateData.parentId !== undefined && updateData.parentId) {
        const parent = await prisma.department.findFirst({
          where: { 
            id: updateData.parentId, 
            isActive: true 
          }
        });
        if (!parent) {
          throw new ValidationError('Parent department not found or not active', null, 'PARENT_NOT_FOUND');
        }

        const hasCircularRef = await checkCircularReference(id, updateData.parentId);
        if (hasCircularRef) {
          throw new ValidationError('Cannot create circular parent-child relationship', null, 'CIRCULAR_REFERENCE');
        }
      }

      // Process update data
      const processedData = { ...updateData };
      if (updateData.name) {
        processedData.name = updateData.name.trim();
      }
      if (updateData.description !== undefined) {
        processedData.description = updateData.description?.trim() || null;
      }

      const updatedDepartment = await prisma.department.update({
        where: { id },
        data: {
          ...processedData,
          updatedById: req.user.id,
        },
        include: {
          manager: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: { select: { title: true } }
            }
          },
          parent: { select: { id: true, name: true } },
        },
      });

      await createAuditLog(req.user.id, 'UPDATE', 'departments', id, existingDepartment, updatedDepartment, req);
      res.json({ status: 'success', data: updatedDepartment });
    } catch (error) {
      logger.error('Error updating department', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/departments/:id - Soft delete department
 * 
 * Sets department as inactive and removes manager assignment.
 * Prevents deletion if department has active employees, child departments, or positions.
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const existingDepartment = await prisma.department.findUnique({
        where: { id },
        include: {
          employees: { 
            where: { employmentStatus: 'ACTIVE' },
            select: { id: true, firstName: true, lastName: true }
          },
          children: { 
            where: { isActive: true },
            select: { id: true, name: true }
          },
          positions: { 
            where: { isActive: true },
            select: { id: true, title: true }
          },
        },
      });

      if (!existingDepartment) {
        throw new AppError('Department not found', 404, null, 'NOT_FOUND');
      }

      if (!existingDepartment.isActive) {
        throw new ValidationError('Department is already inactive', null, 'ALREADY_INACTIVE');
      }

      // Check if department has active employees
      if (existingDepartment.employees.length > 0) {
        throw new ValidationError(
          `Cannot delete department with ${existingDepartment.employees.length} active employee(s). Please reassign employees first.`,
          null,
          'HAS_ACTIVE_EMPLOYEES'
        );
      }

      // Check if department has active child departments
      if (existingDepartment.children.length > 0) {
        throw new ValidationError(
          `Cannot delete department with ${existingDepartment.children.length} active child department(s). Please reassign or delete child departments first.`,
          null,
          'HAS_ACTIVE_CHILDREN'
        );
      }

      // Check if department has active positions
      if (existingDepartment.positions.length > 0) {
        throw new ValidationError(
          `Cannot delete department with ${existingDepartment.positions.length} active position(s). Please reassign or delete positions first.`,
          null,
          'HAS_ACTIVE_POSITIONS'
        );
      }

      const deletedDepartment = await prisma.department.update({
        where: { id },
        data: {
          isActive: false,
          managerId: null,
          updatedById: req.user.id,
        },
      });

      await createAuditLog(req.user.id, 'DELETE', 'departments', id, existingDepartment, deletedDepartment, req);
      res.json({ 
        status: 'success', 
        message: 'Department deactivated successfully',
        data: deletedDepartment 
      });
    } catch (error) {
      logger.error('Error deleting department', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

export default router;