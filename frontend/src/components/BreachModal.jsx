import React from 'react';
import { AlertOctagon, Mail, X } from 'lucide-react';

export default function BreachModal({ breachData, onClose }) {
  if (!breachData) return null;

  const { employee, leaveType, requestedDays, remaining, exceededBy, reason } = breachData;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-red-200 w-full max-w-lg overflow-hidden">
        <div className="bg-red-600 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Leave Quota Exceeded Alert!</h3>
              <p className="text-xs text-red-100">HR & Administration have been notified via Email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>{employee.name}</strong> ({employee.dept}) requested <strong>{requestedDays}</strong> of{' '}
            <strong>{leaveType}</strong>, with only <strong>{remaining}</strong> remaining.
            This exceeds the policy limit by <strong className="text-red-600">{exceededBy}</strong>.
          </p>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs bg-slate-50">
            <div className="bg-slate-200/70 px-4 py-2 font-mono font-semibold text-slate-700 border-b border-slate-200 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5" /> Automated Notification Sent to HR
            </div>
            <div className="p-4 space-y-1.5 font-mono text-slate-600">
              <div><strong>Employee:</strong> {employee.name} ({employee.id})</div>
              <div><strong>Department:</strong> {employee.dept}</div>
              <div className="text-red-600 font-bold"><strong>Exceeded By:</strong> {exceededBy}</div>
              <div><strong>Reason:</strong> {reason || 'None'}</div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}