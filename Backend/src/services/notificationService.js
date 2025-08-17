import emailService from './emailService.js';
import logger from '../utils/logger.js';
import prisma from '../config/prisma.js';

class NotificationService {
  constructor() {
    this.emailService = emailService;
  }

  // Leave request notifications
  async notifyLeaveRequestSubmitted(leaveRequestId) {
    try {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: {
          employee: {
            include: {
              manager: { select: { email: true, firstName: true, lastName: true } }
            }
          },
          policy: { select: { name: true, leaveType: true } }
        }
      });

      if (!leaveRequest) {
        logger.error('Leave request not found for notification', { leaveRequestId });
        return;
      }

      // Send notification to manager and HR
      const recipients = [];
      if (leaveRequest.employee.manager?.email) {
        recipients.push(leaveRequest.employee.manager.email);
      }
      
      // Add HR emails (you might want to get these from settings)
      const hrUsers = await prisma.user.findMany({
        where: { role: 'HR', isActive: true },
        select: { email: true }
      });
      recipients.push(...hrUsers.map(user => user.email));

      await this.emailService.sendLeaveRequestNotification(leaveRequest, 'submitted');
      
      logger.info('Leave request submission notification sent', { 
        leaveRequestId, 
        recipients: recipients.length 
      });
    } catch (error) {
      logger.error('Failed to send leave request notification:', error);
    }
  }

  async notifyLeaveRequestStatusUpdate(leaveRequestId, status) {
    try {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: {
          employee: { select: { email: true, firstName: true, lastName: true } },
          policy: { select: { name: true, leaveType: true } },
          approvedBy: { select: { firstName: true, lastName: true } }
        }
      });

      if (!leaveRequest) {
        logger.error('Leave request not found for status notification', { leaveRequestId });
        return;
      }

      await this.emailService.sendLeaveRequestNotification(leaveRequest, status.toLowerCase());
      
      logger.info('Leave request status notification sent', { 
        leaveRequestId, 
        status,
        recipient: leaveRequest.employee.email 
      });
    } catch (error) {
      logger.error('Failed to send leave status notification:', error);
    }
  }

  // Employee onboarding notifications
  async notifyNewEmployeeWelcome(employeeId) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          department: { select: { name: true } },
          position: { select: { title: true } },
          manager: { select: { firstName: true, lastName: true } }
        }
      });

      if (!employee) {
        logger.error('Employee not found for welcome notification', { employeeId });
        return;
      }

      await this.emailService.sendWelcomeEmail(employee);
      
      logger.info('Welcome email sent to new employee', { 
        employeeId, 
        email: employee.email 
      });
    } catch (error) {
      logger.error('Failed to send welcome email:', error);
    }
  }

  // Interview notifications
  async notifyInterviewScheduled(interviewId) {
    try {
      const interview = await prisma.interview.findUnique({
        where: { id: interviewId },
        include: {
          application: {
            include: {
              jobPosting: { select: { title: true } }
            }
          }
        }
      });

      if (!interview) {
        logger.error('Interview not found for notification', { interviewId });
        return;
      }

      await this.emailService.sendInterviewNotification(interview);
      
      logger.info('Interview notification sent', { 
        interviewId, 
        candidate: interview.application.email 
      });
    } catch (error) {
      logger.error('Failed to send interview notification:', error);
    }
  }

  // Payroll notifications
  async notifyPayrollProcessed(payrollRecordId) {
    try {
      const payrollRecord = await prisma.payrollRecord.findUnique({
        where: { id: payrollRecordId },
        include: {
          employee: { select: { email: true, firstName: true, lastName: true } }
        }
      });

      if (!payrollRecord) {
        logger.error('Payroll record not found for notification', { payrollRecordId });
        return;
      }

      await this.emailService.sendPayrollNotification(payrollRecord);
      
      logger.info('Payroll notification sent', { 
        payrollRecordId, 
        employee: payrollRecord.employee.email 
      });
    } catch (error) {
      logger.error('Failed to send payroll notification:', error);
    }
  }

  // Performance review notifications
  async notifyPerformanceReviewDue(employeeId, reviewerId) {
    try {
      const [employee, reviewer] = await Promise.all([
        prisma.employee.findUnique({
          where: { id: employeeId },
          select: { email: true, firstName: true, lastName: true }
        }),
        prisma.employee.findUnique({
          where: { id: reviewerId },
          select: { email: true, firstName: true, lastName: true }
        })
      ]);

      if (!employee || !reviewer) {
        logger.error('Employee or reviewer not found for performance review notification');
        return;
      }

      const subject = 'Performance Review Due';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Performance Review Due</h2>
          <p>Dear ${reviewer.firstName},</p>
          <p>A performance review is due for ${employee.firstName} ${employee.lastName}.</p>
          <p>Please complete the review in the HRMS system.</p>
          <p>Best regards,<br>HR Team</p>
        </div>
      `;

      await this.emailService.sendEmail({
        to: reviewer.email,
        subject,
        html
      });
      
      logger.info('Performance review notification sent', { 
        employeeId, 
        reviewerId 
      });
    } catch (error) {
      logger.error('Failed to send performance review notification:', error);
    }
  }

  // Training notifications
  async notifyTrainingEnrollment(trainingRecordId) {
    try {
      const trainingRecord = await prisma.trainingRecord.findUnique({
        where: { id: trainingRecordId },
        include: {
          employee: { select: { email: true, firstName: true, lastName: true } },
          program: { select: { name: true, description: true, duration: true } }
        }
      });

      if (!trainingRecord) {
        logger.error('Training record not found for notification', { trainingRecordId });
        return;
      }

      const subject = `Training Enrollment - ${trainingRecord.program.name}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3b82f6;">Training Enrollment</h2>
          <p>Dear ${trainingRecord.employee.firstName},</p>
          <p>You have been enrolled in the following training program:</p>
          <ul>
            <li><strong>Program:</strong> ${trainingRecord.program.name}</li>
            ${trainingRecord.program.description ? `<li><strong>Description:</strong> ${trainingRecord.program.description}</li>` : ''}
            ${trainingRecord.program.duration ? `<li><strong>Duration:</strong> ${trainingRecord.program.duration} minutes</li>` : ''}
          </ul>
          <p>Please check the HRMS system for more details and to track your progress.</p>
          <p>Best regards,<br>Training Team</p>
        </div>
      `;

      await this.emailService.sendEmail({
        to: trainingRecord.employee.email,
        subject,
        html
      });
      
      logger.info('Training enrollment notification sent', { trainingRecordId });
    } catch (error) {
      logger.error('Failed to send training enrollment notification:', error);
    }
  }

  // System notifications
  async notifySystemMaintenance(message, scheduledTime) {
    try {
      const activeUsers = await prisma.user.findMany({
        where: { isActive: true },
        select: { email: true }
      });

      const subject = 'Scheduled System Maintenance';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f59e0b;">Scheduled System Maintenance</h2>
          <p>Dear Team,</p>
          <p>We have scheduled system maintenance:</p>
          <p><strong>Scheduled Time:</strong> ${scheduledTime}</p>
          <p><strong>Details:</strong> ${message}</p>
          <p>The system may be temporarily unavailable during this time.</p>
          <p>Thank you for your understanding.</p>
          <p>Best regards,<br>IT Team</p>
        </div>
      `;

      const recipients = activeUsers.map(user => user.email);
      await this.emailService.sendBulkEmail(recipients, subject, html);
      
      logger.info('System maintenance notification sent', { 
        recipients: recipients.length 
      });
    } catch (error) {
      logger.error('Failed to send system maintenance notification:', error);
    }
  }

  // Birthday notifications
  async sendBirthdayNotifications() {
    try {
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDate = today.getDate();

      const birthdayEmployees = await prisma.employee.findMany({
        where: {
          employmentStatus: 'ACTIVE',
          dateOfBirth: {
            not: null
          }
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          dateOfBirth: true,
          manager: { select: { email: true } }
        }
      });

      const todayBirthdays = birthdayEmployees.filter(emp => {
        const birthDate = new Date(emp.dateOfBirth);
        return birthDate.getMonth() + 1 === todayMonth && birthDate.getDate() === todayDate;
      });

      for (const employee of todayBirthdays) {
        const subject = `Happy Birthday ${employee.firstName}!`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">🎉 Happy Birthday!</h2>
            <p>Dear ${employee.firstName},</p>
            <p>Wishing you a very happy birthday and a wonderful year ahead!</p>
            <p>Thank you for being a valuable part of our team.</p>
            <p>Best wishes,<br>The Team</p>
          </div>
        `;

        await this.emailService.sendEmail({
          to: employee.email,
          subject,
          html
        });
      }

      if (todayBirthdays.length > 0) {
        logger.info('Birthday notifications sent', { count: todayBirthdays.length });
      }
    } catch (error) {
      logger.error('Failed to send birthday notifications:', error);
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

export default notificationService;
export { NotificationService };