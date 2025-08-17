import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

// Get environment variable with logging
const getEnvVariable = (key, defaultValue) => {
  const value = process.env[key];
  if (!value) {
    logger.warn(`Environment variable ${key} not set, using default: ${defaultValue}`);
    return defaultValue;
  }
  return value;
};

// Create email transporter
const createTransporter = () => {
  const config = {
    host: getEnvVariable('SMTP_HOST', 'localhost'),
    port: parseInt(getEnvVariable('SMTP_PORT', '587')),
    secure: getEnvVariable('SMTP_SECURE', 'false') === 'true',
    auth: {
      user: getEnvVariable('SMTP_USER', ''),
      pass: getEnvVariable('SMTP_PASS', '')
    }
  };

  return nodemailer.createTransporter(config);
};

// Email templates
const emailTemplates = {
  leaveRequestSubmitted: (data) => ({
    subject: `Leave Request Submitted - ${data.employeeName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Leave Request Submitted</h2>
        <p>A new leave request has been submitted:</p>
        <ul>
          <li><strong>Employee:</strong> ${data.employeeName}</li>
          <li><strong>Leave Type:</strong> ${data.leaveType}</li>
          <li><strong>Start Date:</strong> ${data.startDate}</li>
          <li><strong>End Date:</strong> ${data.endDate}</li>
          <li><strong>Days:</strong> ${data.days}</li>
          <li><strong>Reason:</strong> ${data.reason}</li>
        </ul>
        <p>Please review and approve/reject this request in the HRMS system.</p>
      </div>
    `
  }),

  leaveRequestApproved: (data) => ({
    subject: `Leave Request Approved`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">Leave Request Approved</h2>
        <p>Your leave request has been approved:</p>
        <ul>
          <li><strong>Leave Type:</strong> ${data.leaveType}</li>
          <li><strong>Start Date:</strong> ${data.startDate}</li>
          <li><strong>End Date:</strong> ${data.endDate}</li>
          <li><strong>Days:</strong> ${data.days}</li>
          <li><strong>Approved By:</strong> ${data.approvedBy}</li>
        </ul>
        ${data.comments ? `<p><strong>Comments:</strong> ${data.comments}</p>` : ''}
        <p>Enjoy your time off!</p>
      </div>
    `
  }),

  leaveRequestRejected: (data) => ({
    subject: `Leave Request Rejected`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ef4444;">Leave Request Rejected</h2>
        <p>Unfortunately, your leave request has been rejected:</p>
        <ul>
          <li><strong>Leave Type:</strong> ${data.leaveType}</li>
          <li><strong>Start Date:</strong> ${data.startDate}</li>
          <li><strong>End Date:</strong> ${data.endDate}</li>
          <li><strong>Days:</strong> ${data.days}</li>
        </ul>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
        <p>Please contact HR if you have any questions.</p>
      </div>
    `
  }),

  newEmployeeWelcome: (data) => ({
    subject: `Welcome to ${data.companyName}!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Welcome to ${data.companyName}!</h2>
        <p>Dear ${data.employeeName},</p>
        <p>We're excited to welcome you to our team! Here are your account details:</p>
        <ul>
          <li><strong>Employee ID:</strong> ${data.employeeId}</li>
          <li><strong>Start Date:</strong> ${data.startDate}</li>
          <li><strong>Department:</strong> ${data.department}</li>
          <li><strong>Position:</strong> ${data.position}</li>
        </ul>
        <p>Your manager ${data.managerName} will be in touch with you soon.</p>
        <p>We look forward to working with you!</p>
        <p>Best regards,<br>HR Team</p>
      </div>
    `
  }),

  interviewScheduled: (data) => ({
    subject: `Interview Scheduled - ${data.position}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3b82f6;">Interview Scheduled</h2>
        <p>Dear ${data.candidateName},</p>
        <p>We're pleased to inform you that an interview has been scheduled for the position of ${data.position}.</p>
        <ul>
          <li><strong>Date & Time:</strong> ${data.scheduledAt}</li>
          <li><strong>Duration:</strong> ${data.duration} minutes</li>
          <li><strong>Type:</strong> ${data.type}</li>
          <li><strong>Location:</strong> ${data.location}</li>
          ${data.interviewers ? `<li><strong>Interviewers:</strong> ${data.interviewers.join(', ')}</li>` : ''}
        </ul>
        <p>Please confirm your attendance and let us know if you have any questions.</p>
        <p>Best regards,<br>Recruitment Team</p>
      </div>
    `
  }),

  payrollProcessed: (data) => ({
    subject: `Payroll Processed - ${data.payPeriod}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;">Payroll Processed</h2>
        <p>Dear ${data.employeeName},</p>
        <p>Your payroll for ${data.payPeriod} has been processed:</p>
        <ul>
          <li><strong>Gross Pay:</strong> ${data.grossPay}</li>
          <li><strong>Deductions:</strong> ${data.deductions}</li>
          <li><strong>Net Pay:</strong> ${data.netPay}</li>
          <li><strong>Pay Date:</strong> ${data.payDate}</li>
        </ul>
        <p>Your payslip is available in the HRMS system.</p>
        <p>Best regards,<br>Payroll Team</p>
      </div>
    `
  })
};

