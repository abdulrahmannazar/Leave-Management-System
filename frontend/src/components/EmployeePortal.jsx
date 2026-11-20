import React, { useState, useMemo, useRef } from 'react';
import {
  Calendar,
  Sun,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Building2,
  Paperclip,
  UploadCloud,
  X,
  FileText,
  FileUp
} from 'lucide-react';
import { markAttendance, requestLeave, uploadLeaveProof } from '../api';

// Returns YYYY-MM-DD in Asia/Colombo local time
const getLocalToday = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
};

// Inclusive weekday-only End Date calculator (excludes Saturdays & Sundays)
const computeEndDate = (startDateStr, daysValue, leaveCategory) => {
  if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) return '';
  if (leaveCategory === 'short') return startDateStr;

  const parsed = parseFloat(daysValue);
  if (isNaN(parsed) || parsed <= 0) return startDateStr;

  const totalDays = Math.max(1, Math.ceil(parsed));
  const [year, month, day] = startDateStr.split('-').map(Number);
  const current = new Date(Date.UTC(year, month - 1, day));

  // If start date falls on a weekend, start counting from the next Monday
  while (current.getUTCDay() === 0 || current.getUTCDay() === 6) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  let remaining = totalDays - 1;
  if (remaining >= 5) {
    const fullWeeks = Math.floor(remaining / 5);
    current.setUTCDate(current.getUTCDate() + fullWeeks * 7);
    remaining = remaining % 5;
  }

  while (remaining > 0) {
    current.setUTCDate(current.getUTCDate() + 1);
    const dow = current.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      remaining -= 1;
    }
  }

  return current.toISOString().split('T')[0];
};

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

const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

