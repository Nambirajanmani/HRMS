import { z } from 'zod';
import prisma from '../prisma/client.js';
import { NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors.js';

// Validation schemas
const departmentSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .transform(val => val.trim()),
  managerId: z.string().uuid('Invalid manager ID').nullable().optional(),
  parentId: z.string().uuid('Invalid parent department ID').nullable().optional(),
  isActive: z.boolean().default(true),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .nullable()
    .optional()
    .transform(val => val?.trim() || null),
});

const updateDepartmentSchema = departmentSchema.partial();

const getDepartmentsSchema = z.object({
  userRole: z.string(),
  page: z.number().min(1, 'Page must be at least 1').default(1),
  limit: z.number().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(10),
  isActive: z.boolean().optional(),
  parentId: z.string().uuid('Invalid parent department ID').nullable().optional(),
  search: z.string().min(1, 'Search term must not be empty').optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

// Helper function to check authorization
const checkAuthorization = (userRole, requiredRoles) => {
  if (!requiredRoles.includes(userRole)) {
    throw new UnauthorizedError('Insufficient permissions');
  }
};

// Helper function to check for circular parent-child relationships
const checkCircularReference = async (departmentId, parentId) => {
  if (departmentId === parentId) {
    return true;
  }

  let currentParentId = parentId;
  const visitedIds = new Set([departmentId]);
  const maxDepth = 50; // Prevent infinite loops
  let depth = 0;

  while (currentParentId && depth < maxDepth) {
    if (visitedIds.has(currentParentId)) {
      return true; // Circular reference found
    }
    
    visitedIds.add(currentParentId);
    
    try {
      const parent = await prisma.department.findUnique({
        where: { id: currentParentId },
        select: { parentId: true },
      });
      
      if (!parent) break;
      currentParentId = parent.parentId;
      depth++;
    } catch (error) {
      console.error('Error checking circular reference:', error);
      break;
    }
  }

  return false;
};

// Get departments with filtering, pagination, and search
export const getDepartments = async (params) => {
  const validatedParams = getDepartmentsSchema.parse(params);
  const { userRole, page, limit, isActive, parentId, search, sortBy, sortOrder } = validatedParams;

  checkAuthorization(userRole, ['ADMIN', 'HR', 'MANAGER']);

  const skip = (page - 1) * limit;

  // Build where clause
  const where = {};
  if (isActive !== undefined) where.isActive = isActive;
  if (parentId) where.parentId = parentId;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Build orderBy clause
  const orderBy = {};
  orderBy[sortBy] = sortOrder;

  try {
    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        include: {
          manager: {
            select: {
              id: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              email: true,
              position: { select: { title: true } }
            }
          },
          parent: { select: { id: true, name: true } },
          _count: {
            select: {
              employees: { where: { employmentStatus: 'ACTIVE' } },
              children: { where: { isActive: true } }
            }
          },
        },
        orderBy,
      }),
      prisma.department.count({ where }),
    ]);

    return {
      departments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  } catch (error) {
    console.error('Database error in getDepartments:', error);
    throw new Error('Failed to fetch departments');
  }
};

// Get department by ID with detailed information
export const getDepartmentById = async ({ id, userRole }) => {
  if (!id) throw new ValidationError('Department ID is required');
  
  checkAuthorization(userRole, ['ADMIN', 'HR', 'MANAGER']);

  try {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            position: { select: { title: true } }
          }
        },
        parent: { select: { id: true, name: true } },
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            isActive: true,
            _count: { select: { employees: true } }
          },
          orderBy: { name: 'asc' }
        },
        employees: {
          where: { employmentStatus: 'ACTIVE' },
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            employmentStatus: true,
            position: { select: { title: true } },
            hireDate: true
          },
          orderBy: { firstName: 'asc' }
        },
        positions: {
          select: {
            id: true,
            title: true,
            isActive: true,
            _count: {
              select: {
                employees: { where: { employmentStatus: 'ACTIVE' } }
              }
            }
          },
          orderBy: { title: 'asc' }
        },
      },
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    return department;
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error in getDepartmentById:', error);
    throw new Error('Failed to fetch department');
  }
};

// Create a new department
export const createDepartment = async ({ data, userRole }) => {
  checkAuthorization(userRole, ['ADMIN', 'HR']);

  const validatedData = departmentSchema.parse(data);
  const { name, managerId, parentId, description, isActive } = validatedData;

  try {
    // Check if department name already exists
    const existingDepartment = await prisma.department.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });

    if (existingDepartment) {
      throw new ValidationError('Department name already exists');
    }

    // Validate manager exists and is active
    if (managerId) {
      const manager = await prisma.employee.findFirst({
        where: {
          id: managerId,
          employmentStatus: 'ACTIVE'
        }
      });
      if (!manager) {
        throw new ValidationError('Manager not found or not active');
      }
    }

    // Validate parent department exists and is active
    if (parentId) {
      const parent = await prisma.department.findFirst({
        where: {
          id: parentId,
          isActive: true
        }
      });
      if (!parent) {
        throw new ValidationError('Parent department not found or not active');
      }
    }

    const department = await prisma.department.create({
      data: {
        name,
        managerId,
        parentId,
        description,
        isActive: isActive ?? true
      },
      include: {
        manager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            position: { select: { title: true } }
          }
        },
        parent: { select: { id: true, name: true } },
      },
    });

    return department;
  } catch (error) {
    if (error instanceof ValidationError) throw error;
    console.error('Database error in createDepartment:', error);
    throw new Error('Failed to create department');
  }
};

