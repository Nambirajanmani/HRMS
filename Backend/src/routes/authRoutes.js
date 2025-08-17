import express from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { validate, authSchemas } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { generateTokens, verifyRefreshToken, generatePasswordResetToken } from '../utils/authUtils.js';
import { AppError, AuthenticationError, ValidationError } from '../utils/errors.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import logger from '../utils/logger.js';

const router = express.Router();
const prisma = new PrismaClient({ errorFormat: 'pretty' });

const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

/** ========================= REGISTER ========================= */
router.post('/register', validate(authSchemas.register), async (req, res, next) => {
  try {
    if (!req.validatedData?.body) {
      throw new ValidationError('Validation data missing', null, 'VALIDATION_FAILED');
    }

    const { email, password, role = 'EMPLOYEE' } = req.validatedData.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ValidationError('User already exists with this email', null, 'USER_EXISTS');
    }

    // Hash password
    const saltRounds = parseInt(getEnvVariable('BCRYPT_ROUNDS', '12'));
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, role: role.toUpperCase() },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true }
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({ userId: user.id, role: user.role });

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + parseInt(getEnvVariable('REFRESH_TOKEN_EXPIRES_MS', '604800000')))
      }
    });

    // Log audit
    await createAuditLog(user.id, 'CREATE', 'users', user.id, null, user, req);

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: { user, accessToken, refreshToken }
    });
  } catch (error) {
    next(error);
  }
});

/** ========================= LOGIN ========================= */
router.post('/login', validate(authSchemas.login), async (req, res, next) => {
  try {
    if (!req.validatedData?.body) {
      throw new ValidationError('Validation data missing', null, 'VALIDATION_FAILED');
    }

    const { email, password } = req.validatedData.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { employee: { include: { department: true, position: true } } }
    });

    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid credentials', null, 'INVALID_CREDENTIALS');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AuthenticationError('Invalid credentials', null, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens({ userId: user.id, role: user.role });

    // Remove old tokens
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    // Store new refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + parseInt(getEnvVariable('REFRESH_TOKEN_EXPIRES_MS', '604800000')))
      }
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Remove password
    delete user.password;

    logger.info('User logged in successfully', { 
      userId: user.id, 
      role: user.role, 
      email: user.email 
    });

    res.json({
      status: 'success',
      message: 'Login successful',
      data: { user, accessToken, refreshToken }
    });
  } catch (error) {
    logger.error('Login error', { 
      error: error.message, 
      email: req.validatedData?.body?.email 
    });
    next(error);
  }
});

/** ========================= ME ========================= */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        employee: {
          include: {
            department: true,
            position: true,
            manager: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        }
      }
    });

    if (!user) {
      throw new AuthenticationError('User not found', null, 'USER_NOT_FOUND');
    }

    delete user.password;

    res.json({
      status: 'success',
      message: 'User profile retrieved successfully',
      data: { user }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
