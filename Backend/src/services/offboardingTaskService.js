import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const offboardingTaskSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().min(1),
  isCompleted: z.boolean(),
});

export const getOffboardingTasks = async ({ userRole, page = 1, limit = 10, employeeId, isCompleted }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.offboardingTask.findMany({
    where: { employeeId, isCompleted },
    skip,
    take: limit,
    include: { employee: true },
  });
};

export const getOffboardingTaskById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const task = await prisma.offboardingTask.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!task) throw new NotFoundError('Offboarding task not found');
  return task;
};

export const createOffboardingTask = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = offboardingTaskSchema.parse(data);
  const employee = await prisma.employee.findUnique({ where: { id: validatedData.employeeId } });
  if (!employee) throw new ValidationError('Invalid employeeId');
  return prisma.offboardingTask.create({ data: validatedData });
};

export const updateOffboardingTask = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = offboardingTaskSchema.partial().parse(data);
  const task = await prisma.offboardingTask.findUnique({ where: { id } });
  if (!task) throw new NotFoundError('Offboarding task not found');
  return prisma.offboardingTask.update({ where: { id }, data: validatedData });
};

export const deleteOffboardingTask = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const task = await prisma.offboardingTask.findUnique({ where: { id } });
  if (!task) throw new NotFoundError('Offboarding task not found');
  return prisma.offboardingTask.delete({ where: { id } });
};