import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

// Ensure upload directories exist
const ensureUploadDirectories = async () => {
  const directories = [
    'uploads',
    'uploads/documents',
    'uploads/images',
    'uploads/temp'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory ${dir}:`, error);
    }
  }
};

// Initialize directories
ensureUploadDirectories();

// File type validation
const allowedMimeTypes = {
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf'
  ],
  images: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
};

const allowedExtensions = {
  documents: ['.pdf', '.doc', '.docx', '.txt', '.rtf'],
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const uploadPath = isImage ? 'uploads/images' : 'uploads/documents';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const ext = path.extname(file.originalname);
    const filename = `${uniqueSuffix}${ext}`;
    cb(null, filename);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith('image/');
  const allowedTypes = isImage ? allowedMimeTypes.images : allowedMimeTypes.documents;
  const allowedExts = isImage ? allowedExtensions.images : allowedExtensions.documents;
  
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedTypes.includes(file.mimetype) || !allowedExts.includes(ext)) {
    const error = new ValidationError(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    );
    return cb(error, false);
  }
  
  cb(null, true);
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Single file upload
  }
});

// Image processing middleware
export const processImage = async (req, res, next) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    return next();
  }

  try {
    const { filename, path: filePath } = req.file;
    const outputPath = path.join('uploads/images', `processed_${filename}`);
    
    // Process image with sharp
    await sharp(filePath)
      .resize(800, 600, { 
        fit: 'inside',
        withoutEnlargement: true 
      })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    
    // Update file info
    req.file.path = outputPath;
    req.file.filename = `processed_${filename}`;
    
    // Delete original file
    await fs.unlink(filePath);
    
    next();
  } catch (error) {
    logger.error('Image processing failed:', error);
    next(error);
  }
};

// File upload middleware with error handling
export const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ValidationError('File size too large. Maximum size is 5MB'));
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new ValidationError('Unexpected file field'));
        }
        return next(new ValidationError(`Upload error: ${err.message}`));
      }
      
      if (err) {
        return next(err);
      }
      
      // Add file metadata to request
      if (req.file) {
        req.fileMetadata = {
          originalName: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size,
          mimeType: req.file.mimetype
        };
      }
      
      next();
    });
  };
};

// Multiple file upload
export const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ValidationError('File size too large. Maximum size is 5MB'));
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return next(new ValidationError(`Too many files. Maximum is ${maxCount}`));
        }
        return next(new ValidationError(`Upload error: ${err.message}`));
      }
      
      if (err) {
        return next(err);
      }
      
      // Add files metadata to request
      if (req.files && req.files.length > 0) {
        req.filesMetadata = req.files.map(file => ({
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimeType: file.mimetype
        }));
      }
      
      next();
    });
  };
};

// Clean up temporary files
export const cleanupFiles = async (filePaths) => {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      logger.warn(`Failed to delete file ${filePath}:`, error);
    }
  }
};

// Validate file requirements
export const validateFileRequirements = (requirements = {}) => {
  return (req, res, next) => {
    if (!req.file && requirements.required) {
      return next(new ValidationError('File is required'));
    }
    
    if (req.file) {
      const { maxSize = 5 * 1024 * 1024, allowedTypes } = requirements;
      
      if (req.file.size > maxSize) {
        return next(new ValidationError(`File size exceeds ${maxSize / 1024 / 1024}MB limit`));
      }
      
      if (allowedTypes && !allowedTypes.includes(req.file.mimetype)) {
        return next(new ValidationError(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
      }
    }
    
    next();
  };
};

export default {
  uploadSingle,
  uploadMultiple,
  processImage,
  cleanupFiles,
  validateFileRequirements
};