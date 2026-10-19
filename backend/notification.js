// backend/notification.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendLeaveNotificationEmail = async ({
  eventType, // 'LEAVE_REQUESTED' | 'LEAVE_APPROVED'
  employee,
  leaveType,
  requestedDays,
  currentRemaining,
  exceedsQuota,
  exceededBy,
  reason,
  approvedBy
}) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY not configured. Skipping email dispatch.');
    return { success: false, reason: 'API key missing' };
  }

  const hrEmail = process.env.HR_NOTIFICATION_EMAIL;
  if (!hrEmail) {
    console.error('❌ HR_NOTIFICATION_EMAIL is not set in environment variables.');
    return { success: false, reason: 'Recipient email missing' };
  }

  const isBreach = exceedsQuota && exceededBy > 0;
  const subjectPrefix = isBreach ? '🚨 URGENT QUOTA EXCEEDED:' : '📋 Leave Notification:';
  const actionLabel = eventType === 'LEAVE_APPROVED' ? `Approved by ${approvedBy}` : 'New Leave Requested';

  try {
    const { data, error } = await resend.emails.send({
      from: 'leaveManagementSystem <onboarding@resend.dev>',
      to: [hrEmail],
      subject: `${subjectPrefix} ${employee.name} (${employee.dept}) - ${actionLabel}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; border: 1px solid ${isBreach ? '#dc2626' : '#cbd5e1'}; border-radius: 8px;">
          <h2 style="color: ${isBreach ? '#dc2626' : '#4f46e5'}; margin-top: 0;">
            ${isBreach ? '🚨 Leave Quota Exceeded Alert' : '📋 Leave Taken / Action Notification for HR'}
          </h2>
          <p>
            <strong>Status:</strong> ${actionLabel}<br/>
            Please review and manually adjust the employee's remaining leave count in the HR Records Table.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr><td style="padding: 8px; font-weight: bold; width: 170px;">Employee:</td><td>${employee.name} (${employee.id})</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Department & Role:</td><td>${employee.dept} (${employee.role})</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Leave Category:</td><td>${leaveType}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Days / Count Taken:</td><td>${requestedDays}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Current Remaining:</td><td>${currentRemaining}</td></tr>
            ${isBreach ? `<tr><td style="padding: 8px; font-weight: bold; color: #dc2626;">Exceeded Quota By:</td><td style="color: #dc2626; font-weight: bold;">${exceededBy}</td></tr>` : ''}
            <tr><td style="padding: 8px; font-weight: bold;">Reason:</td><td>${reason || 'None provided'}</td></tr>
          </table>
        </div>
      `
    });

    if (error) {
      console.error('❌ Resend API Error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ HR Notification email dispatched! ID:', data.id);
    return { success: true, id: data.id };
  } catch (err) {
    console.error('❌ Unexpected email error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = { sendLeaveNotificationEmail };