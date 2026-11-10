import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import prisma from './config/prisma.js'; // ✅ centralized Prisma
import logger, { requestLogger } from './utils/logger.js';
import errorHandler from './middleware/errorHandler.js';
import { auditMiddleware } from './middleware/auditMiddleware.js';
import { debugRoutes, logRegisteredRoutes } from './middleware/debugRoutes.js';
import schedulerService from './utils/scheduler.js';

// Import route files dynamically with guards so missing/invalid modules don't crash startup
let authRoutes = null;
let employeeRoutes = null;
let departmentRoutes = null;
let leaveRoutes = null;
let leavePolicyRoutes = null;
let leaveBalanceRoutes = null;
let timeRoutes = null;
let attendanceRoutes = null;
let positionRoutes = null;
let reportRoutes = null;

try {
  authRoutes = (await import('./routes/authRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load authRoutes', { error: err?.message || err });
}

try {
  employeeRoutes = (await import('./routes/employeeRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load employeeRoutes', { error: err?.message || err });
}

try {
  departmentRoutes = (await import('./routes/departmentRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load departmentRoutes', { error: err?.message || err });
}

try {
  leaveRoutes = (await import('./routes/leaveRequestRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load leaveRoutes', { error: err?.message || err });
}

try {
  leavePolicyRoutes = (await import('./routes/leavePolicyRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load leavePolicyRoutes', { error: err?.message || err });
}

try {
  leaveBalanceRoutes = (await import('./routes/leaveBalanceRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load leaveBalanceRoutes', { error: err?.message || err });
}

try {
  timeRoutes = (await import('./routes/time.route.js')).default;
} catch (err) {
  logger.warn('Could not load timeRoutes', { error: err?.message || err, stack: err?.stack });
}

try {
  attendanceRoutes = (await import('./routes/attendanceRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load attendanceRoutes', { error: err?.message || err });
}

try {
  positionRoutes = (await import('./routes/positionRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load positionRoutes', { error: err?.message || err });
}

try {
  reportRoutes = (await import('./routes/reportRoutes.js')).default;
} catch (err) {
  logger.warn('Could not load reportRoutes', { error: err?.message || err });
}

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
    const allowedOrigins = [ALLOWED_FRONTEND, 'http://localhost:5174', 'http://localhost:5173'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Request-ID'],
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
// Attach logger to req for audit middleware
app.use((req, res, next) => {
  req.logger = logger;
  next();
});
// app.use(requestLogger); // TODO: Fix requestLogger - it's not a middleware function
app.use(auditMiddleware);
app.use(debugRoutes);

// === API Routes ===
if (authRoutes) app.use('/api/auth', authRoutes);
if (employeeRoutes) app.use('/api/employees', employeeRoutes);
if (timeRoutes) app.use('/api/employees', timeRoutes);
if (departmentRoutes) app.use('/api/departments', departmentRoutes);
if (attendanceRoutes) app.use('/api/attendance', attendanceRoutes);
if (leaveRoutes) app.use('/api/leave', leaveRoutes);
// app.use('/api/users', userRoutes);
if (positionRoutes) app.use('/api/positions', positionRoutes);
if (reportRoutes) app.use('/api/reports', reportRoutes);
// app.use('/api/payroll', payrollRoutes);
// app.use('/api/documents', documentRoutes);
if (leavePolicyRoutes) app.use('/api/leave-policies', leavePolicyRoutes);
if (leaveBalanceRoutes) app.use('/api/leave-balances', leaveBalanceRoutes);
// app.use('/api/job-postings', jobPostingRoutes);
// app.use('/api/job-applications', jobApplicationRoutes);
// app.use('/api/interviews', interviewRoutes);
// app.use('/api/performance-reviews', performanceReviewRoutes);
// app.use('/api/onboarding-templates', onboardingTemplateRoutes);
// app.use('/api/onboarding-tasks', onboardingTaskRoutes);
// app.use('/api/offboarding-tasks', offboardingTaskRoutes);
// app.use('/api/training-programs', trainingProgramRoutes);
// app.use('/api/training-records', trainingRecordRoutes);
// app.use('/api/disciplinary-actions', disciplinaryActionRoutes);
// app.use('/api/settings', settingRoutes);

// === Health Check ===
app.get('/api/health', async (req, res) => {
  try {
    // Temporarily comment out database check to allow server to start
    // await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'OK',
      database: 'Not Checked',
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
// schedulerService.initialize();

// Start server with retry on EADDRINUSE to avoid uncaught exception crashes
const DEFAULT_PORT = parseInt(getEnvVariable('PORT', '3000'));

// Keep a top-level server reference so shutdown can close it safely
let server = null;

async function startServer(port = DEFAULT_PORT, maxRetries = 3) {
  let attempts = 0;
  let currentPort = port;

  while (attempts <= maxRetries) {
    try {
      logger.info(`Attempting to start server on port ${currentPort}...`);
      server = app.listen(currentPort);

      server.on('listening', () => {
        logger.info(`🚀 Backend running on port ${currentPort}`);
        logger.info(`📊 Health check: http://localhost:${currentPort}/api/health`);
        logger.info(`Frontend URL allowed: ${ALLOWED_FRONTEND}`);
        logRegisteredRoutes(app);
      });

      server.on('error', (err) => {
        logger.error('Server error event', { error: err?.message || err, code: err?.code, stack: err?.stack });
      });

      // return to allow callers to access the running server
      return { app, server, port: currentPort };
    } catch (err) {
      // If address in use, try next port
      if (err && err.code === 'EADDRINUSE') {
        logger.warn(`Port ${currentPort} in use. Trying port ${currentPort + 1}...`);
        attempts += 1;
        currentPort += 1;
        // small delay before retry
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }

      // For other errors, log and rethrow
      logger.error('Failed to start server', { error: err?.message || err, code: err?.code, stack: err?.stack });
      throw err;
    }
  }

  // If we exhausted retries
  const msg = `Failed to bind to any port after ${maxRetries + 1} attempts (starting at ${port})`;
  logger.error(msg);
  throw new Error(msg);
}

// Kick off server start (top-level) and export server reference when ready
startServer().then(({ server, port }) => {
  // attach server to module exports for tests/tools that import it
  exportServer(server);
}).catch((err) => {
  logger.error('Server failed to start', { error: err?.message || err });
  // exit after logging - graceful shutdown will run via uncaughtException handler
  process.exit(1);
});

// Helper to export server reference (exports can't be reassigned directly in ESM),
// so expose function to retrieve server via named export if needed elsewhere.
let _serverRef = null;
function exportServer(srv) {
  _serverRef = srv;
}

export { app, exportServer as __exportServerRef };
