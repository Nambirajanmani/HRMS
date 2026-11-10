import express from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import logger from "../utils/logger.js";
const router = express.Router();
import timeService from "../services/timeService.js";
import prisma from "../config/prisma.js";

/**
 * GET /api/employees/time/:userId
 * Get all time entries for a user (employee can only see their own)
 */
router.get("/time/:userId", authenticate, authorize('EMPLOYEE', 'ADMIN', 'HR', 'MANAGER'), async (req, res) => {
  const { userId } = req.params;
  try {
    // Employees can only see their own time entries
    if (req.user.role === 'EMPLOYEE' && req.user.id !== userId) {
      return res.status(403).json({ 
        status: 'error',
        message: "You can only view your own time entries",
        code: 'ACCESS_DENIED'
      });
    }

    // Find employee by userId (linking through User record)
    const employee = await prisma.employee.findUnique({ 
      where: { userId: userId },
      select: { id: true, employeeId: true, firstName: true, lastName: true }
    });
    
    if (!employee) {
      return res.status(404).json({ 
        status: 'error',
        message: "Employee not found",
        code: 'EMPLOYEE_NOT_FOUND'
      });
    }

    const timeEntries = await timeService.getTimeEntriesByUser(employee.id);
    res.status(200).json({
      status: 'success',
      data: {
        employee: { id: employee.id, employeeId: employee.employeeId },
        timeEntries: timeEntries || []
      }
    });
  } catch (error) {
    logger.error("Error fetching time entries:", { error: error.message, userId });
    res.status(500).json({ 
      status: 'error',
      message: "Internal server error",
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/employees/time/checkin/:userId
 * Record check-in for an employee
 */
router.post("/time/checkin/:userId", authenticate, authorize('EMPLOYEE', 'ADMIN'), async (req, res) => {
  const { userId } = req.params;
  try {
    // Employees can only check in themselves (unless admin)
    if (req.user.role === 'EMPLOYEE' && req.user.id !== userId) {
      return res.status(403).json({ 
        status: 'error',
        message: "You can only check yourself in",
        code: 'ACCESS_DENIED'
      });
    }

    // Find employee by userId (linking through User record)
    const employee = await prisma.employee.findUnique({ 
      where: { userId: userId },
      select: { id: true, employeeId: true, firstName: true, lastName: true }
    });
    
    if (!employee) {
      return res.status(404).json({ 
        status: 'error',
        message: "Employee not found",
        code: 'EMPLOYEE_NOT_FOUND'
      });
    }

    const timeEntry = await timeService.createTimeEntryCheckIn(employee.id);
    res.status(201).json({ 
      status: 'success',
      message: "Check-in recorded successfully",
      data: { timeEntry }
    });
  } catch (error) {
    logger.error("Error during check-in:", { error: error.message, userId });
    res.status(500).json({ 
      status: 'error',
      message: "Internal server error",
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/employees/time/checkout/:userId
 * Record check-out for an employee
 */
router.post("/time/checkout/:userId", authenticate, authorize('EMPLOYEE', 'ADMIN'), async (req, res) => {
  const { userId } = req.params;
  try {
    // Employees can only check themselves out (unless admin)
    if (req.user.role === 'EMPLOYEE' && req.user.id !== userId) {
      return res.status(403).json({ 
        status: 'error',
        message: "You can only check yourself out",
        code: 'ACCESS_DENIED'
      });
    }

    // Find employee by userId (linking through User record)
    const employee = await prisma.employee.findUnique({ 
      where: { userId: userId },
      select: { id: true, employeeId: true, firstName: true, lastName: true }
    });
    
    if (!employee) {
      return res.status(404).json({ 
        status: 'error',
        message: "Employee not found",
        code: 'EMPLOYEE_NOT_FOUND'
      });
    }

    const updatedEntry = await timeService.createTimeEntryCheckOut(employee.id);
    res.status(200).json({ 
      status: 'success',
      message: "Check-out recorded successfully",
      data: { timeEntry: updatedEntry }
    });
  } catch (error) {
    logger.error("Error during check-out:", { error: error.message, userId });
    if (error.message === "No active check-in found for the user") {
      return res.status(400).json({ 
        status: 'error',
        message: error.message,
        code: 'NO_ACTIVE_CHECKIN'
      });
    }
    res.status(500).json({ 
      status: 'error',
      message: "Internal server error",
      code: 'SERVER_ERROR'
    });
  }
});

export default router;
