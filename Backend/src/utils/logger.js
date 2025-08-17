import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs');

// Ensure logs directory exists
const ensureLogsDirectory = async () => {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create logs directory:', error.message);
  }
};

// Validate environment variables
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    console.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Custom format to include request metadata
const requestMetaFormat = winston.format((info, opts) => {
  if (opts.requestContext) {
    info.requestId = opts.requestContext.requestId;
    info.userId = opts.requestContext.userId;
  }
  return info;
});

const logger = winston.createLogger({
  level: getEnvVariable('LOG_LEVEL', 'info'),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    requestMetaFormat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'hrms-backend' },
  transports: [
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, 'error-%DATE%.log'),
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      zippedArchive: true,
    }),
  ],
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, 'exceptions-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      zippedArchive: true,
    }),
  ],
});

// Add console transport for non-production environments
if (getEnvVariable('NODE_ENV', 'development') !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(
          ({ level, message, timestamp, service, requestId, userId }) =>
            `${timestamp} [${service}] ${level}: ${message} ${
              requestId ? `(RequestID: ${requestId}, UserID: ${userId || 'N/A'})` : ''
            }`
        )
      ),
    })
  );
}

// Initialize logs directory
ensureLogsDirectory();

// Export a middleware to add request context
export const requestLogger = (req, res, next) => {
  const requestId = crypto.randomUUID();
  req.logger = logger.child({
    requestContext: { requestId, userId: req.user?.id || null },
  });
  req.logger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
};

export default logger;