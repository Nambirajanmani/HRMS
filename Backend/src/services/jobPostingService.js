import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const jobPostingSchema = z.object({
  title: z.string().min(1),
  departmentId: z.string().uuid(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP']),
  status: z.enum(['OPEN', 'CLOSED', 'DRAFT']),
});

export const getJobPostings = async ({ userRole, page = 1, limit = 10, status, departmentId }) => {
  const skip = (page - 1) * limit;
  const where = { status, departmentId };
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) where.status = 'OPEN';
  return prisma.jobPosting.findMany({
    where,
    skip,
    take: limit,
    include: { department: true },
  });
};

export const getJobPostingById = async ({ id, userRole }) => {
  const posting = await prisma.jobPosting.findUnique({
    where: { id },
    include: { department: true },
  });
  if (!posting) throw new NotFoundError('Job posting not found');
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole) && posting.status !== 'OPEN') {
    throw new UnauthorizedError('Unauthorized');
  }
  return posting;
};

export const createJobPosting = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = jobPostingSchema.parse(data);
  const department = await prisma.department.findUnique({ where: { id: validatedData.departmentId } });
  if (!department) throw new ValidationError('Invalid departmentId');
  return prisma.jobPosting.create({ data: validatedData });
};

export const updateJobPosting = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = jobPostingSchema.partial().parse(data);
  const posting = await prisma.jobPosting.findUnique({ where: { id } });
  if (!posting) throw new NotFoundError('Job posting not found');
  return prisma.jobPosting.update({ where: { id }, data: validatedData });
};

export const deleteJobPosting = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const posting = await prisma.jobPosting.findUnique({ where: { id } });
  if (!posting) throw new NotFoundError('Job posting not found');
  return prisma.jobPosting.delete({ where: { id } });
};