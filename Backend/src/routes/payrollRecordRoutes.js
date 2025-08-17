// src/routes/payrollRecordRoutes.js - Complete updated version
import express from 'express';
import { z } from 'zod';
import { authenticate, authorize, authorizeEmployee } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';
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

// Helper function to calculate payroll amounts
const calculatePayrollAmounts = (baseSalary, overtime = 0, bonuses = 0, allowances = 0, deductions = 0, tax = 0) => {
  const grossPay = baseSalary + overtime + bonuses + allowances;
  const netPay = grossPay - deductions - tax;
  return { grossPay, netPay };
};

// Helper function to validate date range
const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ValidationError('Invalid date format', null, 'INVALID_DATE_FORMAT');
  }
  
  if (start >= end) {
    throw new ValidationError('Pay period start date must be before end date', null, 'INVALID_DATE_RANGE');
  }
  
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // Typical pay periods are 7, 14, or 30 days
  if (diffDays > 62) { // Allow up to ~2 months for flexibility
    throw new ValidationError('Pay period cannot exceed 62 days', null, 'INVALID_DATE_RANGE');
  }
  
  return { start, end, diffDays };
};

// Simplified validation schema for list endpoint
const listPayrollRecordsSchema = z.object({
  query: z.object({
    page: z.union([z.string(), z.undefined()]).optional(),
    limit: z.union([z.string(), z.undefined()]).optional(),
    employeeId: z.union([z.string(), z.undefined()]).optional(),
    status: z.union([z.string(), z.undefined()]).optional(),
    startDate: z.union([z.string(), z.undefined()]).optional(),
    endDate: z.union([z.string(), z.undefined()]).optional(),
    search: z.union([z.string(), z.undefined()]).optional(),
  }),
});

const payrollRecordSchema = z.object({
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID'),
    payPeriodStart: z.string().datetime('Invalid date format'),
    payPeriodEnd: z.string().datetime('Invalid date format'),
    baseSalary: z.number().min(0, 'Base salary must be non-negative'),
    overtime: z.number().min(0, 'Overtime must be non-negative').optional().default(0),
    bonuses: z.number().min(0, 'Bonuses must be non-negative').optional().default(0),
    allowances: z.number().min(0, 'Allowances must be non-negative').optional().default(0),
    deductions: z.number().min(0, 'Deductions must be non-negative').optional().default(0),
    tax: z.number().min(0, 'Tax must be non-negative').optional().default(0),
    status: z.enum(['DRAFT', 'PROCESSED', 'PAID', 'CANCELLED']).optional().default('DRAFT'),
    notes: z.string().max(1000, 'Notes too long').optional(),
  }),
});

const updatePayrollRecordSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid payroll record ID'),
  }),
  body: z.object({
    employeeId: z.string().uuid('Invalid employee ID').optional(),
    payPeriodStart: z.string().datetime('Invalid date format').optional(),
    payPeriodEnd: z.string().datetime('Invalid date format').optional(),
    baseSalary: z.number().min(0, 'Base salary must be non-negative').optional(),
    overtime: z.number().min(0, 'Overtime must be non-negative').optional(),
    bonuses: z.number().min(0, 'Bonuses must be non-negative').optional(),
    allowances: z.number().min(0, 'Allowances must be non-negative').optional(),
    deductions: z.number().min(0, 'Deductions must be non-negative').optional(),
    tax: z.number().min(0, 'Tax must be non-negative').optional(),
    status: z.enum(['DRAFT', 'PROCESSED', 'PAID', 'CANCELLED']).optional(),
    notes: z.string().max(1000, 'Notes too long').optional(),
  }),
});

const idSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid payroll record ID'),
  }),
});