// Email service class
class EmailService {
  constructor() {
    this.transporter = null;
    this.isEnabled = getEnvVariable('EMAIL_ENABLED', 'false') === 'true';
    
    if (this.isEnabled) {
      this.initializeTransporter();
    }
  }

  async initializeTransporter() {
    try {
      this.transporter = createTransporter();
      
      // Verify connection
      await this.transporter.verify();
      logger.info('Email service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.isEnabled = false;
    }
  }

  async sendEmail({ to, subject, html, attachments = [] }) {
    if (!this.isEnabled) {
      logger.warn('Email service is disabled, skipping email send');
      return { success: false, message: 'Email service disabled' };
    }

    if (!this.transporter) {
      logger.error('Email transporter not initialized');
      return { success: false, message: 'Email service not available' };
    }

    try {
      const mailOptions = {
        from: getEnvVariable('SMTP_FROM', 'noreply@company.com'),
        to,
        subject,
        html,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { to, subject, messageId: result.messageId });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendLeaveRequestNotification(leaveRequest, type = 'submitted') {
    const template = emailTemplates[`leaveRequest${type.charAt(0).toUpperCase() + type.slice(1)}`];
    if (!template) {
      logger.error('Email template not found:', `leaveRequest${type}`);
      return { success: false, message: 'Template not found' };
    }

    const templateData = {
      employeeName: `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
      leaveType: leaveRequest.policy.name,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      days: leaveRequest.days,
      reason: leaveRequest.reason,
      approvedBy: leaveRequest.approvedBy ? 
        `${leaveRequest.approvedBy.firstName} ${leaveRequest.approvedBy.lastName}` : null,
      comments: leaveRequest.approverComments
    };

    const { subject, html } = template(templateData);
    
    // Determine recipient based on type
    let to;
    if (type === 'submitted') {
      // Send to manager and HR
      to = [leaveRequest.employee.manager?.email, 'hr@company.com'].filter(Boolean);
    } else {
      // Send to employee
      to = leaveRequest.employee.email;
    }

    return this.sendEmail({ to, subject, html });
  }

  async sendWelcomeEmail(employee) {
    const templateData = {
      employeeName: `${employee.firstName} ${employee.lastName}`,
      employeeId: employee.employeeId,
      startDate: employee.hireDate,
      department: employee.department?.name || 'N/A',
      position: employee.position?.title || 'N/A',
      managerName: employee.manager ? 
        `${employee.manager.firstName} ${employee.manager.lastName}` : 'N/A',
      companyName: getEnvVariable('COMPANY_NAME', 'Company')
    };

    const { subject, html } = emailTemplates.newEmployeeWelcome(templateData);
    
    return this.sendEmail({
      to: employee.email,
      subject,
      html
    });
  }

  async sendInterviewNotification(interview) {
    const templateData = {
      candidateName: `${interview.application.firstName} ${interview.application.lastName}`,
      position: interview.application.jobPosting.title,
      scheduledAt: interview.scheduledAt,
      duration: interview.duration,
      type: interview.type || 'Interview',
      location: interview.location || 'TBD',
      interviewers: interview.interviewers || []
    };

    const { subject, html } = emailTemplates.interviewScheduled(templateData);
    
    return this.sendEmail({
      to: interview.application.email,
      subject,
      html
    });
  }

  async sendPayrollNotification(payrollRecord) {
    const templateData = {
      employeeName: `${payrollRecord.employee.firstName} ${payrollRecord.employee.lastName}`,
      payPeriod: `${payrollRecord.payPeriodStart} - ${payrollRecord.payPeriodEnd}`,
      grossPay: payrollRecord.baseSalary + payrollRecord.overtime + payrollRecord.bonuses + payrollRecord.allowances,
      deductions: payrollRecord.deductions + payrollRecord.tax,
      netPay: payrollRecord.netPay,
      payDate: payrollRecord.paidAt || 'TBD'
    };

    const { subject, html } = emailTemplates.payrollProcessed(templateData);
    
    return this.sendEmail({
      to: payrollRecord.employee.email,
      subject,
      html
    });
  }

  async sendBulkEmail(recipients, subject, html) {
    const results = [];
    
    for (const recipient of recipients) {
      const result = await this.sendEmail({
        to: recipient,
        subject,
        html
      });
      results.push({ recipient, ...result });
    }
    
    return results;
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;
export { EmailService };