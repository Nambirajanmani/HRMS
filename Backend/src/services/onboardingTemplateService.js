import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const onboardingTemplateService = {
  async createOnboardingTemplate(data) {
    return prisma.onboarding_templates.create({ data });
  },

  async getOnboardingTemplate(id) {
    return prisma.onboarding_templates.findUnique({ where: { id } });
  },

  async updateOnboardingTemplate(id, data) {
    return prisma.onboarding_templates.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  },

  async deleteOnboardingTemplate(id) {
    return prisma.onboarding_templates.delete({ where: { id } });
  },
};

import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError } from '../utils/errors';

const onboardingTemplateSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const getOnboardingTemplates = async ({ userRole, page = 1, limit = 10, isActive }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.onboardingTemplate.findMany({
    where: { isActive: isActive !== undefined ? isActive : undefined },
    skip,
    take: limit,
  });
};

export const getOnboardingTemplateById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const template = await prisma.onboardingTemplate.findUnique({ where: { id } });
  if (!template) throw new NotFoundError('Onboarding template not found');
  return template;
};

export const createOnboardingTemplate = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = onboardingTemplateSchema.parse(data);
  return prisma.onboardingTemplate.create({ data: { ...validatedData, isActive: true } });
};

export const updateOnboardingTemplate = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = onboardingTemplateSchema.partial().parse(data);
  const template = await prisma.onboardingTemplate.findUnique({ where: { id } });
  if (!template) throw new NotFoundError('Onboarding template not found');
  return prisma.onboardingTemplate.update({ where: { id }, data: validatedData });
};

export const deleteOnboardingTemplate = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const template = await prisma.onboardingTemplate.findUnique({ where: { id } });
  if (!template) throw new NotFoundError('Onboarding template not found');
  return prisma.onboardingTemplate.update({ where: { id }, data: { isActive: false } });
};