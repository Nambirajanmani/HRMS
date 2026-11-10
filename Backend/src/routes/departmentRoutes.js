// src/routes/departmentRoutes.js - Minimal working version
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import prisma from '../config/prisma.js';

const router = express.Router();

/**
 * GET /api/departments - Get all departments with pagination
 */
router.get('/', authenticate, authorize('ADMIN', 'HR', 'MANAGER'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'name';
    const sortOrder = req.query.sortOrder || 'asc';

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
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
          parent: {
            select: { id: true, name: true }
          },
          _count: {
            select: {
              employees: { where: { employmentStatus: 'ACTIVE' } },
              children: { where: { isActive: true } }
            }
          }
        }
      }),
      prisma.department.count({ where })
    ]);

    res.json({
      status: 'success',
      data: {
        departments,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * POST /api/departments - Create a new department
 */
router.post('/', authenticate, authorize('ADMIN', 'HR'), async (req, res) => {
  try {
    const { createDepartment } = await import('../services/departmentService.js');

    const department = await createDepartment({
      data: req.body,
      userRole: req.user.role
    });

    res.status(201).json({
      status: 'success',
      data: { department },
      message: 'Department created successfully'
    });
  } catch (error) {
    console.error('Error creating department:', error);
    if (error.name === 'ValidationError') {
      res.status(400).json({
        status: 'error',
        message: error.message,
        errors: error.errors
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to create department'
      });
    }
  }
});

/**
 * PUT /api/departments/:id - Update an existing department
 */
router.put('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res) => {
  try {
    const { updateDepartment } = await import('../services/departmentService.js');

    const department = await updateDepartment({
      id: req.params.id,
      data: req.body,
      userRole: req.user.role
    });

    res.json({
      status: 'success',
      data: { department },
      message: 'Department updated successfully'
    });
  } catch (error) {
    console.error('Error updating department:', error);
    if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
      res.status(error.name === 'NotFoundError' ? 404 : 400).json({
        status: 'error',
        message: error.message,
        errors: error.errors
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to update department'
      });
    }
  }
});

/**
 * PATCH /api/departments/:id/toggle-status - Toggle department status
 */
router.patch('/:id/toggle-status', authenticate, authorize('ADMIN', 'HR'), async (req, res) => {
  try {
    const { toggleDepartmentStatus } = await import('../services/departmentService.js');

    const department = await toggleDepartmentStatus({
      id: req.params.id,
      userRole: req.user.role
    });

    res.json({
      status: 'success',
      data: { department },
      message: `Department ${department.isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Error toggling department status:', error);
    if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
      res.status(error.name === 'NotFoundError' ? 404 : 400).json({
        status: 'error',
        message: error.message,
        errors: error.errors
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to toggle department status'
      });
    }
  }
});

/**
 * DELETE /api/departments/:id - Delete (deactivate) a department
 */
router.delete('/:id', authenticate, authorize('ADMIN', 'HR'), async (req, res) => {
  try {
    const { deleteDepartment } = await import('../services/departmentService.js');

    const department = await deleteDepartment({
      id: req.params.id,
      userRole: req.user.role
    });

    res.json({
      status: 'success',
      data: { department },
      message: 'Department deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting department:', error);
    if (error.name === 'ValidationError' || error.name === 'NotFoundError') {
      res.status(error.name === 'NotFoundError' ? 404 : 400).json({
        status: 'error',
        message: error.message,
        errors: error.errors
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Failed to delete department'
      });
    }
  }
});

export default router;
