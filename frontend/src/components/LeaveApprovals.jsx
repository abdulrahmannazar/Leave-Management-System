import React from 'react';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Building2 } from 'lucide-react';
import { updateLeaveRequestStatus } from '../api';

export default function LeaveApprovals({ currentUser, leaveRequests, onRefresh }) {
  const isAdminOrHR = ['ADMIN', 'HR'].includes(currentUser.role);

  const visibleRequests = leaveRequests.filter((req) => {
    if (isAdminOrHR) return true;
    return req.employee?.dept === currentUser.dept;
  });

  const canApproveRequest = (req) => {
    if (req.status !== 'PENDING') return false;
    if (currentUser.role === 'ADMIN') return true;
    if (currentUser.role === 'MANAGER' && req.employee?.dept === currentUser.dept && ['SUPERVISOR', 'EMPLOYEE'].includes(req.employee?.role)) {
      return true;
    }
    if (currentUser.role === 'SUPERVISOR' && req.employee?.dept === currentUser.dept && req.employee?.role === 'EMPLOYEE') {
      return true;
    }
    return false;
  };

  const handleDecision = async (reqId, status) => {
    try {
      const res = await updateLeaveRequestStatus(reqId, {
        status,
        approverName: currentUser.name,
        approverRole: currentUser.role,
        approverDept: currentUser.dept
      });
      if (res.error) {
        alert(res.error);
      } else {
        alert(`Leave request ${status.toLowerCase()}! HR has been notified.`);
        onRefresh();
      }
    } catch (err) {
      alert('Failed to update request status');
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          {isAdminOrHR ? 'All Company Leave Requests & Approvals' : `${currentUser.dept} Department Leave Approvals`}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Supervisors and Department Managers approve department leave requests. HR and Admin view all requests across departments.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[780px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-4 sm:px-5 py-3.5 whitespace-nowrap">Employee</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Dept & Role</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Leave Type & Days</th>
                <th className="px-4 py-3.5">Reason</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">Quota Check</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">Status</th>
                <th className="px-4 sm:px-5 py-3.5 text-center whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-8 text-sm text-slate-500">
                    No leave requests found.
                  </td>
                </tr>
              ) : (
                visibleRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 sm:px-5 py-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{req.employee?.name}</div>
                      <div className="text-xs text-slate-500">{req.employeeId}</div>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-xs font-bold text-slate-700 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 shrink-0" /> {req.employee?.dept}
                      </div>
                      <span className="text-[11px] text-slate-500 uppercase">{req.employee?.role}</span>
                    </td>

                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="font-semibold text-sm text-slate-900">{req.leaveType}</div>
                      <div className="text-xs font-bold text-[#1178a4]">
                        {req.days} {req.leaveType === 'Short Leave' ? 'Count' : 'Days'}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-sm text-slate-600 min-w-[160px] max-w-xs break-words">
                      {req.reason}
                    </td>

                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      {req.exceedsQuota ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Exceeds by {req.exceededBy}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Within Quota
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      {req.status === 'PENDING' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          <Clock className="w-3 h-3 shrink-0" /> Pending
                        </span>
                      )}
                      {req.status === 'APPROVED' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 shrink-0" /> Approved
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">by {req.approvedBy}</div>
                        </div>
                      )}
                      {req.status === 'REJECTED' && (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                            <XCircle className="w-3 h-3 shrink-0" /> Rejected
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5">by {req.approvedBy}</div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 sm:px-5 py-4 text-center whitespace-nowrap">
                      {canApproveRequest(req) ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleDecision(req.id, 'APPROVED')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecision(req.id, 'REJECTED')}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">
                          {req.status === 'PENDING' ? 'Awaiting Dept Supervisor/Manager' : 'Completed'}
                        </span>
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