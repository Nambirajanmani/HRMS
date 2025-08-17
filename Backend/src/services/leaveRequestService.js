
import { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError } from '../utils/errors.js';

const prisma = new PrismaClient();

const leaveRequestService = {
  async getAllLeaveRequests({ page, limit, status, employeeId, user }) {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const where = {
      AND: [
        status ? { status } : {},
        employeeId ? { employeeId } : {},
        user.role === 'MANAGER' ? { 
          employee: { managerId: user.employee?.id } 
        } : {},
        user.role === 'EMPLOYEE' ? { 
          employeeId: user.employee?.id 
        } : {},
      ],
    };

    const [leaveRequests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: parseInt(limit),
        select: {
          id: true,
          employee: { select: { id: true, firstName: true, lastName: true, employeeId: true } },
          policy: { select: { id: true, name: true, leaveType: true } },
          startDate: true,
          endDate: true,
          days: true,
          status: true,
          reason: true,
          appliedAt: true,
          approvedAt: true,
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { appliedAt: 'desc' },
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return { 
      leaveRequests, 
      pagination: { 
        page: parseInt(page), 
        limit: parseInt(limit), 
        total, 
        pages: Math.ceil(total / parseInt(limit)) 
      } 
    };
  },

  async getLeaveRequest(id, user) {
    const where = { id };
    
    // Apply access control based on user role
    if (user.role === 'EMPLOYEE') {
      where.employeeId = user.employee?.id;
    } else if (user.role === 'MANAGER') {
      // Manager can see requests from their subordinates
      const managerCheck = await prisma.leaveRequest.findFirst({
        where: {
          id,
          OR: [
            { employee: { managerId: user.employee?.id } },
            { employeeId: user.employee?.id } // Manager can see their own requests
          ]
        }
      });
      if (!managerCheck) {
        throw new NotFoundError('Leave request not found or unauthorized');
      }
    }

    const leaveRequest = await prisma.leaveRequest.findFirst({
      where,
      select: {
        id: true,
        employee: { 
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            employeeId: true,
            department: { select: { id: true, name: true } }
          } 
        },
        policy: { 
          select: { 
            id: true, 
            name: true, 
            leaveType: true, 
            daysAllowed: true 
          } 
        },
        startDate: true,
        endDate: true,
        days: true,
        status: true,
        reason: true,
        appliedAt: true,
        approvedAt: true,
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        rejectedAt: true,
        rejectionReason: true,
        cancelledAt: true,
        cancellationReason: true,
        attachments: true,
      },
    });

    if (!leaveRequest) {
      throw new NotFoundError('Leave request not found or unauthorized');
    }

    return leaveRequest;
  },

  async createLeaveRequest({ employeeId, policyId, startDate, endDate, reason, attachments }, req) {
    // Validate employee exists
    const employee = await prisma.employee.findUnique({ 
      where: { id: employeeId, employmentStatus: 'ACTIVE' } 
    });
    if (!employee) {
      throw new AppError('Employee not found or inactive', 400);
    }

    // Validate leave policy exists
    const policy = await prisma.leavePolicy.findUnique({ 
      where: { id: policyId, isActive: true } 
    });
    if (!policy) {
      throw new AppError('Leave policy not found or inactive', 400);
    }

    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      throw new AppError('Start date cannot be after end date', 400);
    }

    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance
    const currentYear = new Date().getFullYear();
    const leaveBalance = await prisma.leaveBalance.findFirst({
      where: { 
        employeeId, 
        policyId, 
        year: currentYear 
      },
    });

    if (!leaveBalance) {
      throw new AppError('No leave balance found for this policy', 400);
    }

    if (leaveBalance.remaining < days) {
      throw new AppError(`Insufficient leave balance. Available: ${leaveBalance.remaining} days, Requested: ${days} days`, 400);
    }

    // Check for overlapping leave requests
    const overlappingRequest = await prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            AND: [
              { startDate: { lte: start } },
              { endDate: { gte: start } }
            ]
          },
          {
            AND: [
              { startDate: { lte: end } },
              { endDate: { gte: end } }
            ]
          },
          {
            AND: [
              { startDate: { gte: start } },
              { endDate: { lte: end } }
            ]
          }
        ]
      }
    });

    if (overlappingRequest) {
      throw new AppError('Leave request overlaps with existing request', 400);
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        policyId,
        startDate: start,
        endDate: end,
        days,
        reason,
        attachments: attachments || [],
        status: 'PENDING',
      },
      select: { 
        id: true, 
        employeeId: true, 
        policyId: true, 
        startDate: true, 
        endDate: true, 
        days: true, 
        status: true,
        reason: true,
        appliedAt: true
      },
    });

    await createAuditLog(req.user.id, 'CREATE', 'leave_requests', leaveRequest.id, null, leaveRequest, req);
    
    return leaveRequest;
  },

  async updateLeaveRequest(id, { status, rejectionReason, cancellationReason, approvedById }, req) {
    const existing = await prisma.leaveRequest.findUnique({ 
      where: { id },
      include: {
        employee: true,
        policy: true
      }
    });
    
    if (!existing) {
      throw new NotFoundError('Leave request not found');
    }

    // Validate status transitions
    if (existing.status === 'APPROVED' && status !== 'CANCELLED') {
      throw new AppError('Approved leave requests can only be cancelled', 400);
    }

    if (existing.status === 'REJECTED' && status !== 'PENDING') {
      throw new AppError('Rejected leave requests can only be reset to pending', 400);
    }

    const data = { status, updatedAt: new Date() };

    if (status === 'APPROVED') {
      data.approvedAt = new Date();
      data.approvedById = approvedById;
      
      // Update leave balance
      const currentYear = new Date().getFullYear();
      await prisma.leaveBalance.updateMany({
        where: {
          employeeId: existing.employeeId,
          policyId: existing.policyId,
          year: currentYear
        },
        data: {
          used: { increment: existing.days },
          remaining: { decrement: existing.days }
        }
      });
    } else if (status === 'REJECTED') {
      data.rejectedAt = new Date();
      data.rejectionReason = rejectionReason;
    } else if (status === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancellationReason = cancellationReason;
      
      // If previously approved, restore leave balance
      if (existing.status === 'APPROVED') {
        const currentYear = new Date().getFullYear();
        await prisma.leaveBalance.updateMany({
          where: {
            employeeId: existing.employeeId,
            policyId: existing.policyId,
            year: currentYear
          },
          data: {
            used: { decrement: existing.days },
            remaining: { increment: existing.days }
          }
        });
      }
    }

    const leaveRequest = await prisma.leaveRequest.update({
      where: { id },
      data,
      select: { 
        id: true, 
        employeeId: true, 
        policyId: true, 
        startDate: true, 
        endDate: true, 
        days: true, 
        status: true,
        approvedAt: true,
        rejectedAt: true,
        cancelledAt: true
      },
    });

    await createAuditLog(req.user.id, 'UPDATE', 'leave_requests', id, existing, leaveRequest, req);
    
    return leaveRequest;
  },

  async deleteLeaveRequest(id, req) {
    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leaveRequest) {
      throw new NotFoundError('Leave request not found');
    }

    // Only allow deletion of pending requests
    if (leaveRequest.status !== 'PENDING') {
      throw new AppError('Only pending leave requests can be deleted', 400);
    }

    await prisma.leaveRequest.delete({ where: { id } });
    
    await createAuditLog(req.user.id, 'DELETE', 'leave_requests', id, leaveRequest, null, req);
  },
};

export { leaveRequestService };
