import { jobPostingService } from '../services/jobPostingService.js';

export const jobPostingController = {
  async createJobPosting(req, res) {
    try {
      const jobPosting = await jobPostingService.createJobPosting(req.body);
      res.status(201).json({ message: 'Job posting created successfully', jobPosting });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create job posting', details: error.message });
    }
  },

  async getJobPosting(req, res) {
    try {
      const { id } = req.params;
      const jobPosting = await jobPostingService.getJobPosting(id);
      if (!jobPosting) return res.status(404).json({ error: 'Job posting not found' });
      res.json(jobPosting);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch job posting', details: error.message });
    }
  },

  async updateJobPosting(req, res) {
    try {
      const { id } = req.params;
      const jobPosting = await jobPostingService.updateJobPosting(id, req.body);
      res.json({ message: 'Job posting updated successfully', jobPosting });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update job posting', details: error.message });
    }
  },

  async deleteJobPosting(req, res) {
    try {
      const { id } = req.params;
      await jobPostingService.deleteJobPosting(id);
      res.json({ message: 'Job posting deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete job posting', details: error.message });
    }
  },
};

