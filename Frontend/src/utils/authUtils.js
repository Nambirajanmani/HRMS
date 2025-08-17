import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { ValidationError, AuthenticationError } from './errors.js';
import logger from './logger.js';

// Payload validation schema for JWT generation
const payloadSchema = {
  generate: {
    userId: (value) => typeof value === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value),
    role: (value) => ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(value),
  },
};

// Validate JWT payload
const validatePayload = (payload, schema) => {
  const errors = Object.entries(schema).reduce((acc, [key, validator]) => {
    if (!(key in payload) || !validator(payload[key])) {
      acc.push(`Invalid ${key}`);
    }
    return acc;
  }, []);

  if (errors.length > 0) {
    throw new ValidationError('Invalid token payload', errors, 'INVALID_PAYLOAD');
  }
};

// Get environment variable with logging
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Generate access and refresh tokens
export const generateTokens = (payload) => {
  validatePayload(payload, payloadSchema.generate);

  const accessToken = jwt.sign(
    payload,
    getEnvVariable('JWT_ACCESS_SECRET', 'default_access_secret'),
    {
      expiresIn: getEnvVariable('JWT_ACCESS_EXPIRES_IN', '15m'),
      issuer: 'hrms-backend',
      audience: 'hrms-client',
    }
  );

  const refreshToken = jwt.sign(
    payload,
    getEnvVariable('JWT_REFRESH_SECRET', 'default_refresh_secret'),
    {
      expiresIn: getEnvVariable('JWT_REFRESH_EXPIRES_IN', '7d'),
      issuer: 'hrms-backend',
      audience: 'hrms-client',
    }
  );

  return { accessToken, refreshToken };
};

// Verify access token
export const verifyAccessToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new AuthenticationError('Invalid access token', ['Token is missing or not a string'], 'INVALID_TOKEN');
  }
  try {
    return jwt.verify(token, getEnvVariable('JWT_ACCESS_SECRET', 'default_access_secret'), {
      issuer: 'hrms-backend',
      audience: 'hrms-client',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Access token expired', null, 'TOKEN_EXPIRED');
    }
    throw new AuthenticationError('Invalid access token', [error.message], 'INVALID_TOKEN');
  }
};

// Verify refresh token
export const verifyRefreshToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new AuthenticationError('Invalid refresh token', ['Token is missing or not a string'], 'INVALID_TOKEN');
  }
  try {
    return jwt.verify(token, getEnvVariable('JWT_REFRESH_SECRET', 'default_refresh_secret'), {
      issuer: 'hrms-backend',
      audience: 'hrms-client',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Refresh token expired', null, 'TOKEN_EXPIRED');
    }
    throw new AuthenticationError('Invalid refresh token', [error.message], 'INVALID_TOKEN');
  }
};

// Generate password reset token
export const generatePasswordResetToken = () => {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + parseInt(getEnvVariable('PASSWORD_RESET_TOKEN_EXPIRES_MS', '600000')); // 10 minutes
  return { token, expiresAt };
};