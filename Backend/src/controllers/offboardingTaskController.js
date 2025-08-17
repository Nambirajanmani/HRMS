import { offboardingTaskService } from '../services/offboardingTaskService.js';

export const offboardingTaskController = {
  async createOffboardingTask(req, res) {
    try {
      const offboardingTask = await offboardingTaskService.createOffboardingTask(req.body);
      res.status(201).json({ message: 'Offboarding task created successfully', offboardingTask });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create offboarding task', details: error.message });
    }
  },

  async getOffboardingTask(req, res) {
    try {
      const { id } = req.params;
      const offboardingTask = await offboardingTaskService.getOffboardingTask(id);
      if (!offboardingTask) return res.status(404).json({ error: 'Offboarding task not found' });
      res.json(offboardingTask);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch offboarding task', details: error.message });
    }
  },

  async updateOffboardingTask(req, res) {
    try {
      const { id } = req.params;
      const offboardingTask = await offboardingTaskService.updateOffboardingTask(id, req.body);
      res.json({ message: 'Offboarding task updated successfully', offboardingTask });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update offboarding task', details: error.message });
    }
  },

  async deleteOffboardingTask(req, res) {
    try {
      const { id } = req.params;
      await offboardingTaskService.deleteOffboardingTask(id);
      res.json({ message: 'Offboarding task deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete offboarding task', details: error.message });
    }
  },
};

