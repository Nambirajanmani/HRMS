import { onboardingTemplateService } from '../services/onboardingTemplateService.js';

export const onboardingTemplateController = {
  async createOnboardingTemplate(req, res) {
    try {
      const onboardingTemplate = await onboardingTemplateService.createOnboardingTemplate(req.body);
      res.status(201).json({ message: 'Onboarding template created successfully', onboardingTemplate });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create onboarding template', details: error.message });
    }
  },

  async getOnboardingTemplate(req, res) {
    try {
      const { id } = req.params;
      const onboardingTemplate = await onboardingTemplateService.getOnboardingTemplate(id);
      if (!onboardingTemplate) return res.status(404).json({ error: 'Onboarding template not found' });
      res.json(onboardingTemplate);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch onboarding template', details: error.message });
    }
  },

  async updateOnboardingTemplate(req, res) {
    try {
      const { id } = req.params;
      const onboardingTemplate = await onboardingTemplateService.updateOnboardingTemplate(id, req.body);
      res.json({ message: 'Onboarding template updated successfully', onboardingTemplate });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update onboarding template', details: error.message });
    }
  },

  async deleteOnboardingTemplate(req, res) {
    try {
      const { id } = req.params;
      await onboardingTemplateService.deleteOnboardingTemplate(id);
      res.json({ message: 'Onboarding template deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete onboarding template', details: error.message });
    }
  },
};
