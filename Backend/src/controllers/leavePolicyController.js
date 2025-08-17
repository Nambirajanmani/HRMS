
import { leavePolicyService } from '../services/leavePolicyService.js';

export const leavePolicyController = {
  async createLeavePolicy(req, res) {
    try {
      const leavePolicy = await leavePolicyService.createLeavePolicy(req.body);
      res.status(201).json({ message: 'Leave policy created successfully', leavePolicy });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create leave policy', details: error.message });
    }
  },

  async getLeavePolicy(req, res) {
    try {
      const { id } = req.params;
      const leavePolicy = await leavePolicyService.getLeavePolicy(id);
      if (!leavePolicy) return res.status(404).json({ error: 'Leave policy not found' });
      res.json(leavePolicy);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch leave policy', details: error.message });
    }
  },

  async updateLeavePolicy(req, res) {
    try {
      const { id } = req.params;
      const leavePolicy = await leavePolicyService.updateLeavePolicy(id, req.body);
      res.json({ message: 'Leave policy updated successfully', leavePolicy });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update leave policy', details: error.message });
    }
  },

  async deleteLeavePolicy(req, res) {
    try {
      const { id } = req.params;
      await leavePolicyService.deleteLeavePolicy(id);
      res.json({ message: 'Leave policy deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete leave policy', details: error.message });
    }
  },
};
