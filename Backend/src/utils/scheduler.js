import cron from 'node-cron';
import notificationService from '../services/notificationService.js';
import logger from './logger.js';
import prisma from '../config/prisma.js';

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) {
      logger.warn('Scheduler already initialized');
      return;
    }

    try {
      this.setupCronJobs();
      this.isInitialized = true;
      logger.info('Scheduler service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize scheduler service:', error);
    }
  }

  setupCronJobs() {
    // Daily birthday notifications (9 AM)
    this.scheduleJob('birthday-notifications', '0 9 * * *', async () => {
      logger.info('Running birthday notifications job');
      await notificationService.sendBirthdayNotifications();
    });

    // Daily leave balance updates (midnight)
    this.scheduleJob('leave-balance-update', '0 0 * * *', async () => {
      logger.info('Running leave balance update job');
      await this.updateLeaveBalances();
    });

    // Weekly performance review reminders (Monday 9 AM)
    this.scheduleJob('performance-review-reminders', '0 9 * * 1', async () => {
      logger.info('Running performance review reminders job');
      await this.sendPerformanceReviewReminders();
    });

    // Monthly payroll reminders (1st of month, 9 AM)
    this.scheduleJob('payroll-reminders', '0 9 1 * *', async () => {
      logger.info('Running payroll reminders job');
      await this.sendPayrollReminders();
    });

    // Daily attendance summary (6 PM)
    this.scheduleJob('attendance-summary', '0 18 * * *', async () => {
      logger.info('Running attendance summary job');
      await this.generateAttendanceSummary();
    });

    // Cleanup old audit logs (weekly, Sunday 2 AM)
    this.scheduleJob('cleanup-audit-logs', '0 2 * * 0', async () => {
      logger.info('Running audit log cleanup job');
      await this.cleanupOldAuditLogs();
    });
  }

  scheduleJob(name, cronExpression, task) {
    try {
      const job = cron.schedule(cronExpression, async () => {
        try {
          await task();
        } catch (error) {
          logger.error(`Scheduled job ${name} failed:`, error);
        }
      }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'America/New_York'
      });

      this.jobs.set(name, job);
      logger.info(`Scheduled job: ${name} with cron: ${cronExpression}`);
    } catch (error) {
      logger.error(`Failed to schedule job ${name}:`, error);
    }
  }

  async updateLeaveBalances() {
    try {
      const currentYear = new Date().getFullYear();
      
      // Get all active employees
      const employees = await prisma.employee.findMany({
        where: { employmentStatus: 'ACTIVE' },
        select: { id: true }
      });

      // Get all active leave policies
      const policies = await prisma.leavePolicy.findMany({
        where: { isActive: true }
      });

      let balancesCreated = 0;

      for (const employee of employees) {
        for (const policy of policies) {
          // Check if balance exists for current year
          const existingBalance = await prisma.leaveBalance.findFirst({
            where: {
              employeeId: employee.id,
              policyId: policy.id,
              year: currentYear
            }
          });

          if (!existingBalance) {
            // Create new balance for the year
            await prisma.leaveBalance.create({
              data: {
                employeeId: employee.id,
                policyId: policy.id,
                year: currentYear,
                allocated: policy.daysAllowed,
                used: 0,
                remaining: policy.daysAllowed,
                carryForward: 0
              }
            });
            balancesCreated++;
          }
        }
      }

      logger.info('Leave balances updated', { balancesCreated });
    } catch (error) {
      logger.error('Failed to update leave balances:', error);
    }
  }

  async sendPerformanceReviewReminders() {
    try {
      // Find overdue performance reviews
      const overdueReviews = await prisma.performanceReview.findMany({
        where: {
          status: 'draft',
          reviewPeriodEnd: {
            lt: new Date()
          }
        },
        include: {
          employee: { select: { firstName: true, lastName: true } },
          reviewer: { select: { email: true, firstName: true, lastName: true } }
        }
      });

      for (const review of overdueReviews) {
        await notificationService.notifyPerformanceReviewDue(
          review.employeeId,
          review.reviewerId
        );
      }

      logger.info('Performance review reminders sent', { count: overdueReviews.length });
    } catch (error) {
      logger.error('Failed to send performance review reminders:', error);
    }
  }

  async sendPayrollReminders() {
    try {
      // Get HR users
      const hrUsers = await prisma.user.findMany({
        where: { role: 'HR', isActive: true },
        select: { email: true }
      });

      const subject = 'Monthly Payroll Processing Reminder';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Payroll Processing Reminder</h2>
          <p>This is a reminder that monthly payroll processing is due.</p>
          <p>Please ensure all timesheets are approved and payroll is processed on time.</p>
          <p>Best regards,<br>HRMS System</p>
        </div>
      `;

      const recipients = hrUsers.map(user => user.email);
      await emailService.sendBulkEmail(recipients, subject, html);

      logger.info('Payroll reminders sent', { recipients: recipients.length });
    } catch (error) {
      logger.error('Failed to send payroll reminders:', error);
    }
  }

  async generateAttendanceSummary() {
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Get yesterday's attendance
      const attendanceRecords = await prisma.attendance.findMany({
        where: {
          date: {
            gte: yesterday,
            lt: today
          }
        },
        include: {
          employee: {
            select: { firstName: true, lastName: true, department: { select: { name: true } } }
          }
        }
      });

      const summary = {
        total: attendanceRecords.length,
        present: attendanceRecords.filter(r => r.status === 'PRESENT').length,
        absent: attendanceRecords.filter(r => r.status === 'ABSENT').length,
        late: attendanceRecords.filter(r => r.status === 'LATE').length,
        workFromHome: attendanceRecords.filter(r => r.status === 'WORK_FROM_HOME').length
      };

      // Send summary to HR
      const hrUsers = await prisma.user.findMany({
        where: { role: 'HR', isActive: true },
        select: { email: true }
      });

      const subject = `Daily Attendance Summary - ${yesterday.toDateString()}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Daily Attendance Summary</h2>
          <p>Attendance summary for ${yesterday.toDateString()}:</p>
          <ul>
            <li><strong>Total Records:</strong> ${summary.total}</li>
            <li><strong>Present:</strong> ${summary.present}</li>
            <li><strong>Absent:</strong> ${summary.absent}</li>
            <li><strong>Late:</strong> ${summary.late}</li>
            <li><strong>Work from Home:</strong> ${summary.workFromHome}</li>
          </ul>
          <p>View detailed reports in the HRMS system.</p>
        </div>
      `;

      const recipients = hrUsers.map(user => user.email);
      await emailService.sendBulkEmail(recipients, subject, html);

      logger.info('Attendance summary sent', { 
        date: yesterday.toDateString(),
        summary 
      });
    } catch (error) {
      logger.error('Failed to generate attendance summary:', error);
    }
  }

  async cleanupOldAuditLogs() {
    try {
      const retentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS || '90');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      logger.info('Old audit logs cleaned up', { 
        deletedCount: result.count,
        cutoffDate: cutoffDate.toISOString()
      });
    } catch (error) {
      logger.error('Failed to cleanup old audit logs:', error);
    }
  }

  stopJob(name) {
    const job = this.jobs.get(name);
    if (job) {
      job.stop();
      this.jobs.delete(name);
      logger.info(`Stopped scheduled job: ${name}`);
    }
  }

  stopAllJobs() {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`Stopped scheduled job: ${name}`);
    }
    this.jobs.clear();
    logger.info('All scheduled jobs stopped');
  }

  getJobStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running || false,
        scheduled: true
      };
    }
    return status;
  }
}

// Create singleton instance
const schedulerService = new SchedulerService();

export default schedulerService;
export { SchedulerService };