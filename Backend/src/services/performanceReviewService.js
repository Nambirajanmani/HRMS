import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { NotFoundError, AuthenticationError, AuthorizationError, ValidationError } from '../utils/errors.js';

const prisma = new PrismaClient();

const performanceReviewSchema = z.object({
  employeeId: z.string().uuid(),
  reviewerId: z.string().uuid(),
  overallRating: z.enum(['OUTSTANDING', 'EXCEEDS_EXPECTATIONS', 'MEETS_EXPECTATIONS', 'NEEDS_IMPROVEMENT']).optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'COMPLETED']).optional(),
});

export const getPerformanceReviews = async ({ userRole, userId, page = 1, limit = 10, employeeId, status }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) throw new AuthorizationError('Unauthorized');
  const skip = (page - 1) * limit;
  const where = { employeeId, status };
  if (userRole === 'EMPLOYEE') where.employeeId = userId;
  return prisma.performanceReview.findMany({
    where,
    skip,
    take: limit,
    include: { employee: true, reviewer: true },
  });
};

export const getPerformanceReviewById = async ({ id, userRole, userId }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) throw new AuthorizationError('Unauthorized');
  const review = await prisma.performanceReview.findUnique({
    where: { id },
    include: { employee: true, reviewer: true },
  });
  if (!review) throw new NotFoundError('Performance review not found');
  if (userRole === 'EMPLOYEE' && review.employeeId !== userId) throw new AuthorizationError('Unauthorized');
  return review;
};

export const createPerformanceReview = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) throw new AuthorizationError('Unauthorized');
  const validatedData = performanceReviewSchema.parse(data);
  const employee = await prisma.employee.findUnique({ where: { id: validatedData.employeeId } });
  if (!employee) throw new ValidationError('Invalid employeeId');
  const reviewer = await prisma.employee.findUnique({ where: { id: validatedData.reviewerId } });
  if (!reviewer) throw new ValidationError('Invalid reviewerId');
  return prisma.performanceReview.create({ data: validatedData });
};

export const updatePerformanceReview = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) throw new AuthorizationError('Unauthorized');
  const validatedData = performanceReviewSchema.partial().parse(data);
  const review = await prisma.performanceReview.findUnique({ where: { id } });
  if (!review) throw new NotFoundError('Performance review not found');
  return prisma.performanceReview.update({ where: { id }, data: validatedData });
};

export const deletePerformanceReview = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new AuthorizationError('Unauthorized');
  const review = await prisma.performanceReview.findUnique({ where: { id } });
  if (!review) throw new NotFoundError('Performance review not found');
  return prisma.performanceReview.delete({ where: { id } });
};

// Export all functions as a service object for CommonJS compatibility
const performanceReviewService = {
  getPerformanceReviews,
  getPerformanceReviewById,
  createPerformanceReview,
  updatePerformanceReview,
  deletePerformanceReview,
};

export default performanceReviewService;