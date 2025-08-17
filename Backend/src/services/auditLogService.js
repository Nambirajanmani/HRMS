import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError } from '../utils/errors';

const auditLogSchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'VIEW']).optional(),
  resource: z.string().min(1).optional(),
});

export const getAuditLogs = async ({ userRole, page = 1, limit = 10, userId, action, resource }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.auditLog.findMany({
    where: { userId, action, resource },
    skip,
    take: limit,
    include: { user: true },
  });
};

export const getAuditLogById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const log = await prisma.auditLog.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!log) throw new NotFoundError('Audit log not found');
  return log;
};