// config/prisma.js
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger.js';

// Create a single Prisma instance
const prisma = new PrismaClient({
  errorFormat: 'pretty',
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
  ],
});

// Log Prisma queries only in development
if (process.env.NODE_ENV !== 'production') {
  prisma.$on('query', (e) => {
    logger.debug(`Prisma Query: ${e.query} ${e.params} [${e.duration}ms]`);
  });
}

export default prisma;
