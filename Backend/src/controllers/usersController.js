// controllers/usersController.js
import { userService } from '../services/userService.js';
import { Request, Response } from 'express';

export const userController = {
  async createUser(req, res) {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json({ message: 'User created successfully', user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create user', details: error.message });
    }
  },

  async getUser(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.getUser(id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user', details: error.message });
    }
  },

  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const user = await userService.updateUser(id, req.body);
      res.json({ message: 'User updated successfully', user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.params;
      await userService.deleteUser(id);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user', details: error.message });
    }
  },
};
