import { onboardingTaskService } from '../services/onboardingTaskService.js';

export const onboardingTaskController = {
  async createOnboardingTask(req, res) {
    try {
      const onboardingTask = await onboardingTaskService.createOnboardingTask(req.body);
      res.status(201).json({ message: 'Onboarding task created successfully', onboardingTask });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create onboarding task', details: error.message });
    }
  },

  async getOnboardingTask(req, res) {
    try {
      const { id } = req.params;
      const onboardingTask = await onboardingTaskService.getOnboardingTask(id);
      if (!onboardingTask) return res.status(404).json({ error: 'Onboarding task not found' });
      res.json(onboardingTask);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch onboarding task', details: error.message });
    }
  },

  async updateOnboardingTask(req, res) {
    try {
      const { id } = req.params;
      const onboardingTask = await onboardingTaskService.updateOnboardingTask(id, req.body);
      res.json({ message: 'Onboarding task updated successfully', onboardingTask });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update onboarding task', details: error.message });
    }
  },

  async deleteOnboardingTask(req, res) {
    try {
      const { id } = req.params;
      await onboardingTaskService.deleteOnboardingTask(id);
      res.json({ message: 'Onboarding task deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete onboarding task', details: error.message });
    }
  },
};

