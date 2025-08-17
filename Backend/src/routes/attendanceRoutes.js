// src/routes/attendanceRoutes.js - Updated version based on employeeRoutes pattern
import express from 'express';
import { z } from 'zod';
import { authenticate, authorize, authorizeEmployee } from '../middleware/auth.js';
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

// Helper function to validate ISO date string
const isValidISODate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString.includes('T');
};

// Helper function to validate date-only string (YYYY-MM-DD)
const isValidDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  const date = new Date(dateString + 'T00:00:00.000Z');
  return !isNaN(date.getTime());
};

// Utility to calculate hours worked
const calculateHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const inTime = new Date(checkIn);
  const outTime = new Date(checkOut);
  if (outTime < inTime) outTime.setDate(outTime.getDate() + 1); // Handle overnight shifts
  return Math.max(0, (outTime - inTime) / (1000 * 60 * 60));
};

// Simplified validation schema for listing - handle parameters manually
const listSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.undefined()]).optional(),
    limit: z.union([z.string(), z.undefined()]).optional(),
    employeeId: z.union([z.string(), z.undefined()]).optional(),
    date: z.union([z.string(), z.undefined()]).optional(),
    status: z.union([z.string(), z.undefined()]).optional(),
    startDate: z.union([z.string(), z.undefined()]).optional(),
    endDate: z.union([z.string(), z.undefined()]).optional(),
  }),
});

// Validation schemas for other operations
const attendanceSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    date: z.string().refine(isValidDate, 'Invalid date format. Use YYYY-MM-DD'),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME']),
    checkIn: z.string().refine(isValidISODate, 'Invalid checkIn format. Use ISO 8601 datetime').optional(),
    checkOut: z.string().refine(isValidISODate, 'Invalid checkOut format. Use ISO 8601 datetime').optional(),
    notes: z.string().max(500, 'Notes must be less than 500 characters').optional(),
  }),
});

const updateAttendanceSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID').optional(),
    date: z.string().refine(isValidDate, 'Invalid date format. Use YYYY-MM-DD').optional(),
    status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME']).optional(),
    checkIn: z.string().refine(isValidISODate, 'Invalid checkIn format. Use ISO 8601 datetime').nullable().optional(),
    checkOut: z.string().refine(isValidISODate, 'Invalid checkOut format. Use ISO 8601 datetime').nullable().optional(),
    notes: z.string().max(500, 'Notes must be less than 500 characters').nullable().optional(),
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid attendance ID'),
  }),
});