/**
 * GET /api/payroll - List payroll records with advanced filtering
 * 
 * Returns a paginated list of payroll records with optional filtering by:
 * - Employee ID
 * - Status
 * - Date range
 * - Search (employee name, ID, email)
 * 
 * Role-based access:
 * - ADMIN/HR: Can see all records
 * - MANAGER: Can see records for their subordinates and themselves
 * - EMPLOYEE: Can only see their own records
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  // Remove validation middleware and handle manually like in employeeRoutes
  async (req, res, next) => {
    try {
      // Manual parameter processing with proper error handling
      const rawQuery = req.query || {};
      
      // Process pagination parameters
      const page = safeParseInt(rawQuery.page, 1, 1, 1000);
      const limit = safeParseInt(rawQuery.limit, 10, 1, 100);
      
      // Process search parameter
      const search = isEmpty(rawQuery.search) ? null : rawQuery.search.trim();
      
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
      const validStatuses = ['DRAFT', 'PROCESSED', 'PAID', 'CANCELLED'];
      let status = null;
      if (!isEmpty(rawQuery.status)) {
        const statusValue = rawQuery.status.trim().toUpperCase();
        if (!validStatuses.includes(statusValue)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid status',
            code: 'INVALID_STATUS',
            validValues: validStatuses
          });
        }
        status = statusValue;
      }
      
      // Process date range
      let startDate = null;
      let endDate = null;
      
      if (!isEmpty(rawQuery.startDate)) {
        try {
          startDate = new Date(rawQuery.startDate);
          if (isNaN(startDate.getTime())) {
            throw new Error('Invalid start date');
          }
        } catch (error) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid start date format',
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
        } catch (error) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid end date format',
            code: 'INVALID_END_DATE'
          });
        }
      }
      
      // Validate date range if both dates provided
      if (startDate && endDate && startDate >= endDate) {
        return res.status(400).json({
          status: 'error',
          message: 'Start date must be before end date',
          code: 'INVALID_DATE_RANGE'
        });
      }
      
      // Build filters object - only include non-null values
      const filters = {};
      
      if (employeeId) {
        filters.employeeId = employeeId;
      }
      
      if (status) {
        filters.status = status;
      }
      
      // Add date range filtering
      if (startDate || endDate) {
        filters.payPeriodStart = {};
        if (startDate) filters.payPeriodStart.gte = startDate;
        if (endDate) filters.payPeriodStart.lte = endDate;
      }
      
      // Add search functionality
      if (search) {
        filters.employee = {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { employeeId: { contains: search, mode: 'insensitive' } },
          ]
        };
      }

      // Role-based filtering
      if (req.user && req.user.role) {
        const userRole = req.user.role.toUpperCase();
        
        if (userRole === 'EMPLOYEE' && req.user.employee) {
          // Employees can only see their own records
          filters.employeeId = req.user.employee.id;
        } else if (userRole === 'MANAGER' && req.user.employee) {
          try {
            // Managers can see records for their subordinates and themselves
            const subordinates = await prisma.employee.findMany({
              where: { managerId: req.user.employee.id },
              select: { id: true },
            });
            const subordinateIds = subordinates.map(sub => sub.id);
            subordinateIds.push(req.user.employee.id); // Include self
            
            // If employeeId filter is already applied, ensure it's within manager's scope
            if (filters.employeeId && !subordinateIds.includes(filters.employeeId)) {
              filters.employeeId = 'invalid-id'; // This will return no results
            } else if (!filters.employeeId) {
              filters.employeeId = { in: subordinateIds };
            }
          } catch (managerError) {
            logger.error('Error fetching manager subordinates for payroll', { 
              error: managerError.message,
              userId: req.user.id,
              managerId: req.user.employee?.id
            });
            // Fallback to only self records
            filters.employeeId = req.user.employee.id;
          }
        }
        // ADMIN and HR can see all records (no additional filtering needed)
      }

      // Execute database queries with error handling
      let records = [];
      let total = 0;

      try {
        [records, total] = await Promise.all([
          prisma.payrollRecord.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
            include: {
              employee: {
                select: {
                  id: true,
                  employeeId: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  department: {
                    select: { id: true, name: true },
                  },
                  position: {
                    select: { id: true, title: true },
                  },
                },
              },
            },
            orderBy: [
              { payPeriodStart: 'desc' },
              { createdAt: 'desc' }
            ],
          }),
          prisma.payrollRecord.count({ where: filters }),
        ]);
      } catch (dbError) {
        logger.error('Database error in payroll query', {
          error: dbError.message,
          stack: dbError.stack,
          filters,
          userId: req.user?.id
        });
        throw new AppError('Database query failed', 500, null, 'DATABASE_ERROR');
      }

      // Calculate summary statistics for the current filter
      let summaryStats = null;
      try {
        if (records.length > 0) {
          const totalGross = records.reduce((sum, record) => {
            const grossPay = record.baseSalary + record.overtime + record.bonuses + record.allowances;
            return sum + grossPay;
          }, 0);
          
          const totalNet = records.reduce((sum, record) => sum + record.netPay, 0);
          const totalTax = records.reduce((sum, record) => sum + record.tax, 0);
          const totalDeductions = records.reduce((sum, record) => sum + record.deductions, 0);
          
          summaryStats = {
            totalRecords: records.length,
            totalGrossPay: totalGross,
            totalNetPay: totalNet,
            totalTax: totalTax,
            totalDeductions: totalDeductions,
          };
        }
      } catch (statsError) {
        logger.warn('Error calculating summary stats', { error: statsError.message });
        // Continue without stats if calculation fails
      }

      // Log audit trail
      try {
        if (req.user?.id) {
          await createAuditLog(req.user.id, 'READ', 'payroll_records', null, null, null, req);
        }
      } catch (auditError) {
        // Don't fail the request if audit logging fails
        logger.warn('Audit log creation failed for payroll list', { 
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
          },
          summary: summaryStats
        },
      });
    } catch (error) {
      logger.error('Error fetching payroll records', { 
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
        next(new AppError('Failed to fetch payroll records', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/payroll/:id - Get single payroll record
 * 
 * Returns detailed information about a specific payroll record including:
 * - Complete payroll calculations
 * - Employee information
 * - Pay period details
 * 
 * Role-based access similar to list endpoint.
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const record = await prisma.payrollRecord.findUnique({
        where: { id },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              department: {
                select: { id: true, name: true },
              },
              position: {
                select: { id: true, title: true, level: true },
              },
              manager: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });

      if (!record) {
        throw new AppError('Payroll record not found', 404, null, 'NOT_FOUND');
      }

      // Role-based access control
      if (req.user && req.user.role) {
        const userRole = req.user.role.toUpperCase();
        
        if (userRole === 'EMPLOYEE' && req.user.employee?.id !== record.employeeId) {
          throw new AppError('Access denied: You can only view your own payroll records', 403, null, 'ACCESS_DENIED');
        } else if (userRole === 'MANAGER' && req.user.employee) {
          // Check if the record belongs to manager or their subordinates
          try {
            const subordinates = await prisma.employee.findMany({
              where: { managerId: req.user.employee.id },
              select: { id: true },
            });
            const subordinateIds = subordinates.map(sub => sub.id);
            subordinateIds.push(req.user.employee.id); // Include self
            
            if (!subordinateIds.includes(record.employeeId)) {
              throw new AppError('Access denied: You can only view payroll records for your subordinates', 403, null, 'ACCESS_DENIED');
            }
          } catch (managerError) {
            logger.error('Error checking manager access for payroll record', { 
              error: managerError.message,
              userId: req.user.id,
              recordId: id
            });
            // Fallback to checking if it's manager's own record
            if (req.user.employee.id !== record.employeeId) {
              throw new AppError('Access denied', 403, null, 'ACCESS_DENIED');
            }
          }
        }
        // ADMIN and HR have full access
      }

      // Add calculated fields for display
      const grossPay = record.baseSalary + record.overtime + record.bonuses + record.allowances;
      const recordWithCalculations = {
        ...record,
        grossPay,
        totalDeductions: record.deductions + record.tax,
      };

      await createAuditLog(req.user.id, 'READ', 'payroll_records', id, null, null, req);
      
      res.json({ 
        status: 'success', 
        data: recordWithCalculations 
      });
    } catch (error) {
      logger.error('Error fetching payroll record', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/payroll - Create new payroll record
 * 
 * Creates a new payroll record with validation for:
 * - Employee exists and is active
 * - Valid date range
 * - No overlapping pay periods for the same employee
 * - Automatic calculation of gross and net pay
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(payrollRecordSchema),
  async (req, res, next) => {
    try {
      const { 
        employeeId, 
        payPeriodStart, 
        payPeriodEnd, 
        baseSalary, 
        overtime, 
        bonuses, 
        allowances, 
        deductions, 
        tax, 
        status, 
        notes 
      } = req.validatedData.body;

      // Validate employee exists and is active
      const employee = await prisma.employee.findUnique({ 
        where: { 
          id: employeeId,
          employmentStatus: 'ACTIVE' 
        },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          employmentStatus: true,
        }
      });

      if (!employee) {
        throw new ValidationError('Employee not found or not active', null, 'EMPLOYEE_NOT_FOUND');
      }

      // Validate and process date range
      const { start: periodStart, end: periodEnd } = validateDateRange(payPeriodStart, payPeriodEnd);

      // Check for overlapping pay periods
      const overlappingRecord = await prisma.payrollRecord.findFirst({
        where: {
          employeeId,
          status: { not: 'CANCELLED' },
          OR: [
            {
              payPeriodStart: { lte: periodStart },
              payPeriodEnd: { gt: periodStart }
            },
            {
              payPeriodStart: { lt: periodEnd },
              payPeriodEnd: { gte: periodEnd }
            },
            {
              payPeriodStart: { gte: periodStart },
              payPeriodEnd: { lte: periodEnd }
            }
          ]
        }
      });

      if (overlappingRecord) {
        throw new ValidationError(
          'Overlapping pay period found for this employee',
          null,
          'OVERLAPPING_PAY_PERIOD'
        );
      }

      // Calculate gross and net pay
      const { grossPay, netPay } = calculatePayrollAmounts(
        baseSalary, overtime, bonuses, allowances, deductions, tax
      );

      const record = await prisma.payrollRecord.create({
        data: {
          employeeId,
          payPeriodStart: periodStart,
          payPeriodEnd: periodEnd,
          baseSalary,
          overtime: overtime || 0,
          bonuses: bonuses || 0,
          allowances: allowances || 0,
          deductions: deductions || 0,
          tax: tax || 0,
          netPay,
          status: status || 'DRAFT',
          notes,
          createdById: req.user.id,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { select: { id: true, name: true } },
              position: { select: { id: true, title: true } },
            },
          },
        },
      });

      // Add calculated field for response
      const recordWithCalculations = {
        ...record,
        grossPay,
      };

      await createAuditLog(req.user.id, 'CREATE', 'payroll_records', record.id, null, record, req);

      res.status(201).json({ 
        status: 'success', 
        message: 'Payroll record created successfully', 
        data: recordWithCalculations 
      });
    } catch (error) {
      logger.error('Error creating payroll record', { 
        error: error.message,
        userId: req.user?.id,
        employeeId: req.body?.employeeId
      });
      next(error);
    }
  }
);

/**
 * PUT /api/payroll/:id - Update payroll record
 * 
 * Updates an existing payroll record with validation for:
 * - Record exists and is in editable status
 * - Employee validation if changing employee
 * - Date range validation if changing dates
 * - No overlapping periods if changing dates or employee
 * - Automatic recalculation of amounts
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(updatePayrollRecordSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;

      const existingRecord = await prisma.payrollRecord.findUnique({ 
        where: { id },
        include: {
          employee: {
            select: { id: true, employeeId: true, firstName: true, lastName: true }
          }
        }
      });

      if (!existingRecord) {
        throw new AppError('Payroll record not found', 404, null, 'NOT_FOUND');
      }

      // Check if record can be edited
      if (['PAID'].includes(existingRecord.status)) {
        throw new ValidationError(
          'Cannot modify paid payroll records',
          null,
          'RECORD_NOT_EDITABLE'
        );
      }

      // Validate employee if changing
      if (updateData.employeeId && updateData.employeeId !== existingRecord.employeeId) {
        const employee = await prisma.employee.findUnique({ 
          where: { 
            id: updateData.employeeId,
            employmentStatus: 'ACTIVE' 
          }
        });
        if (!employee) {
          throw new ValidationError('Employee not found or not active', null, 'EMPLOYEE_NOT_FOUND');
        }
      }

      // Process and validate date changes
      let periodStart = existingRecord.payPeriodStart;
      let periodEnd = existingRecord.payPeriodEnd;
      let datesChanged = false;

      if (updateData.payPeriodStart || updateData.payPeriodEnd) {
        const newStartDate = updateData.payPeriodStart || existingRecord.payPeriodStart.toISOString();
        const newEndDate = updateData.payPeriodEnd || existingRecord.payPeriodEnd.toISOString();
        
        const { start, end } = validateDateRange(newStartDate, newEndDate);
        periodStart = start;
        periodEnd = end;
        datesChanged = true;
      }

      // Check for overlapping periods if dates or employee changed
      if (datesChanged || updateData.employeeId) {
        const targetEmployeeId = updateData.employeeId || existingRecord.employeeId;
        
        const overlappingRecord = await prisma.payrollRecord.findFirst({
          where: {
            id: { not: id }, // Exclude current record
            employeeId: targetEmployeeId,
            status: { not: 'CANCELLED' },
            OR: [
              {
                payPeriodStart: { lte: periodStart },
                payPeriodEnd: { gt: periodStart }
              },
              {
                payPeriodStart: { lt: periodEnd },
                payPeriodEnd: { gte: periodEnd }
              },
              {
                payPeriodStart: { gte: periodStart },
                payPeriodEnd: { lte: periodEnd }
              }
            ]
          }
        });

        if (overlappingRecord) {
          throw new ValidationError(
            'Overlapping pay period found for this employee',
            null,
            'OVERLAPPING_PAY_PERIOD'
          );
        }
      }

      // Prepare update data with proper date conversion
      const processedUpdateData = { ...updateData };
      if (updateData.payPeriodStart) {
        processedUpdateData.payPeriodStart = periodStart;
      }
      if (updateData.payPeriodEnd) {
        processedUpdateData.payPeriodEnd = periodEnd;
      }

      // Recalculate amounts if any financial fields changed
      const financialFields = ['baseSalary', 'overtime', 'bonuses', 'allowances', 'deductions', 'tax'];
      const hasFinancialChanges = financialFields.some(field => updateData[field] !== undefined);

      if (hasFinancialChanges) {
        const baseSalary = updateData.baseSalary ?? existingRecord.baseSalary;
        const overtime = updateData.overtime ?? existingRecord.overtime;
        const bonuses = updateData.bonuses ?? existingRecord.bonuses;
        const allowances = updateData.allowances ?? existingRecord.allowances;
        const deductions = updateData.deductions ?? existingRecord.deductions;
        const tax = updateData.tax ?? existingRecord.tax;

        const { netPay } = calculatePayrollAmounts(
          baseSalary, overtime, bonuses, allowances, deductions, tax
        );
        
        processedUpdateData.netPay = netPay;
      }

      processedUpdateData.updatedById = req.user.id;

      const updatedRecord = await prisma.payrollRecord.update({
        where: { id },
        data: processedUpdateData,
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              department: { select: { id: true, name: true } },
              position: { select: { id: true, title: true } },
            },
          },
        },
      });

      // Add calculated fields for response
      const grossPay = updatedRecord.baseSalary + updatedRecord.overtime + updatedRecord.bonuses + updatedRecord.allowances;
      const recordWithCalculations = {
        ...updatedRecord,
        grossPay,
      };

      await createAuditLog(req.user.id, 'UPDATE', 'payroll_records', id, existingRecord, updatedRecord, req);

      res.json({ 
        status: 'success', 
        message: 'Payroll record updated successfully', 
        data: recordWithCalculations 
      });
    } catch (error) {
      logger.error('Error updating payroll record', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/payroll/:id - Delete payroll record
 * 
 * Soft deletes a payroll record by setting status to CANCELLED.
 * Prevents deletion of processed or paid records.
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

      const existingRecord = await prisma.payrollRecord.findUnique({ 
        where: { id },
        include: {
          employee: {
            select: { id: true, employeeId: true, firstName: true, lastName: true }
          }
        }
      });

      if (!existingRecord) {
        throw new AppError('Payroll record not found', 404, null, 'NOT_FOUND');
      }

      if (['PROCESSED', 'PAID'].includes(existingRecord.status)) {
        throw new ValidationError(
          'Cannot delete processed or paid payroll records',
          null,
          'RECORD_NOT_DELETABLE'
        );
      }

      if (existingRecord.status === 'CANCELLED') {
        throw new ValidationError(
          'Payroll record is already cancelled',
          null,
          'ALREADY_CANCELLED'
        );
      }

      // Soft delete by setting status to CANCELLED
      const cancelledRecord = await prisma.payrollRecord.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          updatedById: req.user.id,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      await createAuditLog(req.user.id, 'DELETE', 'payroll_records', id, existingRecord, cancelledRecord, req);

      res.json({ 
        status: 'success', 
        message: 'Payroll record cancelled successfully',
        data: cancelledRecord
      });
    } catch (error) {
      logger.error('Error deleting payroll record', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * GET /api/payroll/employee/:employeeId/summary - Get payroll summary for specific employee
 * 
 * Returns payroll summary statistics for a specific employee including:
 * - Total records count
 * - YTD (Year-to-Date) totals
 * - Recent payroll history
 * 
 * Role-based access similar to other endpoints.
 */
router.get(
  '/employee/:employeeId/summary',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  async (req, res, next) => {
    try {
      const { employeeId } = req.params;

      if (!isValidUUID(employeeId)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid employee ID format',
          code: 'INVALID_EMPLOYEE_ID'
        });
      }

      // Verify employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
        }
      });

      if (!employee) {
        throw new AppError('Employee not found', 404, null, 'NOT_FOUND');
      }

      // Role-based access control
      if (req.user && req.user.role) {
        const userRole = req.user.role.toUpperCase();
        
        if (userRole === 'EMPLOYEE' && req.user.employee?.id !== employeeId) {
          throw new AppError('Access denied: You can only view your own payroll summary', 403, null, 'ACCESS_DENIED');
        } else if (userRole === 'MANAGER' && req.user.employee) {
          // Check if the employee is manager or their subordinate
          try {
            const subordinates = await prisma.employee.findMany({
              where: { managerId: req.user.employee.id },
              select: { id: true },
            });
            const subordinateIds = subordinates.map(sub => sub.id);
            subordinateIds.push(req.user.employee.id); // Include self
            
            if (!subordinateIds.includes(employeeId)) {
              throw new AppError('Access denied: You can only view payroll summaries for your subordinates', 403, null, 'ACCESS_DENIED');
            }
          } catch (managerError) {
            logger.error('Error checking manager access for payroll summary', { 
              error: managerError.message,
              userId: req.user.id,
              employeeId
            });
            // Fallback to checking if it's manager's own record
            if (req.user.employee.id !== employeeId) {
              throw new AppError('Access denied', 403, null, 'ACCESS_DENIED');
            }
          }
        }
        // ADMIN and HR have full access
      }

      // Get current year for YTD calculations
      const currentYear = new Date().getFullYear();
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

      // Get payroll summary data
      const [allRecords, ytdRecords, recentRecords] = await Promise.all([
        // All time records (excluding cancelled)
        prisma.payrollRecord.findMany({
          where: {
            employeeId,
            status: { not: 'CANCELLED' }
          },
          select: {
            id: true,
            baseSalary: true,
            overtime: true,
            bonuses: true,
            allowances: true,
            deductions: true,
            tax: true,
            netPay: true,
            status: true,
          }
        }),
        
        // Year-to-date records
        prisma.payrollRecord.findMany({
          where: {
            employeeId,
            status: { not: 'CANCELLED' },
            payPeriodStart: {
              gte: yearStart,
              lte: yearEnd
            }
          },
          select: {
            id: true,
            baseSalary: true,
            overtime: true,
            bonuses: true,
            allowances: true,
            deductions: true,
            tax: true,
            netPay: true,
            status: true,
          }
        }),
        
        // Recent 6 months records for trend analysis
        prisma.payrollRecord.findMany({
          where: {
            employeeId,
            status: { not: 'CANCELLED' },
            payPeriodStart: {
              gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) // ~6 months ago
            }
          },
          select: {
            id: true,
            payPeriodStart: true,
            payPeriodEnd: true,
            baseSalary: true,
            overtime: true,
            bonuses: true,
            allowances: true,
            deductions: true,
            tax: true,
            netPay: true,
            status: true,
          },
          orderBy: { payPeriodStart: 'desc' },
          take: 10
        })
      ]);

      // Calculate all-time totals
      const allTimeTotals = allRecords.reduce((acc, record) => {
        const grossPay = record.baseSalary + record.overtime + record.bonuses + record.allowances;
        acc.totalRecords += 1;
        acc.totalGrossPay += grossPay;
        acc.totalNetPay += record.netPay;
        acc.totalTax += record.tax;
        acc.totalDeductions += record.deductions;
        acc.totalOvertime += record.overtime;
        acc.totalBonuses += record.bonuses;
        return acc;
      }, {
        totalRecords: 0,
        totalGrossPay: 0,
        totalNetPay: 0,
        totalTax: 0,
        totalDeductions: 0,
        totalOvertime: 0,
        totalBonuses: 0,
      });

      // Calculate YTD totals
      const ytdTotals = ytdRecords.reduce((acc, record) => {
        const grossPay = record.baseSalary + record.overtime + record.bonuses + record.allowances;
        acc.totalRecords += 1;
        acc.totalGrossPay += grossPay;
        acc.totalNetPay += record.netPay;
        acc.totalTax += record.tax;
        acc.totalDeductions += record.deductions;
        acc.totalOvertime += record.overtime;
        acc.totalBonuses += record.bonuses;
        return acc;
      }, {
        totalRecords: 0,
        totalGrossPay: 0,
        totalNetPay: 0,
        totalTax: 0,
        totalDeductions: 0,
        totalOvertime: 0,
        totalBonuses: 0,
      });

      // Add calculated gross pay to recent records
      const recentRecordsWithGross = recentRecords.map(record => ({
        ...record,
        grossPay: record.baseSalary + record.overtime + record.bonuses + record.allowances
      }));

      // Calculate status distribution
      const statusDistribution = allRecords.reduce((acc, record) => {
        acc[record.status] = (acc[record.status] || 0) + 1;
        return acc;
      }, {});

      await createAuditLog(req.user.id, 'READ', 'payroll_summary', employeeId, null, null, req);

      res.json({
        status: 'success',
        data: {
          employee,
          summary: {
            allTime: allTimeTotals,
            yearToDate: {
              ...ytdTotals,
              year: currentYear
            },
            statusDistribution,
            averageNetPay: allTimeTotals.totalRecords > 0 ? 
              Math.round(allTimeTotals.totalNetPay / allTimeTotals.totalRecords * 100) / 100 : 0,
            averageGrossPay: allTimeTotals.totalRecords > 0 ? 
              Math.round(allTimeTotals.totalGrossPay / allTimeTotals.totalRecords * 100) / 100 : 0,
          },
          recentPayrolls: recentRecordsWithGross
        }
      });
    } catch (error) {
      logger.error('Error fetching payroll summary', { 
        error: error.message, 
        employeeId: req.params.employeeId,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/payroll/:id/process - Process a payroll record
 * 
 * Changes status from DRAFT to PROCESSED.
 * Validates that all required fields are present and calculations are correct.
 * 
 * Accessible only to ADMIN and HR roles.
 */
router.post(
  '/:id/process',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const existingRecord = await prisma.payrollRecord.findUnique({ 
        where: { id },
        include: {
          employee: {
            select: { 
              id: true, 
              employeeId: true, 
              firstName: true, 
              lastName: true,
              employmentStatus: true
            }
          }
        }
      });

      if (!existingRecord) {
        throw new AppError('Payroll record not found', 404, null, 'NOT_FOUND');
      }

      if (existingRecord.status !== 'DRAFT') {
        throw new ValidationError(
          `Cannot process payroll record with status: ${existingRecord.status}`,
          null,
          'INVALID_STATUS_TRANSITION'
        );
      }

      // Verify employee is still active
      if (existingRecord.employee.employmentStatus !== 'ACTIVE') {
        throw new ValidationError(
          'Cannot process payroll for inactive employee',
          null,
          'EMPLOYEE_INACTIVE'
        );
      }

      // Validate calculations
      const expectedGross = existingRecord.baseSalary + existingRecord.overtime + 
                            existingRecord.bonuses + existingRecord.allowances;
      const expectedNet = expectedGross - existingRecord.deductions - existingRecord.tax;

      if (Math.abs(expectedNet - existingRecord.netPay) > 0.01) {
        throw new ValidationError(
          'Payroll calculations are incorrect. Please update the record.',
          null,
          'CALCULATION_ERROR'
        );
      }

      const processedRecord = await prisma.payrollRecord.update({
        where: { id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          processedById: req.user.id,
          updatedById: req.user.id,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      await createAuditLog(
        req.user.id, 
        'UPDATE', 
        'payroll_records', 
        id, 
        existingRecord, 
        processedRecord, 
        req,
        'Payroll record processed'
      );

      res.json({ 
        status: 'success', 
        message: 'Payroll record processed successfully',
        data: processedRecord
      });
    } catch (error) {
      logger.error('Error processing payroll record', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/payroll/:id/pay - Mark payroll record as paid
 */
router.post(
  '/:id/pay',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;

      const existingRecord = await prisma.payrollRecord.findUnique({ 
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
        throw new AppError('Payroll record not found', 404, null, 'NOT_FOUND');
      }

      if (existingRecord.status !== 'PROCESSED') {
        throw new ValidationError(
          `Cannot mark as paid. Record must be processed first. Current status: ${existingRecord.status}`,
          null,
          'INVALID_STATUS_TRANSITION'
        );
      }

      const paidRecord = await prisma.payrollRecord.update({
        where: { id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paidById: req.user.id,
          updatedById: req.user.id,
        },
        include: {
          employee: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      await createAuditLog(
        req.user.id, 
        'UPDATE', 
        'payroll_records', 
        id, 
        existingRecord, 
        paidRecord, 
        req,
        'Payroll record marked as paid'
      );

      res.json({ 
        status: 'success', 
        message: 'Payroll record marked as paid successfully',
        data: paidRecord
      });
    } catch (error) {
      logger.error('Error marking payroll as paid', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

export default router;
