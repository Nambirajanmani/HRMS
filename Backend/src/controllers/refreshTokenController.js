
import { refreshTokenService } from '../services/refreshTokenService.js';

export const refreshTokenController = {
  async createRefreshToken(req, res) {
    try {
      const refreshToken = await refreshTokenService.createRefreshToken(req.body);
      res.status(201).json({ message: 'Refresh token created successfully', refreshToken });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create refresh token', details: error.message });
    }
  },

  async getRefreshToken(req, res) {
    try {
      const { id } = req.params;
      const refreshToken = await refreshTokenService.getRefreshToken(id);
      if (!refreshToken) return res.status(404).json({ error: 'Refresh token not found' });
      res.json(refreshToken);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch refresh token', details: error.message });
    }
  },

  async deleteRefreshToken(req, res) {
    try {
      const { id } = req.params;
      await refreshTokenService.deleteRefreshToken(id);
      res.json({ message: 'Refresh token deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete refresh token', details: error.message });
    }
  },
};