/**
 * GET /api/attendance - Get all attendance records with pagination
 * 
 * Returns a paginated list of attendance records with optional filtering.
 * Accessible to ADMIN, HR, and MANAGER roles.
 * Managers can only see their own subordinates' records and their own.
 * Employees can only see their own records.
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  // Remove validation middleware and handle manually
  async (req, res, next) => {
    try {
      // Manual parameter processing with proper error handling
      const rawQuery = req.query || {};
      
      // Process pagination parameters
      const page = safeParseInt(rawQuery.page, 1, 1, 1000);
      const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
      
      // Process employeeId with UUID validation
      let employeeId = null;
      if (!isEmpty(rawQuery.employeeId)) {
        const empId = rawQuery.employeeId.trim();
        if (!isValidUUID(empId)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid employee ID format',
            code: 'INVALID_EMPLOYEE_ID'
          });
        }
        employeeId = empId;
      }
      
      // Process status with validation
      const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME'];
      let status = null;
      if (!isEmpty(rawQuery.status)) {
        const statusParam = rawQuery.status.trim().toUpperCase();
        if (!validStatuses.includes(statusParam)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid attendance status',
            code: 'INVALID_STATUS',
            validValues: validStatuses
          });
        }
        status = statusParam;
      }
      
      // Process date parameters
      let dateFilter = null;
      if (!isEmpty(rawQuery.date)) {
        const dateParam = rawQuery.date.trim();
        if (!isValidDate(dateParam)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid date format. Use YYYY-MM-DD',
            code: 'INVALID_DATE_FORMAT'
          });
        }
        const targetDate = new Date(dateParam + 'T00:00:00.000Z');
        const startOfDay = new Date(targetDate);
        const endOfDay = new Date(targetDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        dateFilter = { gte: startOfDay, lte: endOfDay };
      } else {
        // Process date range
        let startDate = null;
        let endDate = null;
        
        if (!isEmpty(rawQuery.startDate)) {
          const startParam = rawQuery.startDate.trim();
          if (!isValidDate(startParam)) {
            return res.status(400).json({
              status: 'error',
              message: 'Invalid startDate format. Use YYYY-MM-DD',
              code: 'INVALID_START_DATE_FORMAT'
            });
          }
          startDate = new Date(startParam + 'T00:00:00.000Z');
        }
        
        if (!isEmpty(rawQuery.endDate)) {
          const endParam = rawQuery.endDate.trim();
          if (!isValidDate(endParam)) {
            return res.status(400).json({
              status: 'error',
              message: 'Invalid endDate format. Use YYYY-MM-DD',
              code: 'INVALID_END_DATE_FORMAT'
            });
          }
          endDate = new Date(endParam + 'T23:59:59.999Z');
        }
        
        if (startDate || endDate) {
          dateFilter = {};
          if (startDate) dateFilter.gte = startDate;
          if (endDate) dateFilter.lte = endDate;
          
          // Validate date range
          if (startDate && endDate && startDate > endDate) {
            return res.status(400).json({
              status: 'error',
              message: 'Start date cannot be after end date',
              code: 'INVALID_DATE_RANGE'
            });
          }
        }
      }

      // Build filters object - only include non-null values
      const filters = {};
      
      if (employeeId) {
        filters.employeeId = employeeId;
      }
      
      if (status) {
        filters.status = status;
      }
      
      if (dateFilter) {
        filters.date = dateFilter;
      }

      // Role-based filtering
      if (req.user && req.user.role) {
        const userRole = req.user.role.toUpperCase();
        
        if (userRole === 'EMPLOYEE') {
          // Employees can only see their own records
          if (req.user.employee?.id) {
            filters.employeeId = req.user.employee.id;
          } else {
            // If employee doesn't have an employee record, return empty results
            return res.json({
              status: 'success',
              data: {
                records: [],
                pagination: { total: 0, page: 1, limit, pages: 0 }
              },
            });
          }
        } else if (userRole === 'MANAGER' && req.user.employee) {
          // Managers can see their subordinates' records and their own
          try {
            const subordinates = await prisma.employee.findMany({
              where: { managerId: req.user.employee.id },
              select: { id: true },
            });
            const subordinateIds = subordinates.map(sub => sub.id);
            subordinateIds.push(req.user.employee.id); // Include self
            
            // If employeeId filter is already set, make sure it's in the allowed list
            if (filters.employeeId) {
              if (!subordinateIds.includes(filters.employeeId)) {
                return res.status(403).json({
                  status: 'error',
                  message: 'Access denied to this employee\'s records',
                  code: 'ACCESS_DENIED'
                });
              }
            } else {
              filters.employeeId = { in: subordinateIds };
            }
          } catch (managerError) {
            logger.error('Error fetching manager subordinates', { 
              error: managerError.message,
              userId: req.user.id,
              managerId: req.user.employee?.id
            });
            // Continue without manager filtering in case of error
          }
        }
      }

      // Execute database queries with error handling
      let records = [];
      let total = 0;

      try {
        [records, total] = await Promise.all([
          prisma.attendance.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { date: 'desc' },
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  firstName: true,
                  lastName: true,
                  department: { 
                    select: { id: true, name: true } 
                  },
                },
              },
            },
          }),
          prisma.attendance.count({ where: filters }),
        ]);
      } catch (dbError) {
        logger.error('Database error in attendance query', {
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
          await createAuditLog(req.user.id, 'READ', 'attendance', null, null, null, req);
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
          records,
          pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            pages: Math.ceil(total / limit)
          }
        },
      });
    } catch (error) {
      logger.error('Error fetching attendance records', { 
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
        next(new AppError('Failed to fetch attendance records', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/attendance/:id - Get single attendance record
 * 
 * Returns detailed information about a specific attendance record.
 * Accessible to ADMIN, HR, MANAGER, and the employee themselves.
 * Access control is enforced based on user role and employee relationship.
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const record = await prisma.attendance.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { 
                select: { id: true, name: true } 
              },
              position: {
                select: { id: true, title: true }
              }
            },
          },
        },
      });

      if (!record) {
        throw new AppError('Attendance record not found', 404, null, 'NOT_FOUND');
      }

      // Role-based access control
      if (req.user && req.user.role) {
        const userRole = req.user.role.toUpperCase();
        
        if (userRole === 'EMPLOYEE') {
          // Employees can only see their own records
          if (req.user.employee?.id !== record.employeeId) {
            throw new AppError('Access denied to this attendance record', 403, null, 'ACCESS_DENIED');
          }
        } else if (userRole === 'MANAGER' && req.user.employee) {
          // Managers can see their subordinates' records and their own
          if (req.user.employee.id !== record.employeeId) {
            const subordinates = await prisma.employee.findMany({
              where: { managerId: req.user.employee.id },
              select: { id: true },
            });
            const subordinateIds = subordinates.map(sub => sub.id);
            
            if (!subordinateIds.includes(record.employeeId)) {
              throw new AppError('Access denied to this attendance record', 403, null, 'ACCESS_DENIED');
            }
          }
        }
      }

      await createAuditLog(req.user.id, 'READ', 'attendance', id, null, null, req);
      res.json({ status: 'success', data: record });
    } catch (error) {
      logger.error('Error fetching attendance record', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/attendance - Create a new attendance record
 * 
 * Creates a new attendance record with validation for:
 * - Valid employee ID and date
 * - No duplicate records for same employee and date
 * - Proper check-in/check-out time validation
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(attendanceSchema),
  async (req, res, next) => {
    try {
      const attendanceData = req.validatedData.body;

      // Validate employee exists and is active
      const employee = await prisma.employee.findUnique({
        where: { id: attendanceData.employeeId },
        select: { 
          id: true, 
          employeeId: true, 
          firstName: true, 
          lastName: true,
          employmentStatus: true 
        }
      });

      if (!employee) {
        throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
      }

      if (employee.employmentStatus !== 'ACTIVE') {
        throw new ValidationError('Employee is not active', null, 'EMPLOYEE_NOT_ACTIVE');
      }

      // Check for duplicate record
      const targetDate = new Date(attendanceData.date + 'T00:00:00.000Z');
      const existingRecord = await prisma.attendance.findFirst({
        where: { 
          employeeId: attendanceData.employeeId,
          date: {
            gte: targetDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
          }
        },
      });

      if (existingRecord) {
        throw new ValidationError('Attendance record already exists for this employee on this date', null, 'DUPLICATE_RECORD');
      }

      // Validate check-in/check-out times
      if (attendanceData.checkIn && attendanceData.checkOut) {
        const checkInTime = new Date(attendanceData.checkIn);
        const checkOutTime = new Date(attendanceData.checkOut);
        
        if (checkOutTime <= checkInTime) {
          throw new ValidationError('Check-out time must be after check-in time', null, 'INVALID_TIME_RANGE');
        }
      }

      // Prepare attendance data
      const createData = {
        employeeId: attendanceData.employeeId,
        date: targetDate,
        status: attendanceData.status,
        notes: attendanceData.notes?.trim() || null,
        createdById: req.user.id,
      };

      if (attendanceData.checkIn) {
        createData.checkIn = new Date(attendanceData.checkIn);
      }

      if (attendanceData.checkOut) {
        createData.checkOut = new Date(attendanceData.checkOut);
      }

      // Calculate hours worked if both times are provided
      if (attendanceData.checkIn && attendanceData.checkOut) {
        createData.hoursWorked = calculateHours(attendanceData.checkIn, attendanceData.checkOut);
      }

      const newRecord = await prisma.attendance.create({
        data: createData,
        include: { 
          employee: { 
            select: { 
              id: true, 
              employeeId: true, 
              firstName: true, 
              lastName: true,
              department: { select: { id: true, name: true } }
            } 
          } 
        },
      });

      await createAuditLog(req.user.id, 'CREATE', 'attendance', newRecord.id, null, newRecord, req);
      res.status(201).json({ status: 'success', data: newRecord });
    } catch (error) {
      logger.error('Error creating attendance record', { 
        error: error.message,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * PUT /api/attendance/:id - Update attendance record
 * 
 * Updates an existing attendance record with validation for:
 * - Valid employee ID and date
 * - Proper check-in/check-out time validation
 * - No duplicate records if employee or date is changed
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema.merge(updateAttendanceSchema)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingRecord = await prisma.attendance.findUnique({
        where: { id },
      });

      if (!existingRecord) {
        throw new AppError('Attendance record not found', 404, null, 'NOT_FOUND');
      }

      // Validate employee if being updated
      if (updateData.employeeId) {
        const employee = await prisma.employee.findUnique({
          where: { id: updateData.employeeId },
          select: { 
            id: true, 
            employmentStatus: true 
          }
        });

        if (!employee) {
          throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
        }

        if (employee.employmentStatus !== 'ACTIVE') {
          throw new ValidationError('Employee is not active', null, 'EMPLOYEE_NOT_ACTIVE');
        }
      }

      // Check for duplicate if employee or date is being changed
      const newEmployeeId = updateData.employeeId || existingRecord.employeeId;
      const newDate = updateData.date ? new Date(updateData.date + 'T00:00:00.000Z') : existingRecord.date;
      
      if (updateData.employeeId || updateData.date) {
        const duplicateRecord = await prisma.attendance.findFirst({
          where: { 
            employeeId: newEmployeeId,
            date: {
              gte: newDate,
              lt: new Date(newDate.getTime() + 24 * 60 * 60 * 1000)
            },
            NOT: { id }
          },
        });

        if (duplicateRecord) {
          throw new ValidationError('Attendance record already exists for this employee on this date', null, 'DUPLICATE_RECORD');
        }
      }

      // Validate check-in/check-out times
      const checkIn = updateData.checkIn !== undefined ? 
        (updateData.checkIn ? new Date(updateData.checkIn) : null) : 
        existingRecord.checkIn;
      const checkOut = updateData.checkOut !== undefined ? 
        (updateData.checkOut ? new Date(updateData.checkOut) : null) : 
        existingRecord.checkOut;

      if (checkIn && checkOut && checkOut <= checkIn) {
        throw new ValidationError('Check-out time must be after check-in time', null, 'INVALID_TIME_RANGE');
      }

      // Prepare update data
      const processedData = { ...updateData };
      
      if (updateData.date) {
        processedData.date = newDate;
      }
      
      if (updateData.checkIn !== undefined) {
        processedData.checkIn = updateData.checkIn ? new Date(updateData.checkIn) : null;
      }
      
      if (updateData.checkOut !== undefined) {
        processedData.checkOut = updateData.checkOut ? new Date(updateData.checkOut) : null;
      }

      if (updateData.notes !== undefined) {
        processedData.notes = updateData.notes?.trim() || null;
      }

      // Calculate hours worked if both times are available
      if (checkIn && checkOut) {
        processedData.hoursWorked = calculateHours(checkIn.toISOString(), checkOut.toISOString());
      } else if (!checkIn || !checkOut) {
        processedData.hoursWorked = 0;
      }

      const updatedRecord = await prisma.attendance.update({
        where: { id },
        data: {
          ...processedData,
          updatedById: req.user.id,
        },
        include: { 
          employee: { 
            select: { 
              id: true, 
              employeeId: true, 
              firstName: true, 
              lastName: true,
              department: { select: { id: true, name: true } }
            } 
          } 
        },
      });

      await createAuditLog(req.user.id, 'UPDATE', 'attendance', id, existingRecord, updatedRecord, req);
      res.json({ status: 'success', data: updatedRecord });
    } catch (error) {
      logger.error('Error updating attendance record', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/attendance/:id - Delete attendance record
 * 
 * Permanently deletes an attendance record.
 * This is a hard delete operation.
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
      
      const existingRecord = await prisma.attendance.findUnique({
        where: { id },
        include: {
          employee: {
            select: { 
              id: true, 
              employeeId: true, 
              firstName: true, 
              lastName: true 
            }
          }
        }
      });

      if (!existingRecord) {
        throw new AppError('Attendance record not found', 404, null, 'NOT_FOUND');
      }

      await prisma.attendance.delete({ where: { id } });

      await createAuditLog(req.user.id, 'DELETE', 'attendance', id, existingRecord, null, req);
      res.json({ 
        status: 'success', 
        message: 'Attendance record deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting attendance record', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

export default router;