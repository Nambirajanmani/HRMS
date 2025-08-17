import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError } from '../utils/errors';

const leavePolicySchema = z.object({
  name: z.string().min(1),
  leaveType: z.enum(['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'UNPAID']),
  daysAllowed: z.number(),
  isActive: z.boolean().optional(),
});

export const getLeavePolicies = async ({ userRole, page = 1, limit = 10, leaveType, isActive }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.leavePolicy.findMany({
    where: { leaveType, isActive: isActive !== undefined ? isActive : undefined },
    skip,
    take: limit,
  });
};

export const getLeavePolicyById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const policy = await prisma.leavePolicy.findUnique({ where: { id } });
  if (!policy) throw new NotFoundError('Leave policy not found');
  return policy;
};

export const createLeavePolicy = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = leavePolicySchema.parse(data);
  return prisma.leavePolicy.create({ data: { ...validatedData, isActive: true } });
};

export const updateLeavePolicy = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = leavePolicySchema.partial().parse(data);
  const policy = await prisma.leavePolicy.findUnique({ where: { id } });
  if (!policy) throw new NotFoundError('Leave policy not found');
  return prisma.leavePolicy.update({ where: { id }, data: validatedData });
};

export const deleteLeavePolicy = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const policy = await prisma.leavePolicy.findUnique({ where: { id } });
  if (!policy) throw new NotFoundError('Leave policy not found');
  return prisma.leavePolicy.update({ where: { id }, data: { isActive: false } });
};