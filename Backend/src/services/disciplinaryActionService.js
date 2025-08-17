import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const disciplinaryActionSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.string().min(1),
  reason: z.string().min(1),
});

export const getDisciplinaryActions = async ({ userRole, page = 1, limit = 10, employeeId, type }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.disciplinaryAction.findMany({
    where: { employeeId, type },
    skip,
    take: limit,
    include: { employee: true },
  });
};

export const getDisciplinaryActionById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const action = await prisma.disciplinaryAction.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!action) throw new NotFoundError('Disciplinary action not found');
  return action;
};

export const createDisciplinaryAction = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = disciplinaryActionSchema.parse(data);
  const employee = await prisma.employee.findUnique({ where: { id: validatedData.employeeId } });
  if (!employee) throw new ValidationError('Invalid employeeId');
  return prisma.disciplinaryAction.create({ data: validatedData });
};

export const updateDisciplinaryAction = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = disciplinaryActionSchema.partial().parse(data);
  const action = await prisma.disciplinaryAction.findUnique({ where: { id } });
  if (!action) throw new NotFoundError('Disciplinary action not found');
  return prisma.disciplinaryAction.update({ where: { id }, data: validatedData });
};

export const deleteDisciplinaryAction = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const action = await prisma.disciplinaryAction.findUnique({ where: { id } });
  if (!action) throw new NotFoundError('Disciplinary action not found');
  return prisma.disciplinaryAction.delete({ where: { id } });
};