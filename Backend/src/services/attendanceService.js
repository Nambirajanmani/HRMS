import { z } from 'zod';
import prisma from '../prisma/client';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors';

const attendanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().datetime(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME']),
});

export const getAttendanceRecords = async ({ userRole, page = 1, limit = 10, employeeId, date, status }) => {
  if (!['ADMIN', 'HR', 'MANAGER'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const skip = (page - 1) * limit;
  return prisma.attendance.findMany({
    where: { employeeId, date: date ? new Date(date) : undefined, status },
    skip,
    take: limit,
    include: { employee: true },
  });
};

export const getAttendanceById = async ({ id, userRole, userId }) => {
  if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const attendance = await prisma.attendance.findUnique({
    where: { id },
    include: { employee: true },
  });
  if (!attendance) throw new NotFoundError('Attendance record not found');
  if (userRole === 'EMPLOYEE' && attendance.employeeId !== userId) throw new UnauthorizedError('Unauthorized');
  return attendance;
};

export const createAttendance = async ({ data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = attendanceSchema.parse(data);
  const employee = await prisma.employee.findUnique({ where: { id: validatedData.employeeId } });
  if (!employee) throw new ValidationError('Invalid employeeId');
  return prisma.attendance.create({ data: validatedData });
};

export const updateAttendance = async ({ id, data, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const validatedData = attendanceSchema.partial().parse(data);
  const attendance = await prisma.attendance.findUnique({ where: { id } });
  if (!attendance) throw new NotFoundError('Attendance record not found');
  return prisma.attendance.update({ where: { id }, data: validatedData });
};

export const deleteAttendance = async ({ id, userRole }) => {
  if (!['ADMIN', 'HR'].includes(userRole)) throw new UnauthorizedError('Unauthorized');
  const attendance = await prisma.attendance.findUnique({ where: { id } });
  if (!attendance) throw new NotFoundError('Attendance record not found');
  return prisma.attendance.delete({ where: { id } });
};