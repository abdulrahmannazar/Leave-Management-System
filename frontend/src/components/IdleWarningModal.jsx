import React from 'react';
import { Clock, LogOut, RefreshCw } from 'lucide-react';

export default function IdleWarningModal({
  isOpen,
  remainingSeconds,
  onStaySignedIn,
  onLogoutNow
}) {
  if (!isOpen) return null;

  const progressPercent = Math.min(100, Math.max(0, (remainingSeconds / 60) * 100));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-[#1178a4] p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                Session Inactivity Warning
              </h3>
              <p className="text-[11px] sm:text-xs text-white/80 mt-0.5">
                Security &bull; Automatic Idle Timeout
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-white/20 text-white border border-white/30 tabular-nums">
            {remainingSeconds}s
          </span>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm text-slate-700 leading-relaxed font-medium">
            You have been inactive for 29 minutes. For your account security, you will be automatically logged out in{' '}
            <span className="font-extrabold text-red-600 tabular-nums">
              {remainingSeconds} {remainingSeconds === 1 ? 'second' : 'seconds'}
            </span>{' '}
            due to inactivity.
          </p>

          {/* Countdown Progress Bar */}
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-500 ${
                remainingSeconds <= 15 ? 'bg-red-600' : 'bg-[#1178a4]'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-xs text-slate-500">
            Click <strong>Stay Signed In</strong> to continue your session, or <strong>Log Out Now</strong> to end your session immediately.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-2">
            <button
              type="button"
              onClick={onLogoutNow}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 border border-slate-300 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg text-sm font-semibold transition"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Log Out Now</span>
            </button>
            <button
              type="button"
              onClick={onStaySignedIn}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 sm:py-2 bg-[#1178a4] hover:bg-[#0e6388] text-white rounded-lg text-sm font-semibold shadow-sm transition"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>Stay Signed In</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
