import { payrollRecordService } from '../services/payrollRecordService.js';

export const payrollRecordController = {
  async createPayrollRecord(req, res) {
    try {
      const payrollRecord = await payrollRecordService.createPayrollRecord(req.body);
      res.status(201).json({ message: 'Payroll record created successfully', payrollRecord });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create payroll record', details: error.message });
    }
  },

  async getPayrollRecord(req, res) {
    try {
      const { id } = req.params;
      const payrollRecord = await payrollRecordService.getPayrollRecord(id);
      if (!payrollRecord) return res.status(404).json({ error: 'Payroll record not found' });
      res.json(payrollRecord);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payroll record', details: error.message });
    }
  },

  async updatePayrollRecord(req, res) {
    try {
      const { id } = req.params;
      const payrollRecord = await payrollRecordService.updatePayrollRecord(id, req.body);
      res.json({ message: 'Payroll record updated successfully', payrollRecord });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update payroll record', details: error.message });
    }
  },

  async deletePayrollRecord(req, res) {
    try {
      const { id } = req.params;
      await payrollRecordService.deletePayrollRecord(id);
      res.json({ message: 'Payroll record deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete payroll record', details: error.message });
    }
  },
};
