import { trainingProgramService } from '../services/trainingProgramService.js';

export const trainingProgramController = {
  async createTrainingProgram(req, res) {
    try {
      const trainingProgram = await trainingProgramService.createTrainingProgram(req.body);
      res.status(201).json({ message: 'Training program created successfully', trainingProgram });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create training program', details: error.message });
    }
  },

  async getTrainingProgram(req, res) {
    try {
      const { id } = req.params;
      const trainingProgram = await trainingProgramService.getTrainingProgram(id);
      if (!trainingProgram) return res.status(404).json({ error: 'Training program not found' });
      res.json(trainingProgram);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch training program', details: error.message });
    }
  },

  async updateTrainingProgram(req, res) {
    try {
      const { id } = req.params;
      const trainingProgram = await trainingProgramService.updateTrainingProgram(id, req.body);
      res.json({ message: 'Training program updated successfully', trainingProgram });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update training program', details: error.message });
    }
  },

  async deleteTrainingProgram(req, res) {
    try {
      const { id } = req.params;
      await trainingProgramService.deleteTrainingProgram(id);
      res.json({ message: 'Training program deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete training program', details: error.message });
    }
  },
};

