// backend/notification.js
const nodemailer = require('nodemailer');

// Create a reusable transporter using your real SMTP configuration
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '465', 10),
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Sends a real email notification to HR and Admin when an employee exceeds their leave quota.
 */
const sendLeaveBreachEmail = async ({ employee, leaveType, requestedDays, currentRemaining, exceededBy, reason }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ SMTP credentials (EMAIL_USER / EMAIL_PASS) not configured in .env. Skipping real email dispatch.');
    return { simulated: true };
  }

  const hrEmail = process.env.HR_NOTIFICATION_EMAIL || 'hr@company.com';
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@company.com';

  const mailOptions = {
    from: `"LeaveCore System" <${process.env.EMAIL_USER}>`,
    to: `${hrEmail}, ${adminEmail}`,
    subject: `🚨 URGENT: Leave Quota Exceeded by ${employee.name} (${employee.id})`,
    text: `Hello HR & Administration,

Quota Breach Alert:
- Employee: ${employee.name} (${employee.id}) - ${employee.dept}
- Leave Category: ${leaveType}
- Days Requested: ${requestedDays}
- Remaining Balance: ${currentRemaining}
- Quota Exceeded By: ${exceededBy} days
- Reason: ${reason || 'None provided'}

Action Required: An automated popup notification has been triggered on the management portal for review.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Real breach email successfully sent to HR & Admin:', info.messageId);
    return info;
  } catch (error) {
    console.error('❌ Failed to send real breach email via SMTP:', error);
    throw error;
  }
};

module.exports = { sendLeaveBreachEmail };