import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const onboardingTaskSchema = z.object({
  templateId: z.string().uuid().optional(),
  employeeId: z.string().uuid(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']),
});

export const getOnboardingTasks = async ({ userRole, userId, page = 1, limit = 10, employeeId, status }) => {
  if (!['ADMIN', 'HR', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  const where = { employeeId, status };
  if (userRole === 'EMPLOYEE') where.employeeId = userId;
  return prisma.onboardingTask.findMany({
    where,
    skip,
    take: limit,
    include: { employee: true, template: true },
  });
};

export const getOnboardingTaskById = async ({ id, userRole, userId }) => {
  if (!['ADMIN', 'HR', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const task = await prisma.onboardingTask.findUnique({
    where: { id },
    include: { employee: true, template: true },
  });
  if (!task) throw new NotFoundError('Onboarding task not found');
  if (userRole === 'EMPLOYEE' && task.employeeId !== userId) throw new UnauthorizedError('Unauthorized');
  return task;
};

export const createOnboardingTask = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = onboardingTaskSchema.parse(data);
  const employee = await prisma.employee.findUnique({ where: { id: validatedData.employeeId } });
  if (!employee) throw new ValidationError('Invalid employeeId');
  if (validatedData.templateId) {
    const template = await prisma.onboardingTemplate.findUnique({ where: { id: validatedData.templateId } });
    if (!template) throw new ValidationError('Invalid templateId');
  }
  return prisma.onboardingTask.create({ data: validatedData });
};

export const updateOnboardingTask = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = onboardingTaskSchema.partial().parse(data);
  const task = await prisma.onboardingTask.findUnique({ where: { id } });
  if (!task) throw new NotFoundError('Onboarding task not found');
  return prisma.onboardingTask.update({ where: { id }, data: validatedData });
};

export const deleteOnboardingTask = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const task = await prisma.onboardingTask.findUnique({ where: { id } });
  if (!task) throw new NotFoundError('Onboarding task not found');
  return prisma.onboardingTask.delete({ where: { id } });
};