// backend/notification.js
const nodemailer = require('nodemailer');

// Use the built-in 'gmail' service driver rather than manual ports
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '' // strips any accidental spaces
  }
});

// Verify connection configuration on startup
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Gmail SMTP Verification Failed:', error.message);
    } else {
      console.log('✅ Gmail SMTP Server is ready to send notifications');
    }
  });
} else {
  console.warn('⚠️ EMAIL_USER or EMAIL_PASS not set. Emails will be skipped.');
}

const sendLeaveBreachEmail = async ({ employee, leaveType, requestedDays, currentRemaining, exceededBy, reason }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ SMTP credentials not found. Skipping email dispatch.');
    return { success: false, reason: 'Credentials missing' };
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
    console.log('✅ Breach email sent successfully to:', hrEmail, adminEmail, 'ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ SMTP dispatch failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendLeaveBreachEmail };