import { z } from 'zod';
import prisma from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import logger from '../utils/logger.js';

const trainingRecordSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  programId: z.string().uuid('Invalid program ID'),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  score: z.number().min(0).max(100).optional(),
  certificate: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
});

export const getTrainingRecords = async ({ userRole, userId, page = 1, limit = 10, employeeId, programId, search }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const skip = (page - 1) * limit;
  const where = {};
  
  if (employeeId) where.employeeId = employeeId;
  if (programId) where.programId = programId;
  
  // Role-based filtering
  if (userRole === 'EMPLOYEE') {
    where.employeeId = userId;
  } else if (userRole === 'MANAGER') {
    // Manager can see records for their subordinates
    const subordinates = await prisma.employee.findMany({
      where: { managerId: userId },
      select: { id: true }
    });
    const subordinateIds = subordinates.map(sub => sub.id);
    subordinateIds.push(userId); // Include self
    
    if (where.employeeId) {
      if (!subordinateIds.includes(where.employeeId)) {
        throw new UnauthorizedError('Access denied');
      }
    } else {
      where.employeeId = { in: subordinateIds };
    }
  }
  
  if (search) {
    where.OR = [
      { program: { name: { contains: search, mode: 'insensitive' } } },
      { employee: { firstName: { contains: search, mode: 'insensitive' } } },
      { employee: { lastName: { contains: search, mode: 'insensitive' } } }
    ];
  }

  try {
    const [records, total] = await Promise.all([
      prisma.trainingRecord.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true }
          },
          program: {
            select: { id: true, name: true, description: true, duration: true }
          }
        },
        orderBy: { enrolledAt: 'desc' }
      }),
      prisma.trainingRecord.count({ where })
    ]);

    return {
      records,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error fetching training records', { error: error.message });
    throw new Error('Failed to fetch training records');
  }
};

export const getTrainingRecordById = async ({ id, userRole, userId }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  try {
    const record = await prisma.trainingRecord.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        program: {
          select: { id: true, name: true, description: true, duration: true }
        }
      }
    });
    
    if (!record) throw new NotFoundError('Training record not found');
    
    // Check access permissions
    if (userRole === 'EMPLOYEE' && record.employeeId !== userId) {
      throw new UnauthorizedError('Access denied');
    }
    
    return record;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) throw error;
    logger.error('Error fetching training record', { error: error.message, id });
    throw new Error('Failed to fetch training record');
  }
};

export const createTrainingRecord = async ({ data, userRole, req }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const validatedData = trainingRecordSchema.parse(data);
  
  try {
    // Validate employee exists and is active
    const employee = await prisma.employee.findUnique({
      where: { id: validatedData.employeeId, employmentStatus: 'ACTIVE' }
    });
    if (!employee) throw new ValidationError('Employee not found or inactive');
    
    // Validate program exists and is active
    const program = await prisma.trainingProgram.findUnique({
      where: { id: validatedData.programId, isActive: true }
    });
    if (!program) throw new ValidationError('Training program not found or inactive');
    
    // Check if record already exists
    const existingRecord = await prisma.trainingRecord.findFirst({
      where: { 
        employeeId: validatedData.employeeId,
        programId: validatedData.programId
      }
    });
    if (existingRecord) {
      throw new ValidationError('Employee is already enrolled in this training program');
    }
    
    const record = await prisma.trainingRecord.create({
      data: {
        employeeId: validatedData.employeeId,
        programId: validatedData.programId,
        startedAt: validatedData.startedAt ? new Date(validatedData.startedAt) : null,
        completedAt: validatedData.completedAt ? new Date(validatedData.completedAt) : null,
        score: validatedData.score,
        certificate: validatedData.certificate,
        notes: validatedData.notes
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        program: {
          select: { id: true, name: true, description: true }
        }
      }
    });
    
    if (req) {
      await createAuditLog(req.user.id, 'CREATE', 'training_records', record.id, null, record, req);
    }
    
    return record;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    logger.error('Error creating training record', { error: error.message });
    throw new Error('Failed to create training record');
  }
};

export const updateTrainingRecord = async ({ id, data, userRole, req }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const validatedData = trainingRecordSchema.partial().parse(data);
  
  try {
    const existingRecord = await prisma.trainingRecord.findUnique({ where: { id } });
    if (!existingRecord) throw new NotFoundError('Training record not found');
    
    const updateData = { ...validatedData };
    if (validatedData.startedAt) updateData.startedAt = new Date(validatedData.startedAt);
    if (validatedData.completedAt) updateData.completedAt = new Date(validatedData.completedAt);
    
    const record = await prisma.trainingRecord.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        program: {
          select: { id: true, name: true, description: true }
        }
      }
    });
    
    if (req) {
      await createAuditLog(req.user.id, 'UPDATE', 'training_records', id, existingRecord, record, req);
    }
    
    return record;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Error updating training record', { error: error.message, id });
    throw new Error('Failed to update training record');
  }
};

export const deleteTrainingRecord = async ({ id, userRole, req }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  try {
    const existingRecord = await prisma.trainingRecord.findUnique({ where: { id } });
    if (!existingRecord) throw new NotFoundError('Training record not found');
    
    await prisma.trainingRecord.delete({ where: { id } });
    
    if (req) {
      await createAuditLog(req.user.id, 'DELETE', 'training_records', id, existingRecord, null, req);
    }
    
    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Error deleting training record', { error: error.message, id });
    throw new Error('Failed to delete training record');
  }
};

export const trainingRecordService = {
  getTrainingRecords,
  getTrainingRecordById,
  createTrainingRecord,
  updateTrainingRecord,
  deleteTrainingRecord
};