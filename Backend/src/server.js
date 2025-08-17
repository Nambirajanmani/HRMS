import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import dotenv from 'dotenv';
import prisma from './config/prisma.js'; // ✅ centralized Prisma
import logger, { requestLogger } from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { auditMiddleware } from './middleware/auditMiddleware.js';
import { debugRoutes, logRegisteredRoutes } from './middleware/debugRoutes.js';
import schedulerService from './utils/scheduler.js';

// Import route files
import authRoutes from './routes/authRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import attendanceRoutes from './routes/attendanceRoutes.js';
import leaveRoutes from './routes/leaveRequestRoutes.js';
import userRoutes from './routes/userRoutes.js';
import positionRoutes from './routes/positionRoutes.js';
import payrollRoutes from './routes/payrollRecordRoutes.js';
import documentRoutes from './routes/documentRoutes.js';
import auditLogRoutes from './routes/auditLogRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import leavePolicyRoutes from './routes/leavePolicyRoutes.js';
import leaveBalanceRoutes from './routes/leaveBalanceRoutes.js';
import jobPostingRoutes from './routes/jobPostingRoutes.js';
import jobApplicationRoutes from './routes/jobApplicationRoutes.js';
import interviewRoutes from './routes/interviewRoutes.js';
import performanceReviewRoutes from './routes/performanceReviewRoutes.js';
import onboardingTemplateRoutes from './routes/onboardingTemplateRoutes.js';
import onboardingTaskRoutes from './routes/onboardingTaskRoutes.js';
import offboardingTaskRoutes from './routes/offboardingTaskRoutes.js';
import trainingProgramRoutes from './routes/trainingProgramRoutes.js';
import trainingRecordRoutes from './routes/trainingRecordRoutes.js';
import disciplinaryActionRoutes from './routes/disciplinaryActionRoutes.js';
import settingRoutes from './routes/settingRoutes.js';

// Load environment variables
dotenv.config();

// Helper to fetch environment variables
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

const app = express();

// Log Prisma queries in development
if (getEnvVariable('NODE_ENV', 'development') !== 'production') {
  prisma.$on('query', (e) => {
    logger.debug(`Prisma Query: ${e.query} ${e.params} [${e.duration}ms]`);
  });
}

// === CORS Configuration ===
const ALLOWED_FRONTEND = getEnvVariable('FRONTEND_URL', 'http://localhost:5173');
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [ALLOWED_FRONTEND];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400,
};

// === Security Middleware ===
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
  })
);
app.use(cors(corsOptions));

// === Rate Limiting and Throttling ===
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(getEnvVariable('RATE_LIMIT_MAX', '100')),
  message: { status: 'error', message: 'Too many requests. Please try again later.' },
});
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: parseInt(getEnvVariable('SPEED_LIMIT_AFTER', '50')),
  delayMs: () => parseInt(getEnvVariable('SPEED_LIMIT_DELAY', '500')),
});

// Apply rate limiting
[
  '/api/auth',
  '/api/employees',
  '/api/departments',
  '/api/attendance',
  '/api/leave',
  '/api/users',
  '/api/reports'
].forEach((route) => app.use(route, limiter, speedLimiter));

// === Body Parsing and Logging ===
app.use(express.json({ limit: getEnvVariable('BODY_LIMIT', '10mb') }));
app.use(express.urlencoded({ extended: true, limit: getEnvVariable('BODY_LIMIT', '10mb') }));
app.use(requestLogger);
app.use(auditMiddleware);
app.use(debugRoutes);

// === API Routes ===
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/users', userRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/leave-policies', leavePolicyRoutes);
app.use('/api/leave-balances', leaveBalanceRoutes);
app.use('/api/job-postings', jobPostingRoutes);
app.use('/api/job-applications', jobApplicationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/performance-reviews', performanceReviewRoutes);
app.use('/api/onboarding-templates', onboardingTemplateRoutes);
app.use('/api/onboarding-tasks', onboardingTaskRoutes);
app.use('/api/offboarding-tasks', offboardingTaskRoutes);
app.use('/api/training-programs', trainingProgramRoutes);
app.use('/api/training-records', trainingRecordRoutes);
app.use('/api/disciplinary-actions', disciplinaryActionRoutes);
app.use('/api/settings', settingRoutes);

// === Health Check ===
app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'OK',
      database: 'Connected',
      timestamp: new Date().toISOString(),
      environment: getEnvVariable('NODE_ENV', 'development'),
    });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'Service Unavailable',
      database: 'Disconnected',
      error: error.message,
    });
  }
});

// === 404 Handler ===
app.use('/api/*', (req, res) => {
  logger.error('Route not found', { path: req.originalUrl });
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// === Global Error Handler ===
app.use(errorHandler);

// === Graceful Shutdown ===
const shutdown = async () => {
  logger.info('Stopping scheduled jobs...');
  schedulerService.stopAllJobs();

  logger.info('Shutting down server...');
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting database', { error: error.message });
  }

  if (server) {
    server.close(() => {
      logger.info('Server stopped');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  shutdown();
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: reason instanceof Error ? reason.message : reason });
  shutdown();
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Initialize scheduler AFTER defining shutdown
schedulerService.initialize();

// Start server
const PORT = parseInt(getEnvVariable('PORT', '3000'));
const server = app.listen(PORT, () => {
  logger.info(`🚀 Backend running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`Frontend URL allowed: ${ALLOWED_FRONTEND}`);
  logRegisteredRoutes(app);
});

export { app, server };
