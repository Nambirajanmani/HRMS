import { PrismaClient } from '@prisma/client';
import { AppError, NotFoundError, ValidationError } from '../utils/errors.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

// Utility functions for employee service
const validateEmployeeData = async (data, isUpdate = false) => {
  const { employeeId, email, departmentId, positionId, managerId } = data;

  // Check for existing employee ID (only for create or if employeeId is being changed)
  if (!isUpdate && employeeId) {
    const existingEmployee = await prisma.employee.findUnique({
      where: { employeeId }
    });
    if (existingEmployee) {
      throw new ValidationError('Employee ID already exists', null, 'DUPLICATE_EMPLOYEE_ID');
    }
  }

  // Check for existing email (only for create or if email is being changed)
  if (email) {
    const existingEmail = await prisma.employee.findUnique({
      where: { email }
    });
    if (existingEmail && (!isUpdate || existingEmail.id !== data.id)) {
      throw new ValidationError('Email already exists', null, 'DUPLICATE_EMAIL');
    }
  }

  // Validate department exists if provided
  if (departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId, isActive: true },
    });
    if (!department) {
      throw new ValidationError('Department not found or inactive', null, 'DEPARTMENT_NOT_FOUND');
    }
  }

  // Validate position exists if provided
  if (positionId) {
    const position = await prisma.position.findUnique({
      where: { id: positionId, isActive: true },
    });
    if (!position) {
      throw new ValidationError('Position not found or inactive', null, 'POSITION_NOT_FOUND');
    }
  }

  // Validate manager exists if provided
  if (managerId) {
    const manager = await prisma.employee.findUnique({
      where: { id: managerId, employmentStatus: 'ACTIVE' },
    });
    if (!manager) {
      throw new ValidationError('Manager not found or inactive', null, 'MANAGER_NOT_FOUND');
    }
  }
};

const buildEmployeeFilters = (user, filters = {}) => {
  const { search, departmentId, employmentStatus, employmentType } = filters;
  
  const where = {
    AND: [
      search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { employeeId: { contains: search, mode: 'insensitive' } },
        ]
      } : {},
      departmentId ? { departmentId } : {},
      employmentStatus ? { employmentStatus } : {},
      employmentType ? { employmentType } : {},
    ],
  };

  // Apply role-based filtering for managers
  const userRole = user.role.toUpperCase();
  if (userRole === 'MANAGER' && user.employee) {
    where.AND.push({
      OR: [
        { managerId: user.employee.id }, // Subordinates
        { id: user.employee.id }         // Self
      ]
    });
  }

  return where;
};

const formatEmployeeData = (data) => {
  const formattedData = { ...data };
  
  // Convert date strings to Date objects
  if (data.dateOfBirth) {
    formattedData.dateOfBirth = new Date(data.dateOfBirth);
  }
  if (data.hireDate) {
    formattedData.hireDate = new Date(data.hireDate);
  }
  if (data.probationEndDate) {
    formattedData.probationEndDate = new Date(data.probationEndDate);
  }
  if (data.terminationDate) {
    formattedData.terminationDate = new Date(data.terminationDate);
  }

  return formattedData;
};

// Employee service functions
const getAllEmployees = async ({ page, limit, search, departmentId, employmentStatus, employmentType, user }) => {
  try {
    const skip = (page - 1) * limit;
    const where = buildEmployeeFilters(user, { search, departmentId, employmentStatus, employmentType });

    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        skip,
        take: limit,
        orderBy: { firstName: 'asc' },
        include: {
          department: {
            select: { id: true, name: true },
          },
          position: {
            select: { id: true, title: true, level: true },
          },
          manager: {
            select: { id: true, firstName: true, lastName: true },
          },
          user: {
            select: { id: true, email: true, role: true, isActive: true },
          },
        },
      }),
      prisma.employee.count({ where }),
    ]);

    return {
      employees,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    logger.error('Error in getAllEmployees service', { error: error.message });
    throw new AppError('Failed to fetch employees', 500, null, 'SERVER_ERROR');
  }
};

