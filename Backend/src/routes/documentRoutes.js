// src/routes/documentRoutes.js - Complete updated version
import express from 'express';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { authenticate, authorize, authorizeEmployee } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import { uploadSingle, processImage, validateFileRequirements } from '../middleware/fileUpload.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import { documentService } from '../services/documentService.js';
import { ValidationError, AppError } from '../utils/errors.js';
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

// Document type validation
const VALID_DOCUMENT_TYPES = [
  'RESUME', 'ID_CARD', 'PASSPORT', 'DRIVING_LICENSE',
  'EDUCATION_CERTIFICATE', 'EXPERIENCE_LETTER', 'SALARY_SLIP',
  'BANK_STATEMENT', 'CONTRACT', 'POLICY', 'OTHER'
];

// Validation schemas
const documentSchemas = {
  create: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
      description: z.string().max(1000, 'Description too long').optional(),
      documentType: z.enum(VALID_DOCUMENT_TYPES, {
        errorMap: () => ({ message: 'Invalid document type' })
      }),
      employeeId: z.string().uuid('Invalid employee ID').optional(),
      isConfidential: z.boolean().optional().default(false),
      expiresAt: z.string().datetime('Invalid expiration date format').optional(),
    }),
  }),
  
  update: z.object({
    body: z.object({
      title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
      description: z.string().max(1000, 'Description too long').optional(),
      documentType: z.enum(VALID_DOCUMENT_TYPES, {
        errorMap: () => ({ message: 'Invalid document type' })
      }).optional(),
      employeeId: z.string().uuid('Invalid employee ID').optional(),
      isConfidential: z.boolean().optional(),
      expiresAt: z.string().datetime('Invalid expiration date format').optional(),
    }),
  }),
  
  idSchema: z.object({
    params: z.object({
      id: z.string().uuid('Invalid document ID'),
    }),
  }),
};

/**
 * GET /api/documents - List documents with pagination and filtering
 * 
 * Returns a paginated list of documents with optional filtering by:
 * - Employee ID
 * - Document type
 * - Search term (title/description)
 * 
 * Role-based access control:
 * - ADMIN/HR: Can see all documents
 * - MANAGER: Can see their own and subordinates' documents
 * - EMPLOYEE: Can see only their own documents
 */
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
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
      
      // Process document type with validation
      let documentType = null;
      if (!isEmpty(rawQuery.documentType)) {
        const type = rawQuery.documentType.trim().toUpperCase();
        if (!VALID_DOCUMENT_TYPES.includes(type)) {
          return res.status(400).json({
            status: 'error',
            message: 'Invalid document type',
            code: 'INVALID_DOCUMENT_TYPE',
            validValues: VALID_DOCUMENT_TYPES
          });
        }
        documentType = type;
      }
      
      // Call document service with processed parameters
      const result = await documentService.getDocuments({
        userRole: req.user.role,
        userId: req.user.employee?.id,
        page,
        limit,
        employeeId,
        documentType,
        search
      });

      // Log audit trail
      try {
        if (req.user?.id) {
          await createAuditLog(req.user.id, 'READ', 'documents', null, null, null, req);
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
        data: result,
      });
    } catch (error) {
      logger.error('Error fetching documents', { 
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
        next(new AppError('Failed to fetch documents', 500, null, 'SERVER_ERROR'));
      }
    }
  }
);

/**
 * GET /api/documents/:id - Get document details
 * 
 * Returns detailed information about a specific document.
 * Access controlled by document ownership and user role.
 */
router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(documentSchemas.idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const document = await documentService.getDocumentById({
        id,
        userRole: req.user.role,
        userId: req.user.employee?.id
      });

      if (!document) {
        throw new AppError('Document not found', 404, null, 'NOT_FOUND');
      }

      // Log audit trail
      try {
        await createAuditLog(req.user.id, 'READ', 'documents', id, null, null, req);
      } catch (auditError) {
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id,
          documentId: id
        });
      }

      res.json({ 
        status: 'success', 
        data: { document } 
      });
    } catch (error) {
      logger.error('Error fetching document', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * POST /api/documents - Upload document
 * 
 * Creates a new document record with file upload.
 * Validates file requirements and document metadata.
 */
router.post(
  '/',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  uploadSingle('file'),
  validateFileRequirements({ required: true }),
  processImage,
  validate(documentSchemas.create),
  async (req, res, next) => {
    try {
      // Validate file upload
      if (!req.file) {
        throw new ValidationError('No file uploaded', null, 'NO_FILE_UPLOADED');
      }

      // Validate employee exists if employeeId is provided
      const validatedData = req.validatedData.body;
      if (validatedData.employeeId) {
        try {
          const employee = await documentService.validateEmployee(validatedData.employeeId);
          if (!employee) {
            throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
          }
        } catch (validateError) {
          // Clean up uploaded file on validation error
          try {
            await fs.unlink(req.file.path);
          } catch (cleanupError) {
            logger.warn('Failed to cleanup uploaded file:', { 
              error: cleanupError.message,
              filePath: req.file.path 
            });
          }
          throw validateError;
        }
      }

      // Prepare document data
      const documentData = {
        ...validatedData,
        fileName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
      };

      const document = await documentService.createDocument({
        data: documentData,
        userRole: req.user.role,
        userId: req.user.employee?.id,
        createdById: req.user.id,
        req
      });

      // Log audit trail
      try {
        await createAuditLog(req.user.id, 'CREATE', 'documents', document.id, null, document, req);
      } catch (auditError) {
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id,
          documentId: document.id
        });
      }

      res.status(201).json({
        status: 'success',
        message: 'Document uploaded successfully',
        data: { document },
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          logger.warn('Failed to cleanup uploaded file:', { 
            error: cleanupError.message,
            filePath: req.file.path 
          });
        }
      }
      
      logger.error('Error creating document', { 
        error: error.message,
        stack: error.stack,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * PUT /api/documents/:id - Update document metadata
 * 
 * Updates document information (not the file itself).
 * Accessible only to ADMIN and HR roles.
 */
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(documentSchemas.idSchema.merge(documentSchemas.update)),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      const updateData = req.validatedData.body;
      
      // Get existing document for audit logging
      const existingDocument = await documentService.getDocumentById({
        id,
        userRole: req.user.role,
        userId: req.user.employee?.id
      });

      if (!existingDocument) {
        throw new AppError('Document not found', 404, null, 'NOT_FOUND');
      }

      // Validate employee exists if employeeId is being updated
      if (updateData.employeeId) {
        const employee = await documentService.validateEmployee(updateData.employeeId);
        if (!employee) {
          throw new ValidationError('Employee not found', null, 'EMPLOYEE_NOT_FOUND');
        }
      }

      // Process date fields
      const processedData = { ...updateData };
      if (updateData.expiresAt) {
        processedData.expiresAt = new Date(updateData.expiresAt);
      }

      const document = await documentService.updateDocument({
        id,
        data: processedData,
        userRole: req.user.role,
        updatedById: req.user.id,
        req
      });

      // Log audit trail
      try {
        await createAuditLog(req.user.id, 'UPDATE', 'documents', id, existingDocument, document, req);
      } catch (auditError) {
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id,
          documentId: id
        });
      }

      res.json({
        status: 'success',
        message: 'Document updated successfully',
        data: { document },
      });
    } catch (error) {
      logger.error('Error updating document', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * DELETE /api/documents/:id - Delete document
 * 
 * Deletes both the document record and the associated file.
 * Accessible only to ADMIN and HR roles.
 */
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN', 'HR'),
  validate(documentSchemas.idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      // Get existing document for audit logging and file cleanup
      const existingDocument = await documentService.getDocumentById({
        id,
        userRole: req.user.role,
        userId: req.user.employee?.id
      });

      if (!existingDocument) {
        throw new AppError('Document not found', 404, null, 'NOT_FOUND');
      }

      await documentService.deleteDocument({
        id,
        userRole: req.user.role,
        req
      });

      // Clean up the physical file
      if (existingDocument.filePath) {
        try {
          await fs.unlink(existingDocument.filePath);
        } catch (fileError) {
          // Log warning but don't fail the request if file deletion fails
          logger.warn('Failed to delete physical file', { 
            error: fileError.message,
            filePath: existingDocument.filePath,
            documentId: id
          });
        }
      }

      // Log audit trail
      try {
        await createAuditLog(req.user.id, 'DELETE', 'documents', id, existingDocument, null, req);
      } catch (auditError) {
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id,
          documentId: id
        });
      }

      res.json({
        status: 'success',
        message: 'Document deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting document', { 
        error: error.message, 
        id: req.params.id,
        userId: req.user?.id 
      });
      next(error);
    }
  }
);

/**
 * GET /api/documents/:id/download - Download document
 * 
 * Downloads the document file with appropriate headers.
 * Access controlled by document ownership and user role.
 */
router.get(
  '/:id/download',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(documentSchemas.idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const document = await documentService.getDocumentById({
        id,
        userRole: req.user.role,
        userId: req.user.employee?.id
      });

      if (!document) {
        throw new AppError('Document not found', 404, null, 'NOT_FOUND');
      }

      // Check if file exists on filesystem
      try {
        await fs.access(document.filePath);
      } catch (fileError) {
        logger.error('Document file not found on filesystem', {
          error: fileError.message,
          documentId: id,
          filePath: document.filePath
        });
        throw new AppError('File not found on server', 404, null, 'FILE_NOT_FOUND');
      }

      // Log audit trail for download
      try {
        await createAuditLog(req.user.id, 'DOWNLOAD', 'documents', id, null, null, req);
      } catch (auditError) {
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id,
          documentId: id
        });
      }
// Set headers for download
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${document.fileName}"`
    );
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', document.fileSize);

    // Send file
    res.sendFile(path.resolve(document.filePath), (err) => {
      if (err) {
        logger.error('Error sending file', { 
          error: err.message, 
          id: documentId,
          userId: req.user?.id 
        });
        next(err);
      }
    });

  } catch (error) {
    logger.error('Error downloading document', { 
      error: error.message, 
      id: req.params.id,
      userId: req.user?.id 
    });
    next(error);
  }
});

