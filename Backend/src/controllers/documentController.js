import { documentService } from '../services/documentService.js';

export const documentController = {
  async createDocument(req, res) {
    try {
      const document = await documentService.createDocument({
        ...req.body,
        uploadedById: req.user?.id,
      });
      res.status(201).json({ message: 'Document created successfully', document });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create document', details: error.message });
    }
  },

  async getDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await documentService.getDocument(id);
      if (!document) return res.status(404).json({ error: 'Document not found' });
      res.json(document);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch document', details: error.message });
    }
  },

  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const document = await documentService.updateDocument(id, req.body);
      res.json({ message: 'Document updated successfully', document });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update document', details: error.message });
    }
  },

  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      await documentService.deleteDocument(id);
      res.json({ message: 'Document deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete document', details: error.message });
    }
  },
};
