
import { departmentService } from '../services/departmentService.js';

export const departmentController = {
  async createDepartment(req, res) {
    try {
      const department = await departmentService.createDepartment(req.body);
      res.status(201).json({ message: 'Department created successfully', department });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create department', details: error.message });
    }
  },

  async getDepartment(req, res) {
    try {
      const { id } = req.params;
      const department = await departmentService.getDepartment(id);
      if (!department) return res.status(404).json({ error: 'Department not found' });
      res.json(department);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch department', details: error.message });
    }
  },

  async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const department = await departmentService.updateDepartment(id, req.body);
      res.json({ message: 'Department updated successfully', department });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update department', details: error.message });
    }
  },

  async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      await departmentService.deleteDepartment(id);
      res.json({ message: 'Department deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete department', details: error.message });
    }
  },
};