const getEmployee = async (id, user) => {
  try {
    // Build access control query
    let where = { id };
    
    // Apply role-based access control
    const userRole = user.role.toUpperCase();
    if (userRole === 'MANAGER' && user.employee) {
      const managerCheck = await prisma.employee.findFirst({
        where: {
          id,
          OR: [
            { managerId: user.employee.id }, // Subordinate
            { id: user.employee.id }         // Self
          ]
        }
      });
      
      if (!managerCheck) {
        throw new NotFoundError('Employee not found or unauthorized');
      }
    } else if (userRole === 'EMPLOYEE' && user.employee) {
      // Employees can only view their own profile
      if (id !== user.employee.id) {
        throw new NotFoundError('Employee not found or unauthorized');
      }
    }

    const employee = await prisma.employee.findUnique({
      where,
      include: {
        department: {
          select: { 
            id: true, 
            name: true,
            manager: { select: { id: true, firstName: true, lastName: true } }
          },
        },
        position: {
          select: { 
            id: true, 
            title: true, 
            level: true, 
            description: true,
            minSalary: true,
            maxSalary: true
          },
        },
        manager: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        subordinates: {
          select: { 
            id: true, 
            firstName: true, 
            lastName: true, 
            employeeId: true,
            position: { select: { title: true } }
          },
          where: { employmentStatus: 'ACTIVE' },
        },
        user: {
          select: { 
            id: true, 
            email: true, 
            role: true, 
            isActive: true, 
            lastLoginAt: true 
          },
        },
        attendanceRecords: {
          select: { 
            id: true, 
            date: true, 
            status: true, 
            checkIn: true, 
            checkOut: true,
            hoursWorked: true
          },
          orderBy: { date: 'desc' },
          take: 10,
        },
        leaveRequests: {
          select: { 
            id: true, 
            startDate: true, 
            endDate: true, 
            days: true,
            status: true,
            policy: { select: { name: true, leaveType: true } }
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    return employee;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    logger.error('Error in getEmployee service', { error: error.message, employeeId: id });
    throw new AppError('Failed to fetch employee', 500, null, 'SERVER_ERROR');
  }
};

const createEmployee = async (data, req) => {
  try {
    // Validate employee data
    await validateEmployeeData(data);

    const formattedData = formatEmployeeData(data);

    const newEmployee = await prisma.employee.create({
      data: {
        ...formattedData,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true, level: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await createAuditLog(req.user.id, 'CREATE', 'employees', newEmployee.id, null, newEmployee, req);
    
    logger.info('Employee created in service', { employeeId: newEmployee.id });
    
    return newEmployee;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error in createEmployee service', { error: error.message });
    throw new AppError('Failed to create employee', 500, null, 'SERVER_ERROR');
  }
};

const updateEmployee = async (id, data, req) => {
  try {
    const existingEmployee = await prisma.employee.findUnique({ where: { id } });
    if (!existingEmployee) {
      throw new NotFoundError('Employee not found');
    }

    // Validate update data
    await validateEmployeeData({ ...data, id }, true);

    const formattedData = formatEmployeeData(data);

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        ...formattedData,
        updatedById: req.user.id,
      },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true, level: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await createAuditLog(req.user.id, 'UPDATE', 'employees', id, existingEmployee, updatedEmployee, req);
    
    logger.info('Employee updated in service', { employeeId: id });
    
    return updatedEmployee;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error in updateEmployee service', { error: error.message, employeeId: id });
    throw new AppError('Failed to update employee', 500, null, 'SERVER_ERROR');
  }
};

const deleteEmployee = async (id, req) => {
  try {
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
      include: {
        subordinates: {
          where: { employmentStatus: 'ACTIVE' },
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!existingEmployee) {
      throw new NotFoundError('Employee not found');
    }

    if (existingEmployee.employmentStatus === 'TERMINATED') {
      throw new ValidationError('Employee is already terminated', null, 'ALREADY_TERMINATED');
    }

    // Check if employee has active subordinates
    if (existingEmployee.subordinates.length > 0) {
      throw new ValidationError(
        'Cannot terminate employee with active subordinates. Please reassign subordinates first.',
        null,
        'HAS_ACTIVE_SUBORDINATES'
      );
    }

    // Soft delete by updating employment status
    const terminatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        employmentStatus: 'TERMINATED',
        terminationDate: new Date(),
        updatedById: req.user.id,
      },
    });

    // Also deactivate associated user account if exists
    if (existingEmployee.userId) {
      await prisma.user.update({
        where: { id: existingEmployee.userId },
        data: { isActive: false },
      });
    }

    await createAuditLog(req.user.id, 'DELETE', 'employees', id, existingEmployee, terminatedEmployee, req);
    
    logger.info('Employee terminated in service', { employeeId: id });
    
    return terminatedEmployee;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    logger.error('Error in deleteEmployee service', { error: error.message, employeeId: id });
    throw new AppError('Failed to delete employee', 500, null, 'SERVER_ERROR');
  }
};

// Export service functions
export const employeeService = {
  getAllEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
};

export default employeeService;