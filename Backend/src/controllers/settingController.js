import { settingService } from '../services/settingService.js';

export const settingController = {
  async createSetting(req, res) {
    try {
      const setting = await settingService.createSetting(req.body);
      res.status(201).json({ message: 'Setting created successfully', setting });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create setting', details: error.message });
    }
  },

  async getSetting(req, res) {
    try {
      const { id } = req.params;
      const setting = await settingService.getSetting(id);
      if (!setting) return res.status(404).json({ error: 'Setting not found' });
      res.json(setting);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch setting', details: error.message });
    }
  },

  async updateSetting(req, res) {
    try {
      const { id } = req.params;
      const setting = await settingService.updateSetting(id, req.body);
      res.json({ message: 'Setting updated successfully', setting });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update setting', details: error.message });
    }
  },

  async deleteSetting(req, res) {
    try {
      const { id } = req.params;
      await settingService.deleteSetting(id);
      res.json({ message: 'Setting deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete setting', details: error.message });
    }
  },
};
