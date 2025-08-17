import { employeeService } from '../services/employeeService.js';
import { createAuditLog } from '../middleware/auditMiddleware.js';
import logger from '../utils/logger.js';

// Create employee controller using functional programming approach
const createEmployee = async (req, res, next) => {
  try {
    const employeeData = {
      ...req.body,
      createdById: req.user?.id,
    };
    
    const employee = await employeeService.createEmployee(employeeData, req);
    
    logger.info('Employee created successfully', {
      employeeId: employee.id,
      createdBy: req.user?.id
    });
    
    res.status(201).json({ 
      success: true,
      message: 'Employee created successfully', 
      data: { employee }
    });
  } catch (error) {
    logger.error('Failed to create employee', {
      error: error.message,
      userId: req.user?.id,
      requestData: req.body
    });
    next(error);
  }
};

const getEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const employee = await employeeService.getEmployee(id, req.user);
    
    if (!employee) {
      return res.status(404).json({ 
        success: false,
        error: 'Employee not found' 
      });
    }
    
    await createAuditLog(req.user.id, 'READ', 'employees', id, null, null, req);
    
    res.json({ 
      success: true,
      message: 'Employee fetched successfully',
      data: employee 
    });
  } catch (error) {
    logger.error('Failed to fetch employee', {
      error: error.message,
      employeeId: req.params.id,
      userId: req.user?.id
    });
    next(error);
  }
};

const getAllEmployees = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, departmentId, employmentStatus, employmentType } = req.query;
    
    const employees = await employeeService.getAllEmployees({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      departmentId,
      employmentStatus,
      employmentType,
      user: req.user
    });
    
    await createAuditLog(req.user.id, 'READ', 'employees', null, null, null, req);
    
    res.json({ 
      success: true,
      message: 'Employees fetched successfully',
      data: employees 
    });
  } catch (error) {
    logger.error('Failed to fetch employees', {
      error: error.message,
      userId: req.user?.id,
      queryParams: req.query
    });
    next(error);
  }
};

const updateEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedById: req.user?.id,
    };
    
    const employee = await employeeService.updateEmployee(id, updateData, req);
    
    logger.info('Employee updated successfully', {
      employeeId: id,
      updatedBy: req.user?.id
    });
    
    res.json({ 
      success: true,
      message: 'Employee updated successfully', 
      data: { employee }
    });
  } catch (error) {
    logger.error('Failed to update employee', {
      error: error.message,
      employeeId: req.params.id,
      userId: req.user?.id,
      updateData: req.body
    });
    next(error);
  }
};

const deleteEmployee = async (req, res, next) => {
  try {
    const { id } = req.params;
    await employeeService.deleteEmployee(id, req);
    
    logger.info('Employee deleted successfully', {
      employeeId: id,
      deletedBy: req.user?.id
    });
    
    res.json({ 
      success: true,
      message: 'Employee deleted successfully' 
    });
  } catch (error) {
    logger.error('Failed to delete employee', {
      error: error.message,
      employeeId: req.params.id,
      userId: req.user?.id
    });
    next(error);
  }
};

// Export controller functions
export const employeeController = {
  createEmployee,
  getEmployee,
  getAllEmployees,
  updateEmployee,
  deleteEmployee,
};

export default employeeController;