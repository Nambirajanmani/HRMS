import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const interviewSchema = z.object({
  applicationId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']),
});

export const getInterviews = async ({ userRole, page = 1, limit = 10, applicationId, status }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.interview.findMany({
    where: { applicationId, status },
    skip,
    take: limit,
    include: { application: { include: { jobPosting: true } } },
  });
};

export const getInterviewById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: { application: { include: { jobPosting: true } } },
  });
  if (!interview) throw new NotFoundError('Interview not found');
  return interview;
};

export const createInterview = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = interviewSchema.parse(data);
  const application = await prisma.jobApplication.findUnique({ where: { id: validatedData.applicationId } });
  if (!application) throw new ValidationError('Invalid applicationId');
  return prisma.interview.create({ data: validatedData });
};

export const updateInterview = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = interviewSchema.partial().parse(data);
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) throw new NotFoundError('Interview not found');
  return prisma.interview.update({ where: { id }, data: validatedData });
};

export const deleteInterview = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const interview = await prisma.interview.findUnique({ where: { id } });
  if (!interview) throw new NotFoundError('Interview not found');
  return prisma.interview.delete({ where: { id } });
};