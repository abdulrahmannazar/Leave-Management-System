import React from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';

export default function DialogModal({ dialog, onClose }) {
  if (!dialog) return null;

  const isError = dialog.type === 'error';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div
          className={`${
            isError ? 'bg-red-600' : 'bg-[#1178a4]'
          } p-4 sm:p-5 text-white flex items-center justify-between`}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              {isError ? (
                <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg leading-tight">
                {dialog.title || (isError ? 'Action Failed' : 'Notification')}
              </h3>
              <p className="text-[11px] sm:text-xs text-white/80 mt-0.5">
                Leave Management System
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-white/80 hover:text-white p-1 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          <p className="text-sm text-slate-700 leading-relaxed font-medium">
            {dialog.message}
          </p>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className={`w-full sm:w-auto px-6 py-2.5 sm:py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition ${
                isError
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-[#1178a4] hover:bg-[#0e6388]'
              }`}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}