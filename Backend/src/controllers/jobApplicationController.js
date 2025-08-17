import { jobApplicationService } from '../services/jobApplicationService.js';

export const jobApplicationController = {
  async createJobApplication(req, res) {
    try {
      const jobApplication = await jobApplicationService.createJobApplication(req.body);
      res.status(201).json({ message: 'Job application created successfully', jobApplication });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create job application', details: error.message });
    }
  },

  async getJobApplication(req, res) {
    try {
      const { id } = req.params;
      const jobApplication = await jobApplicationService.getJobApplication(id);
      if (!jobApplication) return res.status(404).json({ error: 'Job application not found' });
      res.json(jobApplication);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch job application', details: error.message });
    }
  },

  async updateJobApplication(req, res) {
    try {
      const { id } = req.params;
      const jobApplication = await jobApplicationService.updateJobApplication(id, req.body);
      res.json({ message: 'Job application updated successfully', jobApplication });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update job application', details: error.message });
    }
  },

  async deleteJobApplication(req, res) {
    try {
      const { id } = req.params;
      await jobApplicationService.deleteJobApplication(id);
      res.json({ message: 'Job application deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete job application', details: error.message });
    }
  },
};

