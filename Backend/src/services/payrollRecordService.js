import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const payrollRecordSchema = z.object({
  employeeId: z.string().uuid(),
  payPeriodStart: z.string().datetime(),
  baseSalary: z.number(),
  status: z.enum(['DRAFT', 'PROCESSED', 'PAID', 'CANCELLED']),
});

export const getPayrollRecords = async ({ userRole, userId, page = 1, limit = 10, employeeId, status }) => {
  if (!['ADMIN', 'HR', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  const where = { employeeId, status };
  if (userRole === 'EMPLOYEE') where.employeeId = userId;
  return prisma.payrollRecord.findMany({
    where,
    skip,
    take: limit,
    include: { employee: true },
  });
};

export const getPayrollRecordById = async ({ id, userRole, userId }) => {
  if (!['ADMIN', 'HR', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const record = await prisma.payrollRecord.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!record) throw new NotFoundError('Payroll record not found');
  if (userRole === 'EMPLOYEE' && record.employeeId !== userId) throw new UnauthorizedError('Unauthorized');
  return record;
};

export const createPayrollRecord = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = payrollRecordSchema.parse(data);
  const employee = await prisma.employee.findUnique({ where: { id: validatedData.employeeId } });
  if (!employee) throw new ValidationError('Invalid employeeId');
  return prisma.payrollRecord.create({ data: validatedData });
};

export const updatePayrollRecord = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = payrollRecordSchema.partial().parse(data);
  const record = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('Payroll record not found');
  return prisma.payrollRecord.update({ where: { id }, data: validatedData });
};

export const deletePayrollRecord = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const record = await prisma.payrollRecord.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('Payroll record not found');
  return prisma.payrollRecord.delete({ where: { id } });
};