
import { leaveBalanceService } from '../services/leaveBalanceService.js';

export const leaveBalanceController = {
  async createLeaveBalance(req, res) {
    try {
      const leaveBalance = await leaveBalanceService.createLeaveBalance(req.body);
      res.status(201).json({ message: 'Leave balance created successfully', leaveBalance });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create leave balance', details: error.message });
    }
  },

  async getLeaveBalance(req, res) {
    try {
      const { id } = req.params;
      const leaveBalance = await leaveBalanceService.getLeaveBalance(id);
      if (!leaveBalance) return res.status(404).json({ error: 'Leave balance not found' });
      res.json(leaveBalance);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch leave balance', details: error.message });
    }
  },

  async updateLeaveBalance(req, res) {
    try {
      const { id } = req.params;
      const leaveBalance = await leaveBalanceService.updateLeaveBalance(id, req.body);
      res.json({ message: 'Leave balance updated successfully', leaveBalance });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update leave balance', details: error.message });
    }
  },

  async deleteLeaveBalance(req, res) {
    try {
      const { id } = req.params;
      await leaveBalanceService.deleteLeaveBalance(id);
      res.json({ message: 'Leave balance deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete leave balance', details: error.message });
    }
  },
};