export default function EmployeePortal({
  currentUser,
  employees,
  leaveRequests = [],
  onRefresh,
  onBreachDetected,
  onShowDialog
}) {
  const currentEmp = employees.find((e) => e.id === currentUser.id) || currentUser;
  const [leaveType, setLeaveType] = useState('annual');
  const [days, setDays] = useState('1');
  const [startDate, setStartDate] = useState(() => getLocalToday());
  const [reason, setReason] = useState('');
  const [attachment, setAttachment] = useState(null); // { name, size, dataUrl }
  const [loading, setLoading] = useState(false);

  // Proof upload state for existing pending requests
  const [uploadingProofId, setUploadingProofId] = useState(null);
  const [activeProofReqId, setActiveProofReqId] = useState(null);
  const [localProofOverrides, setLocalProofOverrides] = useState({});

  const fileInputRef = useRef(null);
  const proofFileInputRef = useRef(null);

  // Auto-calculate End Date whenever Start Date, Days Requested, or Category changes
  const endDate = useMemo(
    () => computeEndDate(startDate, days, leaveType),
    [startDate, days, leaveType]
  );

  const myLeaveRequests = useMemo(() => {
    return leaveRequests
      .filter((req) => req.employeeId === currentEmp.id)
      .map((req) => (localProofOverrides[req.id] ? { ...req, ...localProofOverrides[req.id] } : req));
  }, [leaveRequests, currentEmp.id, localProofOverrides]);

  const pendingProofRequests = useMemo(() => {
    return myLeaveRequests.filter(
      (req) => req.status === 'PENDING' && (req.proofStatus === 'REQUESTED' || req.proofRequested)
    );
  }, [myLeaveRequests]);

  // Check if the staff member has already submitted a leave request today (Asia/Colombo local day)
  const todayLocalStr = getLocalToday();
  const todaysSubmittedRequest = useMemo(() => {
    return myLeaveRequests.find((req) => {
      if (!req.createdAt) return false;
      const reqCreatedLocal = new Date(req.createdAt).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Colombo'
      });
      return reqCreatedLocal === todayLocalStr;
    });
  }, [myLeaveRequests, todayLocalStr]);
  const hasRequestedToday = Boolean(todaysSubmittedRequest);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return onShowDialog({
        type: 'error',
        title: 'File Too Large',
        message: 'Supporting evidence must be 3 MB or smaller. Please compress the file or upload a smaller copy.'
      });
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        dataUrl: reader.result
      });
    };
    reader.onerror = () => {
      onShowDialog({
        type: 'error',
        title: 'File Read Error',
        message: 'Could not read the selected file. Please try another file.'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerProofUpload = (reqId) => {
    setActiveProofReqId(reqId);
    if (proofFileInputRef.current) {
      proofFileInputRef.current.value = '';
      proofFileInputRef.current.click();
    }
  };

  const handleProofFileChange = (e) => {
    const file = e.target.files?.[0];
    const targetReqId = activeProofReqId;
    if (!file || !targetReqId) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      if (proofFileInputRef.current) proofFileInputRef.current.value = '';
      return onShowDialog({
        type: 'error',
        title: 'File Too Large',
        message: 'Supporting evidence must be 3 MB or smaller. Please compress the file or upload a smaller copy.'
      });
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      setUploadingProofId(targetReqId);
      try {
        const res = await uploadLeaveProof(targetReqId, {
          employeeId: currentEmp.id,
          attachmentName: file.name,
          attachmentData: dataUrl
        });

        if (res.error) {
          onShowDialog({
            type: 'error',
            title: 'Proof Upload Failed',
            message: res.error
          });
          return;
        }

        // Immediately reflect the uploaded document and SUBMITTED status in the UI
        setLocalProofOverrides((prev) => ({
          ...prev,
          [targetReqId]: {
            attachmentName: res.attachmentName || file.name,
            attachmentData: res.attachmentData || dataUrl,
            proofRequested: false,
            proofStatus: 'SUBMITTED'
          }
        }));

        onShowDialog({
          type: 'success',
          title: 'Proof Submitted',
          message: `Supporting document "${file.name}" has been uploaded for your leave request. Your reviewer can now view it.`
        });
        onRefresh();
      } catch (err) {
        onShowDialog({
          type: 'error',
          title: 'Upload Error',
          message: 'Unable to upload supporting proof: ' + err.message
        });
      } finally {
        setUploadingProofId(null);
        setActiveProofReqId(null);
        if (proofFileInputRef.current) proofFileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      onShowDialog({
        type: 'error',
        title: 'File Read Error',
        message: 'Could not read the selected file. Please try another file.'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAttendance = async () => {
    try {
      const res = await markAttendance(currentEmp.id);
      if (res.error) {
        onShowDialog({
          type: 'error',
          title: 'Attendance Notice',
          message: res.error
        });
      }
      onRefresh();
    } catch (err) {
      onShowDialog({
        type: 'error',
        title: 'Attendance Error',
        message: 'Error marking attendance: ' + err.message
      });
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();

    if (hasRequestedToday) {
      return onShowDialog({
        type: 'error',
        title: 'Daily Request Limit Reached',
        message: 'Daily limit reached: You have already submitted a leave request today. Staff can only request leave once per day.'
      });
    }

    const reqDays = parseFloat(days);
    if (!reqDays || reqDays <= 0) {
      return onShowDialog({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter a valid leave amount (at least 0.5 or 1).'
      });
    }

    if (!startDate) {
      return onShowDialog({
        type: 'error',
        title: 'Start Date Required',
        message: 'Please select a valid start date for your leave.'
      });
    }

    setLoading(true);
    try {
      const res = await requestLeave(currentEmp.id, {
        type: leaveType,
        days: reqDays,
        startDate,
        endDate,
        reason,
        attachmentName: attachment ? attachment.name : null,
        attachmentData: attachment ? attachment.dataUrl : null
      });

      if (res.error) {
        onShowDialog({
          type: 'error',
          title: 'Submission Error',
          message: res.error
        });
        return;
      }

      if (res.exceeded) {
        onBreachDetected(res);
      } else {
        onShowDialog({
          type: 'success',
          title: 'Leave Request Submitted',
          message: `Leave request from ${startDate} to ${endDate} submitted! You can track its approval status below.`
        });
      }
      setDays('1');
      setStartDate(getLocalToday());
      setReason('');
      handleRemoveAttachment();
      onRefresh();
    } catch (err) {
      onShowDialog({
        type: 'error',
        title: 'Network Error',
        message: 'Unable to submit request: ' + err.message
      });
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-0.5">Apply for Leave</h3>
            <p className="text-xs text-slate-500">
              Your request will be sent to your Department Supervisor/Manager for approval and notified to HR.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 self-start sm:self-center ${
              hasRequestedToday
                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                : 'bg-sky-50 text-[#1178a4] border border-sky-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>{hasRequestedToday ? '1 / 1 Daily Request Used' : 'Limit: 1 Request / Day'}</span>
          </span>
        </div>

        {hasRequestedToday && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Daily Leave Request Limit Reached:</span> You have already submitted a leave request today ({todaysSubmittedRequest.leaveType} for {todaysSubmittedRequest.startDate || todayLocalStr}). Staff members can only request leave once per day.
            </div>
          </div>
        )}

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

          {/* Start Date & Auto-Calculated End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 sm:py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                End Date <span className="text-[10px] font-medium text-[#1178a4] normal-case">(Auto-calculated &bull; Weekdays only)</span>
              </label>
              <input
                type="date"
                value={endDate}
                readOnly
                className="w-full bg-sky-50/70 border border-sky-200 text-[#1178a4] font-semibold rounded-lg px-3 py-2.5 sm:py-2 text-sm cursor-not-allowed focus:outline-none"
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

          {/* Supporting Evidence / Attachment Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Supporting Evidence <span className="text-[10px] font-normal text-slate-400 normal-case">(Optional &bull; Medical certificate, letter, PDF or image, max 3 MB)</span>
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
              id="leave-evidence-input"
            />

            {!attachment ? (
              <label
                htmlFor="leave-evidence-input"
                className="flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full p-4 border-2 border-dashed border-slate-300 hover:border-[#1178a4] bg-slate-50 hover:bg-sky-50/40 rounded-xl cursor-pointer transition text-center sm:text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-sky-50 text-[#1178a4] flex items-center justify-center shrink-0">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs sm:text-sm font-semibold text-slate-700">
                    Click to attach supporting document
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Supports PDF, JPG, PNG, WebP, DOC, DOCX (Max 3 MB)
                  </div>
                </div>
              </label>
            ) : (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-sky-50/70 border border-sky-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#1178a4] text-white flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                      {attachment.name}
                    </div>
                    <div className="text-[11px] text-[#1178a4] font-medium">
                      {attachment.size} &bull; Ready to upload
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  title="Remove attachment"
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || hasRequestedToday}
            className="w-full py-2.5 bg-[#1178a4] hover:bg-[#0e6388] text-white font-semibold rounded-lg text-sm transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? 'Submitting...'
              : hasRequestedToday
              ? 'Daily Leave Request Limit Reached (1 Per Day)'
              : 'Submit Leave Request'}
          </button>
        </form>
      </div>

      {/* My Leave Request Status History */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Shared Hidden File Input for Uploading Requested Proof */}
        <input
          ref={proofFileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          onChange={handleProofFileChange}
          className="hidden"
        />

        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">My Leave Requests & Status</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Track whether your submitted leave requests are Pending, Approved, or Rejected, and upload requested proof directly.
            </p>
          </div>
          {pendingProofRequests.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-[#1178a4] border border-sky-200 whitespace-nowrap self-start sm:self-center">
              <FileUp className="w-3.5 h-3.5 shrink-0" />
              {pendingProofRequests.length} Proof {pendingProofRequests.length === 1 ? 'Request' : 'Requests'} Pending
            </span>
          )}
        </div>

        {/* Highlighted Proof Requested Banner */}
        {pendingProofRequests.length > 0 && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-slate-700 flex items-start gap-2.5">
            <FileUp className="w-4 h-4 text-[#1178a4] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-[#1178a4]">Action Required — Supporting Proof Requested:</span>{' '}
              Your reviewer has requested supporting documentation for{' '}
              {pendingProofRequests.length === 1 ? 'a pending leave request' : `${pendingProofRequests.length} pending leave requests`}.
              Use the <strong>Upload Proof</strong> button directly on the highlighted row below without submitting a duplicate leave request.
            </div>
          </div>
        )}

        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse min-w-[760px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-4 sm:px-5 py-3 whitespace-nowrap">Leave Dates</th>
                <th className="px-4 sm:px-5 py-3 whitespace-nowrap">Leave Category</th>
                <th className="px-4 sm:px-5 py-3 whitespace-nowrap">Days / Count</th>
                <th className="px-4 sm:px-5 py-3">Reason & Evidence</th>
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
                myLeaveRequests.map((req) => {
                  const isProofRequested =
                    req.status === 'PENDING' && (req.proofStatus === 'REQUESTED' || req.proofRequested);
                  const isProofSubmitted = req.proofStatus === 'SUBMITTED';

                  return (
                    <tr
                      key={req.id}
                      className={`transition ${
                        isProofRequested ? 'bg-sky-50/40 hover:bg-sky-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 sm:px-5 py-3.5 text-xs whitespace-nowrap">
                        {req.startDate ? (
                          <div>
                            <div className="font-semibold text-slate-800">
                              {req.startDate === req.endDate || !req.endDate
                                ? req.startDate
                                : `${req.startDate} → ${req.endDate}`}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Applied {new Date(req.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 font-semibold text-sm text-slate-900 whitespace-nowrap">
                        {req.leaveType}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-sm font-bold text-[#1178a4] whitespace-nowrap">
                        {req.days} {req.leaveType === 'Short Leave' ? 'Count' : 'Days'}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-sm text-slate-600 min-w-[210px] max-w-sm">
                        <div className="break-words">{req.reason}</div>
                        {req.attachmentName && req.attachmentData && (
                          <button
                            type="button"
                            onClick={() => openDataUrlInNewTab(req.attachmentData)}
                            className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-[#1178a4] hover:bg-sky-100 border border-sky-200 transition"
                          >
                            <Paperclip className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[180px]">{req.attachmentName}</span>
                          </button>
                        )}

                        {/* Proof Request Action Box directly inside the row */}
                        {isProofRequested && (
                          <div className="mt-2 p-2.5 rounded-lg bg-white border border-sky-300 shadow-2xs space-y-2">
                            <div className="text-[11px] font-bold text-[#1178a4] flex items-center gap-1">
                              <FileUp className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Proof Requested{req.proofRequestedBy ? ` by ${req.proofRequestedBy}` : ''}
                              </span>
                            </div>
                            {req.proofRequestNote && (
                              <p className="text-xs text-slate-600 leading-snug break-words">
                                &ldquo;{req.proofRequestNote}&rdquo;
                              </p>
                            )}
                            <button
                              type="button"
                              disabled={uploadingProofId === req.id}
                              onClick={() => triggerProofUpload(req.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1178a4] hover:bg-[#0e6388] text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                            >
                              <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                              <span>{uploadingProofId === req.id ? 'Uploading...' : 'Upload Proof'}</span>
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-center whitespace-nowrap">
                        {req.exceedsQuota ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 whitespace-nowrap">
                            <AlertTriangle className="w-3 h-3 shrink-0" /> Exceeds by {req.exceededBy}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 whitespace-nowrap">
                            Within Quota
                          </span>
                        )}
                      </td>
                      <td className="px-4 sm:px-5 py-3.5 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {req.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 whitespace-nowrap">
                              <Clock className="w-3 h-3 shrink-0" /> Pending Approval
                            </span>
                          )}
                          {req.status === 'APPROVED' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                <CheckCircle2 className="w-3 h-3 shrink-0" /> Approved
                              </span>
                              {req.approvedBy && (
                                <div className="text-[10px] text-slate-400 mt-0.5">by {req.approvedBy}</div>
                              )}
                            </div>
                          )}
                          {req.status === 'REJECTED' && (
                            <div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 whitespace-nowrap">
                                <XCircle className="w-3 h-3 shrink-0" /> Rejected
                              </span>
                              {req.approvedBy && (
                                <div className="text-[10px] text-slate-400 mt-0.5">by {req.approvedBy}</div>
                              )}
                            </div>
                          )}

                          {/* Proof Status Badge */}
                          {isProofRequested && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-[#1178a4] border border-sky-200 whitespace-nowrap">
                              <FileUp className="w-3 h-3 shrink-0" /> Proof Requested
                            </span>
                          )}
                          {isProofSubmitted && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3 shrink-0" /> Proof Submitted
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}