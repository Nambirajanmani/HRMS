import { z } from 'zod';
import prisma from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import logger from '../utils/logger.js';
import path from 'path';
import { promises as fs } from 'fs';

const documentSchema = z.object({
  employeeId: z.string().uuid().optional(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(500, 'Description too long').optional(),
  fileName: z.string().min(1, 'File name is required'),
  filePath: z.string().min(1, 'File path is required'),
  fileSize: z.number().min(1, 'File size must be positive'),
  mimeType: z.string().min(1, 'MIME type is required'),
  documentType: z.enum([
    'RESUME', 'ID_CARD', 'PASSPORT', 'DRIVING_LICENSE', 
    'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'SALARY_SLIP', 
    'BANK_STATEMENT', 'CONTRACT', 'POLICY', 'OTHER'
  ]),
  isConfidential: z.boolean().default(false),
  expiresAt: z.string().datetime().optional(),
});

export const getDocuments = async ({ userRole, userId, page = 1, limit = 10, employeeId, documentType, search }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const skip = (page - 1) * limit;
  const where = {};
  
  if (employeeId) where.employeeId = employeeId;
  if (documentType) where.documentType = documentType;
  
  // Role-based filtering
  if (userRole === 'EMPLOYEE') {
    where.employeeId = userId;
  } else if (userRole === 'MANAGER') {
    // Manager can see documents for their subordinates
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
      { title: { contains: search, mode: 'insensitive' } },
      { fileName: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } }
    ];
  }

  try {
    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, employeeId: true }
          },
          uploadedBy: {
            select: { id: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.document.count({ where })
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error fetching documents', { error: error.message });
    throw new Error('Failed to fetch documents');
  }
};

export const getDocumentById = async ({ id, userRole, userId }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  try {
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
    
    if (!document) throw new NotFoundError('Document not found');
    
    // Check access permissions
    if (userRole === 'EMPLOYEE' && document.employeeId !== userId) {
      throw new UnauthorizedError('Access denied');
    }
    
    return document;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof UnauthorizedError) throw error;
    logger.error('Error fetching document', { error: error.message, id });
    throw new Error('Failed to fetch document');
  }
};

export const createDocument = async ({ data, userRole, userId, req }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const validatedData = documentSchema.parse(data);
  
  try {
    // Validate employee if specified
    if (validatedData.employeeId) {
      const employee = await prisma.employee.findUnique({
        where: { id: validatedData.employeeId }
      });
      if (!employee) throw new ValidationError('Employee not found');
      
      // Check permissions
      if (userRole === 'EMPLOYEE' && validatedData.employeeId !== userId) {
        throw new UnauthorizedError('Access denied');
      }
    }
    
    const document = await prisma.document.create({
      data: {
        ...validatedData,
        uploadedById: userId,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null
      },
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
    
    if (req) {
      await createAuditLog(req.user.id, 'CREATE', 'documents', document.id, null, document, req);
    }
    
    return document;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) throw error;
    logger.error('Error creating document', { error: error.message });
    throw new Error('Failed to create document');
  }
};

export const updateDocument = async ({ id, data, userRole, req }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  const validatedData = documentSchema.partial().parse(data);
  
  try {
    const existingDocument = await prisma.document.findUnique({ where: { id } });
    if (!existingDocument) throw new NotFoundError('Document not found');
    
    const updateData = { ...validatedData };
    if (validatedData.expiresAt) updateData.expiresAt = new Date(validatedData.expiresAt);
    
    const document = await prisma.document.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, employeeId: true }
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });
    
    if (req) {
      await createAuditLog(req.user.id, 'UPDATE', 'documents', id, existingDocument, document, req);
    }
    
    return document;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Error updating document', { error: error.message, id });
    throw new Error('Failed to update document');
  }
};

export const deleteDocument = async ({ id, userRole, req }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) {
    throw new UnauthorizedError('Unauthorized');
  }
  
  try {
    const existingDocument = await prisma.document.findUnique({ where: { id } });
    if (!existingDocument) throw new NotFoundError('Document not found');
    
    // Delete physical file
    try {
      await fs.unlink(existingDocument.filePath);
    } catch (fileError) {
      logger.warn('Failed to delete physical file', { 
        error: fileError.message, 
        filePath: existingDocument.filePath 
      });
    }
    
    await prisma.document.delete({ where: { id } });
    
    if (req) {
      await createAuditLog(req.user.id, 'DELETE', 'documents', id, existingDocument, null, req);
    }
    
    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    logger.error('Error deleting document', { error: error.message, id });
    throw new Error('Failed to delete document');
  }
};

export const documentService = {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument
};