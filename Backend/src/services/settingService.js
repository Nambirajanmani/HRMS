import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError } from '../utils/errors';

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  category: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export const getSettings = async ({ userRole, page = 1, limit = 10, category, isPublic }) => {
  if (!['ADMIN'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.setting.findMany({
    where: { category, isPublic },
    skip,
    take: limit,
  });
};

export const getSettingById = async ({ id, userRole }) => {
  if (!['ADMIN'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const setting = await prisma.setting.findUnique({ where: { id } });
  if (!setting) throw new NotFoundError('Setting not found');
  return setting;
};

export const createSetting = async ({ data, userRole }) => {
  if (!['ADMIN'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = settingSchema.parse(data);
  return prisma.setting.create({ data: validatedData });
};

export const updateSetting = async ({ id, data, userRole }) => {
  if (!['ADMIN'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = settingSchema.partial().parse(data);
  const setting = await prisma.setting.findUnique({ where: { id } });
  if (!setting) throw new NotFoundError('Setting not found');
  return prisma.setting.update({ where: { id }, data: validatedData });
};

export const deleteSetting = async ({ id, userRole }) => {
  if (!['ADMIN'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const setting = await prisma.setting.findUnique({ where: { id } });
  if (!setting) throw new NotFoundError('Setting not found');
  return prisma.setting.delete({ where: { id } });
};