import { interviewService } from '../services/interviewService.js';

export const interviewController = {
  async createInterview(req, res) {
    try {
      const interview = await interviewService.createInterview(req.body);
      res.status(201).json({ message: 'Interview created successfully', interview });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create interview', details: error.message });
    }
  },

  async getInterview(req, res) {
    try {
      const { id } = req.params;
      const interview = await interviewService.getInterview(id);
      if (!interview) return res.status(404).json({ error: 'Interview not found' });
      res.json(interview);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch interview', details: error.message });
    }
  },

  async updateInterview(req, res) {
    try {
      const { id } = req.params;
      const interview = await interviewService.updateInterview(id, req.body);
      res.json({ message: 'Interview updated successfully', interview });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update interview', details: error.message });
    }
  },

  async deleteInterview(req, res) {
    try {
      const { id } = req.params;
      await interviewService.deleteInterview(id);
      res.json({ message: 'Interview deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete interview', details: error.message });
    }
  },
};
