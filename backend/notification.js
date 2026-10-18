// backend/notification.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendLeaveBreachEmail = async ({ employee, leaveType, requestedDays, currentRemaining, exceededBy, reason }) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not configured. Skipping email dispatch.');
    return { success: false, reason: 'API key missing' };
  }

  // Set the destination email to your target inbox
  const hrEmail = process.env.HR_NOTIFICATION_EMAIL || 'your-email@gmail.com';
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || hrEmail;

  try {
    const data = await resend.emails.send({
      from: 'LeaveCore System <onboarding@resend.dev>', // Free default sending address provided by Resend
      to: [hrEmail],
      subject: `🚨 URGENT: Leave Quota Exceeded by ${employee.name} (${employee.id})`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #dc2626;">🚨 Leave Quota Breach Notification</h2>
          <p>An employee has submitted a leave request that exceeds their remaining balance:</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr><td style="padding: 8px; font-weight: bold; width: 180px;">Employee:</td><td>${employee.name} (${employee.id}) - ${employee.dept}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Leave Category:</td><td>${leaveType}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Days Requested:</td><td>${requestedDays} days</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Remaining Balance:</td><td>${currentRemaining} days</td></tr>
            <tr><td style="padding: 8px; font-weight: bold; color: #dc2626;">Exceeded Quota By:</td><td style="color: #dc2626; font-weight: bold;">${exceededBy} days</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Reason / Note:</td><td>${reason || 'None provided'}</td></tr>
          </table>
          <p style="margin-top: 20px; font-size: 13px; color: #666;">
            This automated email was triggered alongside a high-priority dashboard popup modal.
          </p>
        </div>
      `
    });

    console.log('✅ Breach email dispatched via Resend HTTPS API. ID:', data.id);
    return { success: true, id: data.id };
  } catch (error) {
    console.error('❌ Resend API dispatch failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { sendLeaveBreachEmail };