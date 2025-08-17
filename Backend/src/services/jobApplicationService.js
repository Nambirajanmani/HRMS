import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const jobApplicationSchema = z.object({
  jobPostingId: z.string().uuid(),
  firstName: z.string().min(1),
  email: z.string().email(),
  status: z.enum(['APPLIED', 'UNDER_REVIEW', 'INTERVIEW', 'OFFERED', 'REJECTED']),
});

export const getJobApplications = async ({ userRole, page = 1, limit = 10, jobPostingId, status }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.jobApplication.findMany({
    where: { jobPostingId, status },
    skip,
    take: limit,
    include: { jobPosting: true },
  });
};

export const getJobApplicationById = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const application = await prisma.jobApplication.findUnique({
    where: { id },
    include: { jobPosting: true },
  });
  if (!application) throw new NotFoundError('Job application not found');
  return application;
};

export const createJobApplication = async ({ data }) => {
  const validatedData = jobApplicationSchema.parse(data);
  const posting = await prisma.jobPosting.findUnique({ where: { id: validatedData.jobPostingId } });
  if (!posting) throw new ValidationError('Invalid jobPostingId');
  return prisma.jobApplication.create({ data: { ...validatedData, status: 'APPLIED' } });
};

export const updateJobApplication = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = jobApplicationSchema.partial().parse(data);
  const application = await prisma.jobApplication.findUnique({ where: { id } });
  if (!application) throw new NotFoundError('Job application not found');
  return prisma.jobApplication.update({ where: { id }, data: validatedData });
};

export const deleteJobApplication = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const application = await prisma.jobApplication.findUnique({ where: { id } });
  if (!application) throw new NotFoundError('Job application not found');
  return prisma.jobApplication.delete({ where: { id } });
};