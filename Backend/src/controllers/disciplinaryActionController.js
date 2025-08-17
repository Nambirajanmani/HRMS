import { disciplinaryActionService } from '../services/disciplinaryActionService.js';

export const disciplinaryActionController = {
  async createDisciplinaryAction(req, res) {
    try {
      const disciplinaryAction = await disciplinaryActionService.createDisciplinaryAction({
        ...req.body,
        issuedById: req.user?.id,
      });
      res.status(201).json({ message: 'Disciplinary action created successfully', disciplinaryAction });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create disciplinary action', details: error.message });
    }
  },

  async getDisciplinaryAction(req, res) {
    try {
      const { id } = req.params;
      const disciplinaryAction = await disciplinaryActionService.getDisciplinaryAction(id);
      if (!disciplinaryAction) return res.status(404).json({ error: 'Disciplinary action not found' });
      res.json(disciplinaryAction);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch disciplinary action', details: error.message });
    }
  },

  async updateDisciplinaryAction(req, res) {
    try {
      const { id } = req.params;
      const disciplinaryAction = await disciplinaryActionService.updateDisciplinaryAction(id, req.body);
      res.json({ message: 'Disciplinary action updated successfully', disciplinaryAction });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update disciplinary action', details: error.message });
    }
  },

  async deleteDisciplinaryAction(req, res) {
    try {
      const { id } = req.params;
      await disciplinaryActionService.deleteDisciplinaryAction(id);
      res.json({ message: 'Disciplinary action deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete disciplinary action', details: error.message });
    }
  },
};

