import { z } from 'zod';
import prisma from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import logger from '../utils/logger.js';

const trainingProgramSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  duration: z.number().min(1, 'Duration must be at least 1 minute').optional(),
  isActive: z.boolean().default(true),
});

export const getTrainingPrograms = async ({ userRole, page = 1, limit = 10, isActive, search }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const skip = (page - 1) * limit;
  const where = {};
  
  if (isActive !== undefined) where.isActive = isActive;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

  try {
    const [programs, total] = await Promise.all([
      prisma.trainingProgram.findMany({
        where,
        skip,
        take: limit,
        include: {
          trainingRecords: {
            select: { id: true, employeeId: true, completedAt: true }
          },
          _count: {
            select: { trainingRecords: true }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.trainingProgram.count({ where })
    ]);

    return {
      programs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error fetching training programs', { error: error.message });
    throw new Error('Failed to fetch training programs');
  }
};

export const getTrainingProgramById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  try {
    const program = await prisma.trainingProgram.findUnique({
      where: { id },
      include: {
        trainingRecords: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, employeeId: true }
            }
          },
          orderBy: { enrolledAt: 'desc' }
        }
      }
    });
    
    if (!program) throw new NotFoundError('Training program not found');
    return program;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Error fetching training program', { error: error.message, id });
    throw new Error('Failed to fetch training program');
  }
};

export const createTrainingProgram = async ({ data, userRole, req }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const validatedData = trainingProgramSchema.parse(data);
  
  try {
    // Check if program name already exists
    const existingProgram = await prisma.trainingProgram.findFirst({
      where: { name: { equals: validatedData.name, mode: 'insensitive' } }
    });
    
    if (existingProgram) {
      throw new ValidationError('Training program name already exists');
    }
    
    const program = await prisma.trainingProgram.create({
      data: validatedData
    });
    
    if (req) {
      await createAuditLog(req.user.id, 'CREATE', 'training_programs', program.id, null, program, req);
    }
    
    return program;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    logger.error('Error creating training program', { error: error.message });
    throw new Error('Failed to create training program');
  }
};

export const updateTrainingProgram = async ({ id, data, userRole, req }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const validatedData = trainingProgramSchema.partial().parse(data);
  
  try {
    const existingProgram = await prisma.trainingProgram.findUnique({ where: { id } });
    if (!existingProgram) throw new NotFoundError('Training program not found');
    
    // Check name uniqueness if name is being updated
    if (validatedData.name && validatedData.name !== existingProgram.name) {
      const nameConflict = await prisma.trainingProgram.findFirst({
        where: { 
          name: { equals: validatedData.name, mode: 'insensitive' },
          NOT: { id }
        }
      });
      if (nameConflict) {
        throw new ValidationError('Training program name already exists');
      }
    }
    
    const program = await prisma.trainingProgram.update({
      where: { id },
      data: validatedData
    });
    
    if (req) {
      await createAuditLog(req.user.id, 'UPDATE', 'training_programs', id, existingProgram, program, req);
    }
    
    return program;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
    logger.error('Error updating training program', { error: error.message, id });
    throw new Error('Failed to update training program');
  }
};

export const deleteTrainingProgram = async ({ id, userRole, req }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  try {
    const existingProgram = await prisma.trainingProgram.findUnique({
      where: { id },
      include: {
        trainingRecords: {
          where: { completedAt: null }
        }
      }
    });
    
    if (!existingProgram) throw new NotFoundError('Training program not found');
    
    // Check if program has active training records
    if (existingProgram.trainingRecords.length > 0) {
      throw new ValidationError('Cannot delete program with active training records');
    }
    
    const program = await prisma.trainingProgram.update({
      where: { id },
      data: { isActive: false }
    });
    
    if (req) {
      await createAuditLog(req.user.id, 'DELETE', 'training_programs', id, existingProgram, program, req);
    }
    
    return program;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
    logger.error('Error deleting training program', { error: error.message, id });
    throw new Error('Failed to delete training program');
  }
};

export const trainingProgramService = {
  getTrainingPrograms,
  getTrainingProgramById,
  createTrainingProgram,
  updateTrainingProgram,
  deleteTrainingProgram
};