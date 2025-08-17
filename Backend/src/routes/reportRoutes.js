import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();
const prisma = new PrismaClient();

// Helper: Validate date
const parseDate = (value) => {
  const date = new Date(value);
  if (isNaN(date)) throw new AppError(`Invalid date: ${value}`, 400);
  return date;
};

// Employee statistics
router.get('/employees/stats', authenticate, authorize('ADMIN', 'HR', 'MANAGER'), async (req, res, next) => {
  try {
    const { departmentId, startDate, endDate } = req.query;

    const where = {
      AND: [
        departmentId ? { departmentId } : {},
        startDate ? { hireDate: { gte: parseDate(startDate) } } : {},
        endDate ? { hireDate: { lte: parseDate(endDate) } } : {},
      ]
    };

    const [
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      terminatedEmployees,
      onLeaveEmployees,
      probationEmployees,
      employeesByDepartment,
      employeesByEmploymentType,
      recentHires,
    ] = await Promise.all([
      prisma.employee.count({ where }),
      prisma.employee.count({ where: { AND: [...where.AND, { employmentStatus: 'ACTIVE' }] } }),
      prisma.employee.count({ where: { AND: [...where.AND, { employmentStatus: 'INACTIVE' }] } }),
      prisma.employee.count({ where: { AND: [...where.AND, { employmentStatus: 'TERMINATED' }] } }),
      prisma.employee.count({ where: { AND: [...where.AND, { employmentStatus: 'ON_LEAVE' }] } }),
      prisma.employee.count({ where: { AND: [...where.AND, { employmentStatus: 'PROBATION' }] } }),

      prisma.employee.groupBy({
        by: ['departmentId'],
        where,
        _count: { id: true },
      }),

      prisma.employee.groupBy({
        by: ['employmentType'],
        where,
        _count: { id: true },
      }),

      prisma.employee.findMany({
        where: {
          ...where,
          hireDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        },
        take: 10,
        orderBy: { hireDate: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          hireDate: true,
          department: { select: { name: true } },
          position: { select: { title: true } }
        }
      })
    ]);

    // Attach department names
    const departmentIds = employeesByDepartment.map(item => item.departmentId).filter(Boolean);
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true }
    });

    const departmentMap = Object.fromEntries(departments.map(d => [d.id, d.name]));

    const employeesByDepartmentWithNames = employeesByDepartment.map(item => ({
      departmentName: item.departmentId ? departmentMap[item.departmentId] : 'No Department',
      count: item._count.id
    }));

    res.json({
      success: true,
      data: {
        stats: {
          overview: {
            totalEmployees,
            activeEmployees,
            inactiveEmployees,
            terminatedEmployees,
            onLeaveEmployees,
            probationEmployees,
          },
          byDepartment: employeesByDepartmentWithNames,
          byEmploymentType: employeesByEmploymentType.map(item => ({
            type: item.employmentType,
            count: item._count.id
          })),
          recentHires,
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Attendance report
router.get('/attendance', authenticate, authorize('ADMIN', 'HR', 'MANAGER'), async (req, res, next) => {
  try {
    const { startDate, endDate, departmentId, employeeId } = req.query;

    if (!startDate || !endDate) throw new AppError('Start date and end date are required', 400);

    const where = {
      AND: [
        { date: { gte: parseDate(startDate) } },
        { date: { lte: parseDate(endDate) } },
        employeeId ? { employeeId } : {},
        departmentId ? { employee: { departmentId } } : {},
      ]
    };

    const [attendanceRecords, attendanceSummary, attendanceByStatus] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: { select: { name: true } }
            }
          }
        },
        orderBy: [{ date: 'desc' }, { employee: { firstName: 'asc' } }]
      }),

      prisma.attendance.aggregate({
        where,
        _sum: { hoursWorked: true, overtimeHours: true },
        _avg: { hoursWorked: true },
        _count: { id: true },
      }),

      prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      })
    ]);

    res.json({
      success: true,
      data: {
        report: {
          summary: {
            totalRecords: attendanceSummary._count.id,
            totalHoursWorked: attendanceSummary._sum.hoursWorked || 0,
            totalOvertimeHours: attendanceSummary._sum.overtimeHours || 0,
            averageHoursPerDay: attendanceSummary._avg.hoursWorked || 0,
          },
          byStatus: attendanceByStatus.map(item => ({
            status: item.status,
            count: item._count.id
          })),
          records: attendanceRecords,
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Leave report
router.get('/leave', authenticate, authorize('ADMIN', 'HR', 'MANAGER'), async (req, res, next) => {
  try {
    const { year = new Date().getFullYear(), departmentId, status } = req.query;

    const where = {
      AND: [
        { startDate: { gte: new Date(`${year}-01-01`) } },
        { startDate: { lt: new Date(`${parseInt(year) + 1}-01-01`) } },
        departmentId ? { employee: { departmentId } } : {},
        status ? { status } : {},
      ]
    };

    const [leaveRequests, leaveSummary, leaveByType, leaveByStatus, leaveBalances] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: { select: { name: true } }
            }
          },
          policy: { select: { name: true, leaveType: true } }
        },
        orderBy: { appliedAt: 'desc' }
      }),

      prisma.leaveRequest.aggregate({
        where,
        _sum: { days: true },
        _count: { id: true },
      }),

      prisma.leaveRequest.groupBy({
        by: ['policyId'],
        where,
        _sum: { days: true },
        _count: { id: true },
      }),

      prisma.leaveRequest.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),

      prisma.leaveBalance.findMany({
        where: {
          year: parseInt(year),
          ...(departmentId ? { employee: { departmentId } } : {})
        },
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
              employeeId: true,
              department: { select: { name: true } }
            }
          },
          policy: { select: { name: true, leaveType: true } }
        }
      })
    ]);

    // Map policy names
    const policyIds = leaveByType.map(item => item.policyId);
    const policies = await prisma.leavePolicy.findMany({
      where: { id: { in: policyIds } },
      select: { id: true, name: true, leaveType: true }
    });

    const policyMap = Object.fromEntries(policies.map(p => [p.id, p]));

    res.json({
      success: true,
      data: {
        report: {
          summary: {
            totalRequests: leaveSummary._count.id,
            totalDays: leaveSummary._sum.days || 0,
          },
          byType: leaveByType.map(item => ({
            policyName: policyMap[item.policyId]?.name || 'Unknown',
            leaveType: policyMap[item.policyId]?.leaveType || 'UNKNOWN',
            totalDays: item._sum.days,
            totalRequests: item._count.id
          })),
          byStatus: leaveByStatus.map(item => ({
            status: item.status,
            count: item._count.id
          })),
          requests: leaveRequests,
          balances: leaveBalances,
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Payroll summary report
router.get('/payroll', authenticate, authorize('ADMIN', 'HR'), async (req, res, next) => {
  try {
    const { startDate, endDate, departmentId } = req.query;

    if (!startDate || !endDate) throw new AppError('Start date and end date are required', 400);

    const where = {
      AND: [
        { payPeriodStart: { gte: parseDate(startDate) } },
        { payPeriodEnd: { lte: parseDate(endDate) } },
        departmentId ? { employee: { departmentId } } : {},
      ]
    };

    const [payrollRecords, payrollSummary] = await Promise.all([
      prisma.payrollRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeId: true,
              department: { select: { name: true } }
            }
          }
        },
        orderBy: { payPeriodStart: 'desc' }
      }),

      prisma.payrollRecord.aggregate({
        where,
        _sum: {
          baseSalary: true,
          overtime: true,
          bonuses: true,
          allowances: true,
          deductions: true,
          tax: true,
          netPay: true,
        },
        _count: { id: true },
      })
    ]);

    res.json({
      success: true,
      data: {
        report: {
          summary: {
            totalRecords: payrollSummary._count.id,
            totalBaseSalary: payrollSummary._sum.baseSalary || 0,
            totalOvertime: payrollSummary._sum.overtime || 0,
            totalBonuses: payrollSummary._sum.bonuses || 0,
            totalAllowances: payrollSummary._sum.allowances || 0,
            totalDeductions: payrollSummary._sum.deductions || 0,
            totalTax: payrollSummary._sum.tax || 0,
            totalNetPay: payrollSummary._sum.netPay || 0,
          },
          records: payrollRecords,
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Audit logs report
router.get('/audit', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, limit = 50, userId, action, resource, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      AND: [
        userId ? { userId } : {},
        action ? { action } : {},
        resource ? { resource } : {},
        startDate ? { timestamp: { gte: parseDate(startDate) } } : {},
        endDate ? { timestamp: { lte: parseDate(endDate) } } : {},
      ]
    };

    const [logs, total, actionSummary] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          user: {
            select: {
              id: true,
              email: true,
              employee: { select: { firstName: true, lastName: true } }
            }
          }
        },
        orderBy: { timestamp: 'desc' }
      }),

      prisma.auditLog.count({ where }),

      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { id: true },
      })
    ]);

    res.json({
      success: true,
      data: {
        report: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          },
          summary: {
            totalLogs: total,
            byAction: actionSummary.map(item => ({
              action: item.action,
              count: item._count.id
            }))
          }
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