// Update an existing department
export const updateDepartment = async ({ id, data, userRole }) => {
  if (!id) throw new ValidationError('Department ID is required');
  
  checkAuthorization(userRole, ['ADMIN', 'HR']);

  const validatedData = updateDepartmentSchema.parse(data);
  const { name, managerId, parentId, isActive, description } = validatedData;

  try {
    const existingDepartment = await prisma.department.findUnique({ 
      where: { id } 
    });

    if (!existingDepartment) {
      throw new NotFoundError('Department not found');
    }

    // Check if name is being changed and if it conflicts
    if (name && name !== existingDepartment.name) {
      const nameConflict = await prisma.department.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive'
          },
          NOT: { id }
        }
      });
      if (nameConflict) {
        throw new ValidationError('Department name already exists');
      }
    }

    // Validate manager exists and is active
    if (managerId) {
      const manager = await prisma.employee.findFirst({
        where: {
          id: managerId,
          employmentStatus: 'ACTIVE'
        }
      });
      if (!manager) {
        throw new ValidationError('Manager not found or not active');
      }
    }

    // Validate parent department and check for circular references
    if (parentId !== undefined) {
      if (parentId) {
        const parent = await prisma.department.findFirst({
          where: {
            id: parentId,
            isActive: true
          }
        });
        if (!parent) {
          throw new ValidationError('Parent department not found or not active');
        }

        // Check for circular reference
        const hasCircularRef = await checkCircularReference(id, parentId);
        if (hasCircularRef) {
          throw new ValidationError('Cannot create circular parent-child relationship');
        }
      }
    }

    // Build update data object (only include fields that are being updated)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (managerId !== undefined) updateData.managerId = managerId;
    if (parentId !== undefined) updateData.parentId = parentId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (description !== undefined) updateData.description = description;

    const department = await prisma.department.update({
      where: { id },
      data: updateData,
      include: {
        manager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            position: { select: { title: true } }
          }
        },
        parent: { select: { id: true, name: true } },
      },
    });

    return department;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    console.error('Database error in updateDepartment:', error);
    throw new Error('Failed to update department');
  }
};

// Soft delete a department (set isActive to false)
export const deleteDepartment = async ({ id, userRole }) => {
  if (!id) throw new ValidationError('Department ID is required');
  
  checkAuthorization(userRole, ['ADMIN', 'HR']);

  try {
    const existingDepartment = await prisma.department.findUnique({
      where: { id },
      include: {
        employees: { where: { employmentStatus: 'ACTIVE' } },
        children: { where: { isActive: true } },
        positions: { where: { isActive: true } },
      },
    });

    if (!existingDepartment) {
      throw new NotFoundError('Department not found');
    }

    if (!existingDepartment.isActive) {
      throw new ValidationError('Department is already inactive');
    }

    // Check for dependencies
    if (existingDepartment.employees.length > 0) {
      throw new ValidationError(
        `Cannot delete department with ${existingDepartment.employees.length} active employee(s). Please reassign employees first.`
      );
    }

    if (existingDepartment.children.length > 0) {
      throw new ValidationError(
        `Cannot delete department with ${existingDepartment.children.length} active child department(s). Please reassign or delete child departments first.`
      );
    }

    if (existingDepartment.positions.length > 0) {
      throw new ValidationError(
        `Cannot delete department with ${existingDepartment.positions.length} active position(s). Please reassign or delete positions first.`
      );
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        isActive: false,
        // Clear manager when deactivating to avoid referential issues
        managerId: null
      },
      include: {
        manager: {
          select: {
            id: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            position: { select: { title: true } }
          }
        },
        parent: { select: { id: true, name: true } },
      },
    });

    return department;
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    console.error('Database error in deleteDepartment:', error);
    throw new Error('Failed to delete department');
  }
};

// Get department hierarchy
export const getDepartmentHierarchy = async ({ id, userRole }) => {
  if (!id) throw new ValidationError('Department ID is required');
  
  checkAuthorization(userRole, ['ADMIN', 'HR', 'MANAGER']);

  try {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            children: {
              where: { isActive: true },
              select: { id: true, name: true }
            }
          },
          orderBy: { name: 'asc' }
        }
      }
    });

    if (!department) {
      throw new NotFoundError('Department not found');
    }

    // Get full hierarchy path to root
    const hierarchyPath = [];
    let current = department;

    while (current && hierarchyPath.length < 20) { // Prevent infinite loops
      hierarchyPath.unshift({
        id: current.id,
        name: current.name
      });

      if (current.parent) {
        current = await prisma.department.findUnique({
          where: { id: current.parent.id },
          include: { parent: { select: { id: true, name: true } } }
        });
      } else {
        current = null;
      }
    }

    return {
      department,
      hierarchyPath,
      children: department.children
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error in getDepartmentHierarchy:', error);
    throw new Error('Failed to fetch department hierarchy');
  }
};

// Get all active departments (for dropdown/select purposes)
export const getActiveDepartments = async ({ userRole }) => {
  checkAuthorization(userRole, ['ADMIN', 'HR', 'MANAGER']);

  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        parentId: true,
        parent: { select: { id: true, name: true } }
      },
      orderBy: { name: 'asc' }
    });

    return departments;
  } catch (error) {
    console.error('Database error in getActiveDepartments:', error);
    throw new Error('Failed to fetch active departments');
  }
};