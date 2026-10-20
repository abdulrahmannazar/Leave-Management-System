import React, { useState } from 'react';
import { Calendar, Sun, Clock, CheckCircle2, XCircle, AlertTriangle, Building2 } from 'lucide-react';
import { markAttendance, requestLeave } from '../api';

export default function EmployeePortal({
  currentUser,
  employees,
  leaveRequests = [],
  onRefresh,
  onBreachDetected
}) {
  const currentEmp = employees.find((e) => e.id === currentUser.id) || currentUser;
  const [leaveType, setLeaveType] = useState('annual');
  const [days, setDays] = useState('1');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const myLeaveRequests = leaveRequests.filter((req) => req.employeeId === currentEmp.id);

  const handleAttendance = async () => {
    try {
      const res = await markAttendance(currentEmp.id);
      if (res.error) alert(res.error);
      onRefresh();
    } catch (err) {
      alert('Error marking attendance: ' + err.message);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    const reqDays = parseFloat(days);
    if (!reqDays || reqDays <= 0) return alert('Enter a valid amount');

    setLoading(true);
    try {
      const res = await requestLeave(currentEmp.id, { type: leaveType, days: reqDays, reason });

      if (res.error) {
        alert('Error: ' + res.error);
        return;
      }

      if (res.exceeded) {
        onBreachDetected(res);
      } else {
        alert('Leave request submitted! You can track its approval status below.');
      }
      setDays('1');
      setReason('');
      onRefresh();
    } catch (err) {
      alert('Network Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const remainingShortLeavesThisMonth = Math.max(0, 2 - (currentEmp.shortLeavesTaken || 0));

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6">
      {/* User Info & Attendance Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900">{currentEmp.name}</h2>
          <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
            <Building2 className="w-3.5 h-3.5 shrink-0" />
            <span>{currentEmp.dept} Department &bull; {currentEmp.role} ({currentEmp.id})</span>
          </p>
        </div>

        {currentEmp.presentToday ? (
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs sm:text-sm font-semibold border border-emerald-200 w-full sm:w-auto">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Marked Present Today ({currentEmp.presentTime})
          </div>
        ) : (
          <button
            onClick={handleAttendance}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition shadow-md shadow-emerald-100 w-full sm:w-auto"
          >
            <Clock className="w-4 h-4 shrink-0" /> Click If Present Today
          </button>
        )}
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
            <span>Annual Leaves</span>
            <span className="bg-sky-50 text-[#1178a4] p-2 rounded-lg"><Calendar className="w-4 h-4"/></span>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
            {currentEmp.remainingAnnual} <span className="text-sm text-slate-500 font-medium">remaining</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Out of {currentEmp.allowedAnnual} allowed days</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
            <span>Casual Leaves</span>
            <span className="bg-amber-50 text-amber-600 p-2 rounded-lg"><Sun className="w-4 h-4"/></span>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
            {currentEmp.remainingCasual} <span className="text-sm text-slate-500 font-medium">remaining</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Out of {currentEmp.allowedCasual} allowed days</div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200 sm:col-span-2 md:col-span-1">
          <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
            <span>Short Leaves (This Month)</span>
            <span className="bg-slate-100 text-slate-600 p-2 rounded-lg"><Clock className="w-4 h-4"/></span>
          </div>
          <div className="mt-3 text-2xl sm:text-3xl font-bold text-[#1178a4]">
            {currentEmp.shortLeavesTaken ?? 0} / 2 <span className="text-sm text-slate-500 font-medium">taken</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {remainingShortLeavesThisMonth} remaining this month
          </div>
        </div>
      </div>

      {/* Apply for Leave Form */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">Apply for Leave</h3>
        <p className="text-xs text-slate-500 mb-4">
          Your request will be sent to your Department Supervisor/Manager for approval and notified to HR.
        </p>
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              >
                <option value="annual">Annual Leave</option>
                <option value="casual">Casual Leave</option>
                <option value="short">Short Leave (Max 2 / month)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                {leaveType === 'short' ? 'Short Leaves Count' : 'Days Requested'}
              </label>
              <input
                type="number"
                min={leaveType === 'short' ? '1' : '0.5'}
                step={leaveType === 'short' ? '1' : '0.5'}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Reason / Note</label>
            <input
              type="text"
              placeholder="Reason for leave request"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-[#1178a4] hover:bg-[#0e6388] text-white font-semibold rounded-lg text-sm transition shadow-sm disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Leave Request'}
          </button>
        </form>
      </div>

      {/* My Leave Request Status History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">My Leave Requests & Status</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track whether your submitted leave requests are Pending, Approved, or Rejected.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-4 sm:px-5 py-3 whitespace-nowrap">Date</th>
                <th className="px-4 sm:px-5 py-3 whitespace-nowrap">Leave Category</th>
                <th className="px-4 sm:px-5 py-3 whitespace-nowrap">Days / Count</th>
                <th className="px-4 sm:px-5 py-3">Reason</th>
                <th className="px-4 sm:px-5 py-3 text-center whitespace-nowrap">Quota Status</th>
                <th className="px-4 sm:px-5 py-3 text-center whitespace-nowrap">Approval Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {myLeaveRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-sm text-slate-400">
                    You have not submitted any leave requests yet.
                  </td>
                </tr>
              ) : (
                myLeaveRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 sm:px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 font-semibold text-sm text-slate-900 whitespace-nowrap">
                      {req.leaveType}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-sm font-bold text-[#1178a4] whitespace-nowrap">
                      {req.days} {req.leaveType === 'Short Leave' ? 'Count' : 'Days'}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-sm text-slate-600 min-w-[140px] max-w-xs break-words">
                      {req.reason}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-center whitespace-nowrap">
                      {req.exceedsQuota ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                          <AlertTriangle className="w-3 h-3 shrink-0" /> Exceeds by {req.exceededBy}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                          Within Quota
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-5 py-3.5 text-center whitespace-nowrap">
                      {req.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 shrink-0" /> Pending Approval
                        </span>
                      )}
                      {req.status === 'APPROVED' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> Approved
                          </span>
                          {req.approvedBy && (
                            <div className="text-[10px] text-slate-400 mt-0.5">by {req.approvedBy}</div>
                          )}
                        </div>
                      )}
                      {req.status === 'REJECTED' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 shrink-0" /> Rejected
                          </span>
                          {req.approvedBy && (
                            <div className="text-[10px] text-slate-400 mt-0.5">by {req.approvedBy}</div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}