/**
 * GET /api/documents/:id/view - View document (for images/PDFs)
 * 
 * Displays the document inline in the browser.
 * Access controlled by document ownership and user role.
 */
router.get(
  '/:id/view',
  authenticate,
  authorize('ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'),
  validate(documentSchemas.idSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validatedData.params;
      
      const document = await documentService.getDocumentById({
        id,
        userRole: req.user.role,
        userId: req.user.employee?.id
      });

      if (!document) {
        throw new AppError('Document not found', 404, null, 'NOT_FOUND');
      }

      // Check if file exists on filesystem
      try {
        await fs.access(document.filePath);
      } catch (fileError) {
        logger.error('Document file not found on filesystem', {
          error: fileError.message,
          documentId: id,
          filePath: document.filePath
        });
        throw new AppError('File not found on server', 404, null, 'FILE_NOT_FOUND');
      }

      // Log audit trail for view
      try {
        await createAuditLog(req.user.id, 'VIEW', 'documents', id, null, null, req);
      } catch (auditError) {
        logger.warn('Audit log creation failed', { 
          error: auditError.message,
          userId: req.user?.id,
          documentId: id
        });
      }
// Set headers for inline viewing
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${document.fileName}"`
    );
    res.setHeader('Content-Length', document.fileSize);

    // Send file
    res.sendFile(path.resolve(document.filePath), (err) => {
      if (err) {
        logger.error('Error sending document', {
          error: err.message,
          id: documentId,
          userId: req.user?.id
        });
        next(err);
      }
    });

  } catch (error) {
    logger.error('Error viewing document', {
      error: error.message,
      id: req.params.id,
      userId: req.user?.id
    });
    next(error);
  }
});
export default router;