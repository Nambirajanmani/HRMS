import { trainingRecordService } from '../services/trainingRecordService.js';

export const trainingRecordController = {
  async createTrainingRecord(req, res) {
    try {
      const trainingRecord = await trainingRecordService.createTrainingRecord(req.body);
      res.status(201).json({ message: 'Training record created successfully', trainingRecord });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create training record', details: error.message });
    }
  },

  async getTrainingRecord(req, res) {
    try {
      const { id } = req.params;
      const trainingRecord = await trainingRecordService.getTrainingRecord(id);
      if (!trainingRecord) return res.status(404).json({ error: 'Training record not found' });
      res.json(trainingRecord);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch training record', details: error.message });
    }
  },

  async updateTrainingRecord(req, res) {
    try {
      const { id } = req.params;
      const trainingRecord = await trainingRecordService.updateTrainingRecord(id, req.body);
      res.json({ message: 'Training record updated successfully', trainingRecord });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update training record', details: error.message });
    }
  },

  async deleteTrainingRecord(req, res) {
    try {
      const { id } = req.params;
      await trainingRecordService.deleteTrainingRecord(id);
      res.json({ message: 'Training record deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete training record', details: error.message });
    }
  },
};

