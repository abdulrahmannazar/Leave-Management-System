import React from 'react';
import { AlertOctagon, Mail } from 'lucide-react';
import { forceApproveLeave } from '../api';

export default function BreachModal({ breachData, onClose, onRefresh }) {
  if (!breachData) return null;
  const { employee, leaveType, requestedDays, remaining, exceededBy, reason } = breachData;

  const handleForceApprove = async () => {
    await forceApproveLeave(employee.id, { type: leaveType, days: requestedDays });
    alert('Approved as exceeded exception.');
    onRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden border border-red-200">
        <div className="bg-red-500 p-5 text-white flex items-center gap-3">
          <AlertOctagon className="w-6 h-6" />
          <h3 className="font-bold text-lg">Leave Limit Exceeded!</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700">
            <strong>{employee.name}</strong> requested <strong>{requestedDays} days</strong> of <strong>{leaveType}</strong>, but only has <strong>{remaining} days</strong> remaining.
            Exceeds by <strong className="text-red-600">{exceededBy} days</strong>.
          </p>
          <div className="border rounded-xl text-xs bg-slate-50">
            <div className="bg-slate-200/70 px-4 py-2 font-mono flex items-center gap-2 font-semibold text-slate-700"><Mail className="w-3.5 h-3.5" /> Email Log Sent</div>
            <div className="p-4 font-mono text-slate-600">
              <div><strong>To:</strong> hr@company.com, admin@company.com</div>
              <div className="text-red-600 font-bold mt-1">Subject: 🚨 URGENT: Quota Exceeded by {employee.name}</div>
              <div className="mt-2 text-slate-700">Reason: {reason}</div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-slate-50">Dismiss / Reject</button>
            <button onClick={handleForceApprove} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700">Approve Overdraft</button>
          </div>
        </div>
      </div>
    </div>
  );
}