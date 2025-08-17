
import { positionService } from '../services/positionService.js';

export const positionController = {
  async createPosition(req, res) {
    try {
      const position = await positionService.createPosition(req.body);
      res.status(201).json({ message: 'Position created successfully', position });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create position', details: error.message });
    }
  },

  async getPosition(req, res) {
    try {
      const { id } = req.params;
      const position = await positionService.getPosition(id);
      if (!position) return res.status(404).json({ error: 'Position not found' });
      res.json(position);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch position', details: error.message });
    }
  },

  async updatePosition(req, res) {
    try {
      const { id } = req.params;
      const position = await positionService.updatePosition(id, req.body);
      res.json({ message: 'Position updated successfully', position });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update position', details: error.message });
    }
  },

  async deletePosition(req, res) {
    try {
      const { id } = req.params;
      await positionService.deletePosition(id);
      res.json({ message: 'Position deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete position', details: error.message });
    }
  },
};

