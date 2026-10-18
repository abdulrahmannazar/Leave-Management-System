// backend/notification.js
const nodemailer = require('nodemailer');

let transporter;

// Initialize test email account
nodemailer.createTestAccount().then((account) => {
  transporter = nodemailer.createTransport({
    host: account.smtp.host,
    port: account.smtp.port,
    secure: account.smtp.secure,
    auth: { user: account.user, pass: account.pass }
  });
  console.log('📧 Notification Mailer Service is active');
});

/**
 * Sends an email notification to HR and Admin when an employee exceeds their leave quota.
 */
const sendLeaveBreachEmail = async ({ employee, leaveType, requestedDays, currentRemaining, exceededBy, reason }) => {
  if (!transporter) {
    console.warn('⚠️ Mailer transporter not yet ready.');
    return;
  }

  const mailOptions = {
    from: '"LeaveCore Alert System" <no-reply@company.com>',
    to: 'hr@company.com, admin@company.com',
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
    console.log('✅ Breach email dispatched! Preview URL:', nodemailer.getTestMessageUrl(info));
    return info;
  } catch (error) {
    console.error('❌ Failed to dispatch breach email:', error);
  }
};

module.exports = { sendLeaveBreachEmail };