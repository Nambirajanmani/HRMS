import { attendanceService } from '../services/attendanceService.js';

export const attendanceController = {
  async createAttendance(req, res) {
    try {
      const attendance = await attendanceService.createAttendance(req.body);
      res.status(201).json({ message: 'Attendance created successfully', attendance });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create attendance', details: error.message });
    }
  },

  async getAttendance(req, res) {
    try {
      const { id } = req.params;
      const attendance = await attendanceService.getAttendance(id);
      if (!attendance) return res.status(404).json({ error: 'Attendance not found' });
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch attendance', details: error.message });
    }
  },

  async updateAttendance(req, res) {
    try {
      const { id } = req.params;
      const attendance = await attendanceService.updateAttendance(id, req.body);
      res.json({ message: 'Attendance updated successfully', attendance });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update attendance', details: error.message });
    }
  },

  async deleteAttendance(req, res) {
    try {
      const { id } = req.params;
      await attendanceService.deleteAttendance(id);
      res.json({ message: 'Attendance deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete attendance', details: error.message });
    }
  },
};

