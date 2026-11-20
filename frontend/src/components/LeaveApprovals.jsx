import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Building2,
  X,
  User,
  Mail,
  Calendar,
  FileText,
  Eye,
  Paperclip,
  ExternalLink,
  Download,
  FileUp,
  Send
} from 'lucide-react';
import { updateLeaveRequestStatus, requestLeaveProof } from '../api';

// Opens a Base64 Data URL reliably in a new browser tab via Blob URL
const openDataUrlInNewTab = async (dataUrl) => {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank', 'noopener,noreferrer');
  } catch (err) {
    window.open(dataUrl, '_blank', 'noopener,noreferrer');
  }
};

export default function LeaveApprovals({ currentUser, leaveRequests, onRefresh, onShowDialog }) {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [submittingId, setSubmittingId] = useState(null);

  // Proof Request Modal state
  const [proofModalRequest, setProofModalRequest] = useState(null);
  const [proofNote, setProofNote] = useState('');
  const [sendingProofRequest, setSendingProofRequest] = useState(false);

  const isAdminOrHR = ['ADMIN', 'HR'].includes(currentUser.role);

  const visibleRequests = leaveRequests.filter((req) => {
    if (isAdminOrHR) return true;
    return req.employee?.dept === currentUser.dept;
  });

  const canApproveRequest = (req) => {
    if (!req || req.status !== 'PENDING') return false;
    if (currentUser.role === 'ADMIN') return true;
    if (
      currentUser.role === 'MANAGER' &&
      req.employee?.dept === currentUser.dept &&
      ['SUPERVISOR', 'EMPLOYEE'].includes(req.employee?.role)
    ) {
      return true;
    }
    if (
      currentUser.role === 'SUPERVISOR' &&
      req.employee?.dept === currentUser.dept &&
      req.employee?.role === 'EMPLOYEE'
    ) {
      return true;
    }
    return false;
  };

  const handleDecision = async (reqId, status, e) => {
    if (e) e.stopPropagation();
    setSubmittingId(reqId);
    try {
      const res = await updateLeaveRequestStatus(reqId, {
        status,
        approverName: currentUser.name,
        approverRole: currentUser.role,
        approverDept: currentUser.dept
      });

      if (res.error) {
        if (onShowDialog) {
          onShowDialog({
            type: 'error',
            title: 'Action Denied',
            message: res.error
          });
        }
      } else {
        if (selectedRequest && selectedRequest.id === reqId) {
          setSelectedRequest(res);
        }
        if (onShowDialog) {
          onShowDialog({
            type: 'success',
            title: status === 'APPROVED' ? 'Leave Request Approved' : 'Leave Request Rejected',
            message: `Leave request ${status.toLowerCase()}! HR has been notified.`
          });
        }
        onRefresh();
      }
    } catch (err) {
      if (onShowDialog) {
        onShowDialog({
          type: 'error',
          title: 'Update Failed',
          message: 'Failed to update request status.'
        });
      }
    } finally {
      setSubmittingId(null);
    }
  };

  const openProofRequestModal = (req, e) => {
    if (e) e.stopPropagation();
    setProofModalRequest(req);
    setProofNote(req.proofRequestNote || '');
  };

  const closeProofRequestModal = () => {
    setProofModalRequest(null);
    setProofNote('');
  };

  const handleSendProofRequest = async (e) => {
    e.preventDefault();
    if (!proofModalRequest) return;

    setSendingProofRequest(true);
    try {
      const res = await requestLeaveProof(proofModalRequest.id, {
        approverName: currentUser.name,
        approverRole: currentUser.role,
        approverDept: currentUser.dept,
        proofRequestNote: proofNote.trim() || null
      });

      if (res.error) {
        if (onShowDialog) {
          onShowDialog({
            type: 'error',
            title: 'Proof Request Denied',
            message: res.error
          });
        }
      } else {
        if (selectedRequest && selectedRequest.id === proofModalRequest.id) {
          setSelectedRequest(res);
        }
        const targetName = proofModalRequest.employee?.name || 'the employee';
        closeProofRequestModal();
        if (onShowDialog) {
          onShowDialog({
            type: 'success',
            title: 'Proof Request Sent',
            message: `A supporting evidence request has been sent to ${targetName}. They can now upload proof directly in their portal.`
          });
        }
        onRefresh();
      }
    } catch (err) {
      if (onShowDialog) {
        onShowDialog({
          type: 'error',
          title: 'Request Failed',
          message: 'Unable to send proof request. Please try again.'
        });
      }
    } finally {
      setSendingProofRequest(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return `${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const formatLeaveDateRange = (req) => {
    if (!req.startDate) return null;
    if (!req.endDate || req.startDate === req.endDate) return req.startDate;
    return `${req.startDate} → ${req.endDate}`;
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
          {isAdminOrHR ? 'All Company Leave Requests & Approvals' : `${currentUser.dept} Department Leave Approvals`}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Click on any leave request row to view full employee, supporting evidence, and quota details. Supervisors and Department Managers approve department requests or request supporting proof.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-4 sm:px-5 py-3.5 whitespace-nowrap">Employee</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Dept & Role</th>
                <th className="px-4 py-3.5 whitespace-nowrap">Leave Type & Dates</th>
                <th className="px-4 py-3.5">Reason & Evidence</th>
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
                visibleRequests.map((req) => {
                  const isProofRequested = req.proofStatus === 'REQUESTED' || req.proofRequested;
                  const isProofSubmitted = req.proofStatus === 'SUBMITTED';

                  return (
                    <tr
                      key={req.id}
                      onClick={() => setSelectedRequest(req)}
                      className="hover:bg-sky-50/60 cursor-pointer transition group"
                    >
                      <td className="px-4 sm:px-5 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 group-hover:text-[#1178a4] transition flex items-center gap-1.5">
                          <span>{req.employee?.name}</span>
                          <Eye className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
                        </div>
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
                        {formatLeaveDateRange(req) && (
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {formatLeaveDateRange(req)}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4 text-sm text-slate-600 min-w-[160px] max-w-xs">
                        <div className="truncate">{req.reason}</div>
                        {req.attachmentName && (
                          <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-[#1178a4] border border-sky-200">
                            <Paperclip className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[150px]">{req.attachmentName}</span>
                          </span>
                        )}
                        {isProofRequested && req.proofRequestNote && (
                          <div className="mt-1 text-[11px] text-[#1178a4] font-medium truncate" title={req.proofRequestNote}>
                            Note: {req.proofRequestNote}
                          </div>
                        )}
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
                        <div className="flex flex-col items-center gap-1">
                          {req.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">
                              <Clock className="w-3 h-3 shrink-0" /> Pending
                            </span>
                          )}
                          {req.status === 'APPROVED' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3 shrink-0" /> Approved
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">by {req.approvedBy}</div>
                            </div>
                          )}
                          {req.status === 'REJECTED' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 whitespace-nowrap">
                                <XCircle className="w-3 h-3 shrink-0" /> Rejected
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">by {req.approvedBy}</div>
                            </div>
                          )}

                          {/* Proof Workflow Status Badges */}
                          {isProofRequested && req.status === 'PENDING' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-[#1178a4] border border-sky-200 whitespace-nowrap">
                                <FileUp className="w-3 h-3 shrink-0" /> Proof Requested
                              </span>
                              {req.proofRequestedBy && (
                                <div className="text-[10px] text-slate-400 mt-0.5">by {req.proofRequestedBy}</div>
                              )}
                            </div>
                          )}
                          {isProofSubmitted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 shrink-0" /> Proof Submitted
                            </span>
                          )}
                        </div>
                      </td>

                      <td
                        className="px-4 sm:px-5 py-4 text-center whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canApproveRequest(req) ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={submittingId === req.id}
                              onClick={(e) => handleDecision(req.id, 'APPROVED', e)}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={submittingId === req.id}
                              onClick={(e) => handleDecision(req.id, 'REJECTED', e)}
                              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={submittingId === req.id}
                              onClick={(e) => openProofRequestModal(req, e)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1178a4] hover:bg-[#0e6388] text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                            >
                              <FileUp className="w-3.5 h-3.5 shrink-0" />
                              <span>Request Proof</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {req.status === 'PENDING' ? 'Awaiting Dept Supervisor/Manager' : 'Completed'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== DETAILED LEAVE REQUEST MODAL ==================== */}
      {selectedRequest && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1178a4] px-5 sm:px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    Leave Request Details
                  </h3>
                  <p className="text-[11px] sm:text-xs text-sky-100 mt-0.5">
                    Request #{selectedRequest.id} &bull; Submitted {formatDateTime(selectedRequest.createdAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="text-white/80 hover:text-white p-1 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
              {/* Status & Quota Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Status:</span>
                  {selectedRequest.status === 'PENDING' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5" /> Pending Approval
                    </span>
                  )}
                  {selectedRequest.status === 'APPROVED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                    </span>
                  )}
                  {selectedRequest.status === 'REJECTED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 whitespace-nowrap">
                      <XCircle className="w-3.5 h-3.5" /> Rejected
                    </span>
                  )}
                  {(selectedRequest.proofStatus === 'REQUESTED' || selectedRequest.proofRequested) &&
                    selectedRequest.status === 'PENDING' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-100 text-[#1178a4] border border-sky-200 whitespace-nowrap">
                        <FileUp className="w-3.5 h-3.5" /> Proof Requested
                      </span>
                    )}
                  {selectedRequest.proofStatus === 'SUBMITTED' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Proof Submitted
                    </span>
                  )}
                </div>

                <div>
                  {selectedRequest.exceedsQuota ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                      <AlertTriangle className="w-3.5 h-3.5" /> Exceeds Quota by {selectedRequest.exceededBy}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                      Within Allowed Quota
                    </span>
                  )}
                </div>
              </div>

              {/* Proof Request Status Details Banner */}
              {(selectedRequest.proofStatus === 'REQUESTED' || selectedRequest.proofRequested) && (
                <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-slate-700 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#1178a4] flex items-center gap-1.5">
                      <FileUp className="w-4 h-4 shrink-0" /> Supporting Proof Requested
                    </span>
                    {selectedRequest.proofRequestedBy && (
                      <span className="text-[11px] font-medium text-slate-500">
                        by {selectedRequest.proofRequestedBy}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    {selectedRequest.proofRequestNote
                      ? selectedRequest.proofRequestNote
                      : 'Reviewer requested supporting documentation for this leave application.'}
                  </p>
                </div>
              )}

              {/* Employee Information Section */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Staff Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-slate-200 bg-white">
                  <div className="flex items-start gap-2.5">
                    <User className="w-4 h-4 text-[#1178a4] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Full Name & ID</div>
                      <div className="text-sm font-bold text-slate-900">
                        {selectedRequest.employee?.name}
                      </div>
                      <div className="text-xs font-medium text-slate-500">
                        {selectedRequest.employeeId}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-[#1178a4] mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs text-slate-500">Department & Role</div>
                      <div className="text-sm font-bold text-slate-900">
                        {selectedRequest.employee?.dept}
                      </div>
                      <span className="inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-bold uppercase bg-sky-50 text-[#1178a4] border border-sky-200">
                        {selectedRequest.employee?.role}
                      </span>
                    </div>
                  </div>

                  {selectedRequest.employee?.email && (
                    <div className="flex items-start gap-2.5 sm:col-span-2 pt-2 border-t border-slate-100">
                      <Mail className="w-4 h-4 text-[#1178a4] mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs text-slate-500">Email Address</div>
                        <div className="text-xs font-semibold text-slate-800 break-all">
                          {selectedRequest.employee.email}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Leave Application Breakdown */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Leave Application Details
                </h4>
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-500">Leave Category</div>
                      <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#1178a4] shrink-0" />
                        <span>{selectedRequest.leaveType}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Requested Duration</div>
                      <div className="text-sm font-extrabold text-[#1178a4] mt-0.5">
                        {selectedRequest.days} {selectedRequest.leaveType === 'Short Leave' ? 'Short Leave(s)' : 'Day(s)'}
                      </div>
                    </div>
                  </div>

                  {selectedRequest.startDate && (
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/80">
                      <div>
                        <div className="text-xs text-slate-500">Start Date</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedRequest.startDate}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">End Date</div>
                        <div className="text-sm font-bold text-[#1178a4] mt-0.5">
                          {selectedRequest.endDate || selectedRequest.startDate}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-200/80">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                      Reason / Note Provided
                    </div>
                    <p className="text-sm text-slate-800 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed break-words">
                      {selectedRequest.reason || 'No reason provided.'}
                    </p>
                  </div>

                  {selectedRequest.approvedBy && (
                    <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Reviewed By:</span>
                      <span className="font-bold text-slate-800">{selectedRequest.approvedBy}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Supporting Evidence Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Supporting Evidence
                  </h4>
                  {selectedRequest.proofStatus === 'SUBMITTED' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                      <CheckCircle2 className="w-3 h-3 shrink-0" /> Proof Submitted
                    </span>
                  )}
                </div>
                {selectedRequest.attachmentName && selectedRequest.attachmentData ? (
                  <div className="p-3.5 rounded-xl border border-sky-200 bg-sky-50/50 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-[#1178a4] text-white flex items-center justify-center shrink-0">
                          <Paperclip className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[240px]">
                            {selectedRequest.attachmentName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {selectedRequest.proofStatus === 'SUBMITTED'
                              ? 'Uploaded by employee in response to proof request'
                              : 'Attached by employee'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openDataUrlInNewTab(selectedRequest.attachmentData)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-[#1178a4] border border-sky-200 rounded-lg text-xs font-semibold shadow-sm transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> View
                        </button>
                        <a
                          href={selectedRequest.attachmentData}
                          download={selectedRequest.attachmentName}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#1178a4] hover:bg-[#0e6388] text-white rounded-lg text-xs font-semibold shadow-sm transition"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </a>
                      </div>
                    </div>

                    {/* Inline Preview if Supporting Evidence is an Image */}
                    {selectedRequest.attachmentData.startsWith('data:image/') && (
                      <div className="pt-2 border-t border-sky-200/70">
                        <img
                          src={selectedRequest.attachmentData}
                          alt={selectedRequest.attachmentName}
                          className="max-h-48 w-auto mx-auto rounded-lg border border-slate-200 object-contain bg-white"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 italic">
                    No supporting evidence was attached to this request.
                  </div>
                )}
              </div>

              {/* Employee Current Leave Balances */}
              {selectedRequest.employee && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Current Leave Balances
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] font-semibold text-slate-500">Remaining Annual</div>
                      <div className="text-base font-extrabold text-slate-900 mt-0.5">
                        {selectedRequest.employee.remainingAnnual ?? '-'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] font-semibold text-slate-500">Remaining Casual</div>
                      <div className="text-base font-extrabold text-slate-900 mt-0.5">
                        {selectedRequest.employee.remainingCasual ?? '-'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl border border-slate-200 bg-white">
                      <div className="text-[11px] font-semibold text-slate-500">Short Leaves</div>
                      <div className="text-base font-extrabold text-[#1178a4] mt-0.5">
                        {selectedRequest.employee.shortLeavesTaken ?? 0} / 2
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer / Decision Controls */}
              <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedRequest(null)}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition"
                >
                  Close
                </button>

                {canApproveRequest(selectedRequest) && (
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={submittingId === selectedRequest.id}
                      onClick={(e) => openProofRequestModal(selectedRequest, e)}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-[#1178a4] hover:bg-[#0e6388] text-white rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      <FileUp className="w-4 h-4 shrink-0" />
                      <span>Request Proof</span>
                    </button>
                    <button
                      type="button"
                      disabled={submittingId === selectedRequest.id}
                      onClick={(e) => handleDecision(selectedRequest.id, 'REJECTED', e)}
                      className="flex-1 sm:flex-initial px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={submittingId === selectedRequest.id}
                      onClick={(e) => handleDecision(selectedRequest.id, 'APPROVED', e)}
                      className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== REQUEST PROOF MODAL ==================== */}
      {proofModalRequest && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-3 sm:p-4"
          onClick={closeProofRequestModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Frontier Advisory Cerulean Modal Header */}
            <div className="bg-[#1178a4] px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">
                    Request Supporting Proof
                  </h3>
                  <p className="text-[11px] text-sky-100 mt-0.5">
                    {proofModalRequest.employee?.name} &bull; {proofModalRequest.leaveType}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeProofRequestModal}
                className="text-white/80 hover:text-white p-1 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendProofRequest} className="p-5 sm:p-6 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">
                  {proofModalRequest.leaveType} ({proofModalRequest.days}{' '}
                  {proofModalRequest.leaveType === 'Short Leave' ? 'Count' : 'Days'})
                </div>
                {formatLeaveDateRange(proofModalRequest) && (
                  <div>Dates: {formatLeaveDateRange(proofModalRequest)}</div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1.5">
                  Instructions / Note for Employee{' '}
                  <span className="text-[10px] font-normal text-slate-400 normal-case">(Optional)</span>
                </label>
                <textarea
                  rows="3"
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="e.g., Please attach your medical certificate or supporting document for verification."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-[#1178a4] focus:outline-none resize-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={closeProofRequestModal}
                  disabled={sendingProofRequest}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingProofRequest}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1178a4] hover:bg-[#0e6388] text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>{sendingProofRequest ? 'Sending...' : 'Send Proof Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
