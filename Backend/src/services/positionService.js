import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const positionSchema = z.object({
  title: z.string().min(1),
  departmentId: z.string().uuid(),
  requirements: z.array(z.string()),
  minSalary: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const getPositions = async ({ userRole, page = 1, limit = 10, departmentId, isActive }) => {
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.position.findMany({
    where: { departmentId, isActive: isActive !== undefined ? isActive : undefined },
    skip,
    take: limit,
    include: { department: true },
  });
};

export const getPositionById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const position = await prisma.position.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!position) throw new NotFoundError('Position not found');
  return position;
};

export const createPosition = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = positionSchema.parse(data);
  const department = await prisma.department.findUnique({ where: { id: validatedData.departmentId } });
  if (!department) throw new ValidationError('Invalid departmentId');
  return prisma.position.create({ data: { ...validatedData, isActive: true } });
};

export const updatePosition = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = positionSchema.partial().parse(data);
  const position = await prisma.position.findUnique({ where: { id } });
  if (!position) throw new NotFoundError('Position not found');
  return prisma.position.update({ where: { id }, data: validatedData });
};

export const deletePosition = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const position = await prisma.position.findUnique({ where: { id } });
  if (!position) throw new NotFoundError('Position not found');
  return prisma.position.update({ where: { id }, data: { isActive: false } });
};