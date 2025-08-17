import { auditLogService } from '../services/auditLogService.js';

export const auditLogController = {
  async createAuditLog(req, res) {
    try {
      const auditLog = await auditLogService.createAuditLog({
        ...req.body,
        userId: req.user?.id,
      });
      res.status(201).json({ message: 'Audit log created successfully', auditLog });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create audit log', details: error.message });
    }
  },

  async getAuditLog(req, res) {
    try {
      const { id } = req.params;
      const auditLog = await auditLogService.getAuditLog(id);
      if (!auditLog) return res.status(404).json({ error: 'Audit log not found' });
      res.json(auditLog);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit log', details: error.message });
    }
  },
};
