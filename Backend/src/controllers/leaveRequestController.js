
import { leaveRequestService } from '../services/leaveRequestService.js';

export const leaveRequestController = {
  async createLeaveRequest(req, res) {
    try {
      const leaveRequest = await leaveRequestService.createLeaveRequest(req.body);
      res.status(201).json({ message: 'Leave request created successfully', leaveRequest });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create leave request', details: error.message });
    }
  },

  async getLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const leaveRequest = await leaveRequestService.getLeaveRequest(id);
      if (!leaveRequest) return res.status(404).json({ error: 'Leave request not found' });
      res.json(leaveRequest);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch leave request', details: error.message });
    }
  },

  async updateLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      const leaveRequest = await leaveRequestService.updateLeaveRequest(id, req.body);
      res.json({ message: 'Leave request updated successfully', leaveRequest });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update leave request', details: error.message });
    }
  },

  async deleteLeaveRequest(req, res) {
    try {
      const { id } = req.params;
      await leaveRequestService.deleteLeaveRequest(id);
      res.json({ message: 'Leave request deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete leave request', details: error.message });
    }
  },
};
