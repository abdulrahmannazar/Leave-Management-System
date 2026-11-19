// backend/notification.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const createTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

const sendLeaveNotificationEmail = async ({
  eventType, // 'LEAVE_REQUESTED' | 'LEAVE_APPROVED'
  employee,
  leaveType,
  requestedDays,
  startDate,
  endDate,
  currentRemaining,
  exceedsQuota,
  exceededBy,
  reason,
  approvedBy
}) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email credentials (EMAIL_USER / EMAIL_PASS) not configured. Skipping email dispatch.');
    return { success: false, reason: 'Email credentials missing' };
  }

  const hrEmail = process.env.HR_NOTIFICATION_EMAIL;
  if (!hrEmail) {
    console.error('❌ HR_NOTIFICATION_EMAIL is not set in environment variables.');
    return { success: false, reason: 'Recipient email missing' };
  }

  const isBreach = exceedsQuota && exceededBy > 0;
  const subjectPrefix = isBreach ? '🚨 URGENT QUOTA EXCEEDED:' : '📋 Leave Notification:';
  const actionLabel = eventType === 'LEAVE_APPROVED' ? `Approved by ${approvedBy}` : 'New Leave Requested';
  const dateRangeText = startDate
    ? (endDate && endDate !== startDate ? `${startDate} to ${endDate}` : startDate)
    : 'Not specified';

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: `"Leave Management System" <${process.env.EMAIL_USER}>`,
      to: hrEmail,
      subject: `${subjectPrefix} ${employee.name} (${employee.dept}) - ${actionLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid ${isBreach ? '#dc2626' : '#cbd5e1'}; border-radius: 8px;">
          <h2 style="color: ${isBreach ? '#dc2626' : '#1178a4'}; margin-top: 0;">
            ${isBreach ? '🚨 Leave Quota Exceeded Alert' : '📋 Leave Taken / Action Notification for HR'}
          </h2>
          <p>
            <strong>Status:</strong> ${actionLabel}<br/>
            Please review and manually adjust the employee's remaining leave count in the Staff Records table.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr><td style="padding: 8px; font-weight: bold; width: 170px;">Employee:</td><td>${employee.name} (${employee.id})</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Department & Role:</td><td>${employee.dept} (${employee.role})</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Leave Category:</td><td>${leaveType}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Leave Dates:</td><td>${dateRangeText}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Days / Count Taken:</td><td>${requestedDays}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Current Remaining:</td><td>${currentRemaining}</td></tr>
            ${isBreach ? `<tr><td style="padding: 8px; font-weight: bold; color: #dc2626;">Exceeded Quota By:</td><td style="color: #dc2626; font-weight: bold;">${exceededBy}</td></tr>` : ''}
            <tr><td style="padding: 8px; font-weight: bold;">Reason:</td><td>${reason || 'None provided'}</td></tr>
          </table>
        </div>
      `
    });

    console.log('✅ HR Notification email dispatched! ID:', info.messageId);
    return { success: true, id: info.messageId };
  } catch (err) {
    console.error('❌ Unexpected email error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendLeaveNotificationEmail };
