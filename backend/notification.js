// backend/notification.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '465', 10),
  secure: (process.env.EMAIL_PORT || '465') === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 8000, // 8 second timeout to avoid hanging Render
  greetingTimeout: 8000,
  socketTimeout: 10000
});

const sendLeaveBreachEmail = async ({ employee, leaveType, requestedDays, currentRemaining, exceededBy, reason }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ EMAIL_USER or EMAIL_PASS not configured in environment. Skipping email dispatch.');
    return { success: false, reason: 'SMTP credentials missing' };
  }

  const hrEmail = process.env.HR_NOTIFICATION_EMAIL || process.env.EMAIL_USER;
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || hrEmail;

  const mailOptions = {
    from: `"LeaveCore Alert" <${process.env.EMAIL_USER}>`,
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

An automated popup notification has also been triggered on the management portal.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Breach email sent to HR & Admin:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ SMTP dispatch failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendLeaveBreachEmail };