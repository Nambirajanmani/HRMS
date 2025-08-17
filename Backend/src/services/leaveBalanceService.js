import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const leaveBalanceSchema = z.object({
  employeeId: z.string().uuid(),
  policyId: z.string().uuid(),
  year: z.number(),
  daysUsed: z.number().optional(),
  daysRemaining: z.number().optional(),
});

export const getLeaveBalances = async ({ userRole, userId, page = 1, limit = 10, employeeId, year }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  const where = { employeeId, year };
  if (userRole === 'EMPLOYEE') where.employeeId = userId;
  return prisma.leaveBalance.findMany({
    where,
    skip,
    take: limit,
    include: { employee: true, policy: true },
  });
};

export const getLeaveBalanceById = async ({ id, userRole, userId }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const balance = await prisma.leaveBalance.findUnique({
    where: { id },
    include: { employee: true, policy: true },
  });
  if (!balance) throw new NotFoundError('Leave balance not found');
  if (userRole === 'EMPLOYEE' && balance.employeeId !== userId) throw new UnauthorizedError('Unauthorized');
  return balance;
};

export const createLeaveBalance = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = leaveBalanceSchema.parse(data);
  const employee = await prisma.employee.findUnique({ where: { id: validatedData.employeeId } });
  if (!employee) throw new ValidationError('Invalid employeeId');
  const policy = await prisma.leavePolicy.findUnique({ where: { id: validatedData.policyId } });
  if (!policy) throw new ValidationError('Invalid policyId');
  return prisma.leaveBalance.create({ data: validatedData });
};

export const updateLeaveBalance = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = leaveBalanceSchema.partial().parse(data);
  const balance = await prisma.leaveBalance.findUnique({ where: { id } });
  if (!balance) throw new NotFoundError('Leave balance not found');
  return prisma.leaveBalance.update({ where: { id }, data: validatedData });
};

export const deleteLeaveBalance = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const balance = await prisma.leaveBalance.findUnique({ where: { id } });
  if (!balance) throw new NotFoundError('Leave balance not found');
  return prisma.leaveBalance.delete({ where: { id } });
};