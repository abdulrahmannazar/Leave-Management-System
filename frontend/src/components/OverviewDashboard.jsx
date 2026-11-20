import React, { useState, useMemo } from 'react';
import {
  UserCheck,
  Clock,
  UserX,
  CalendarOff,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  X,
  Calendar
} from 'lucide-react';

// Returns YYYY-MM-DD in Asia/Colombo local time
const getLocalToday = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' });
};

// Parses "09:15 AM" into minutes since midnight (e.g. 555)
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

// Standard office start time cutoff for "Late Today": 09:00 AM (540 mins)
const LATE_CUTOFF_MINUTES = 9 * 60;

// Extracts { month: 'NOV', dayNum: 20, weekday: 'Fri' } for the calendar badge
const getCalendarBadgeParts = (dateStr, fallbackDate) => {
  let d;
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, day] = dateStr.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else if (fallbackDate) {
    d = new Date(fallbackDate);
  } else {
    d = new Date();
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const dayNum = d.getDate();
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
  return { month, dayNum, weekday };
};

// Formats "1 day annual leave", "2 days casual leave", "1 short leave"
const formatLeaveSummaryLine = (req) => {
  if (!req) return '';
  const days = req.days ?? 1;
  const typeLower = (req.leaveType || 'leave').toLowerCase();
  if (typeLower.includes('short')) {
    return `${days} ${Number(days) === 1 ? 'short leave' : 'short leaves'}`;
  }
  return `${days} ${Number(days) === 1 ? 'day' : 'days'} ${typeLower}`;
};

// Role display label matching existing terminology
const formatRoleLabel = (role, dept) => {
  const roleMap = {
    ADMIN: 'Administrator',
    HR: 'HR Officer',
    MANAGER: 'Department Manager',
    SUPERVISOR: 'Supervisor',
    EMPLOYEE: 'Staff Member'
  };
  const label = roleMap[role] || role || 'Staff';
  return dept ? `${label} • ${dept}` : label;
};

export default function OverviewDashboard({
  currentUser,
  employees = [],
  leaveRequests = [],
  onNavigate
}) {
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [activeFilterTab, setActiveFilterTab] = useState(null); // 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE' | 'PENDING' | null
  const [showAllApprovedLeaves, setShowAllApprovedLeaves] = useState(false);

  const isAdminOrHR = ['ADMIN', 'HR'].includes(currentUser.role);
  const canViewDashboard = ['ADMIN', 'HR', 'MANAGER', 'SUPERVISOR'].includes(currentUser.role);
  const todayStr = getLocalToday();

  // Filter visible employees based on user role & department filter
  // Admin & HR: full company-wide access (with department filter)
  // Manager / Supervisor: strictly their own department's employees only
  const visibleEmployees = useMemo(() => {
    if (!canViewDashboard) return [];
    return employees.filter((emp) => {
      if (isAdminOrHR) {
        if (selectedDeptFilter !== 'ALL' && emp.dept !== selectedDeptFilter) return false;
        return true;
      }
      if (currentUser.role === 'MANAGER') {
        return (
          emp.dept === currentUser.dept &&
          ['MANAGER', 'SUPERVISOR', 'EMPLOYEE'].includes(emp.role)
        );
      }
      if (currentUser.role === 'SUPERVISOR') {
        return (
          emp.dept === currentUser.dept &&
          ['SUPERVISOR', 'EMPLOYEE'].includes(emp.role)
        );
      }
      return false;
    });
  }, [employees, currentUser, isAdminOrHR, canViewDashboard, selectedDeptFilter]);

  const visibleEmployeeIds = useMemo(
    () => new Set(visibleEmployees.map((e) => e.id)),
    [visibleEmployees]
  );

  // Filter leave requests strictly for visible employees
  const visibleLeaveRequests = useMemo(() => {
    if (!canViewDashboard) return [];
    return leaveRequests.filter((req) => {
      if (isAdminOrHR) {
        if (selectedDeptFilter !== 'ALL') {
          return req.employee?.dept === selectedDeptFilter || visibleEmployeeIds.has(req.employeeId);
        }
        return true;
      }
      if (visibleEmployeeIds.has(req.employeeId)) return true;
      if (currentUser.role === 'MANAGER') {
        return (
          req.employee?.dept === currentUser.dept &&
          ['MANAGER', 'SUPERVISOR', 'EMPLOYEE'].includes(req.employee?.role)
        );
      }
      if (currentUser.role === 'SUPERVISOR') {
        return (
          req.employee?.dept === currentUser.dept &&
          ['SUPERVISOR', 'EMPLOYEE'].includes(req.employee?.role)
        );
      }
      return false;
    });
  }, [leaveRequests, visibleEmployeeIds, isAdminOrHR, canViewDashboard, selectedDeptFilter, currentUser]);

  // 1. Approved leaves active today ("On Leave" today)
  const onLeaveTodayRequests = useMemo(() => {
    return visibleLeaveRequests.filter((req) => {
      if (req.status !== 'APPROVED') return false;
      if (req.startDate) {
        const start = req.startDate;
        const end = req.endDate || req.startDate;
        return start <= todayStr && end >= todayStr;
      }
      if (req.createdAt) {
        const createdLocal = new Date(req.createdAt).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Colombo'
        });
        return createdLocal === todayStr;
      }
      return false;
    });
  }, [visibleLeaveRequests, todayStr]);

  // All approved leaves (used when "View all ->" is toggled on the On Leave card)
  const allApprovedLeaveRequests = useMemo(() => {
    return visibleLeaveRequests.filter((req) => req.status === 'APPROVED');
  }, [visibleLeaveRequests]);

  const onLeaveTodayEmployeeIds = useMemo(
    () => new Set(onLeaveTodayRequests.map((r) => r.employeeId)),
    [onLeaveTodayRequests]
  );

  // 2. Present Today
  const presentTodayEmployees = useMemo(() => {
    return visibleEmployees.filter((emp) => Boolean(emp.presentToday));
  }, [visibleEmployees]);

  // 3. Late Today (Present today, checked in after 09:00 AM)
  const lateTodayEmployees = useMemo(() => {
    return presentTodayEmployees.filter((emp) => {
      const mins = parseTimeToMinutes(emp.presentTime);
      return mins !== null && mins > LATE_CUTOFF_MINUTES;
    });
  }, [presentTodayEmployees]);

  // 4. Absent Today (Not marked present today AND not on approved leave today)
  const absentTodayEmployees = useMemo(() => {
    return visibleEmployees.filter(
      (emp) => !emp.presentToday && !onLeaveTodayEmployeeIds.has(emp.id)
    );
  }, [visibleEmployees, onLeaveTodayEmployeeIds]);

  // 5. Pending Leave Requests
  const pendingLeaveRequests = useMemo(() => {
    return visibleLeaveRequests.filter((req) => req.status === 'PENDING');
  }, [visibleLeaveRequests]);

  const displayedOnLeaveList = showAllApprovedLeaves
    ? allApprovedLeaveRequests
    : onLeaveTodayRequests;

  const toggleInsightDrawer = (key) => {
    setActiveFilterTab((prev) => (prev === key ? null : key));
  };

  if (!canViewDashboard) return null;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Top Header & Department Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isAdminOrHR
              ? 'Staff Insights & Leave Dashboard'
              : `${currentUser.dept} Department Dashboard`}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time daily attendance insights, active staff on leave, and pending leave request queue ({todayStr}).
          </p>
        </div>

        {isAdminOrHR && (
          <div className="flex items-center gap-2.5">
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-[#1178a4] focus:outline-none w-full sm:w-auto shadow-2xs"
            >
              <option value="ALL">All Departments</option>
              <option value="Audit">Audit</option>
              <option value="Tax">Tax</option>
              <option value="Secretarial">Secretarial</option>
              <option value="HR">HR</option>
              <option value="Accounting">Accounting</option>
            </select>
          </div>
        )}
      </div>

      {/* ==================== 5 STAFF INSIGHT KPI CARDS ==================== */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        {/* 1. Present Today */}
        <button
          type="button"
          onClick={() => toggleInsightDrawer('PRESENT')}
          className={`text-left bg-white p-4 sm:p-5 rounded-xl shadow-sm border transition hover:shadow-md ${
            activeFilterTab === 'PRESENT'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Present
            </span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <UserCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              {presentTodayEmployees.length}
            </span>
            <span className="text-xs font-semibold text-emerald-600">
              / {visibleEmployees.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Checked in today
          </p>
        </button>

        {/* 2. Late Today */}
        <button
          type="button"
          onClick={() => toggleInsightDrawer('LATE')}
          className={`text-left bg-white p-4 sm:p-5 rounded-xl shadow-sm border transition hover:shadow-md ${
            activeFilterTab === 'LATE'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Late Today
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-600 tabular-nums">
              {lateTodayEmployees.length}
            </span>
            <span className="text-xs font-medium text-slate-400">staff</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            After 09:00 AM
          </p>
        </button>

        {/* 3. Absent Today */}
        <button
          type="button"
          onClick={() => toggleInsightDrawer('ABSENT')}
          className={`text-left bg-white p-4 sm:p-5 rounded-xl shadow-sm border transition hover:shadow-md ${
            activeFilterTab === 'ABSENT'
              ? 'border-red-500 ring-2 ring-red-500/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Absent
            </span>
            <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <UserX className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-red-600 tabular-nums">
              {absentTodayEmployees.length}
            </span>
            <span className="text-xs font-medium text-slate-400">staff</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Not marked present
          </p>
        </button>

        {/* 4. On Leave */}
        <button
          type="button"
          onClick={() => toggleInsightDrawer('ON_LEAVE')}
          className={`text-left bg-white p-4 sm:p-5 rounded-xl shadow-sm border transition hover:shadow-md ${
            activeFilterTab === 'ON_LEAVE'
              ? 'border-[#1178a4] ring-2 ring-[#1178a4]/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              On Leave
            </span>
            <span className="w-8 h-8 rounded-lg bg-sky-50 text-[#1178a4] flex items-center justify-center shrink-0">
              <CalendarOff className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-[#1178a4] tabular-nums">
              {onLeaveTodayRequests.length}
            </span>
            <span className="text-xs font-medium text-slate-400">active</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Approved for today
          </p>
        </button>

        {/* 5. Leave Request Pendings */}
        <button
          type="button"
          onClick={() => toggleInsightDrawer('PENDING')}
          className={`col-span-2 sm:col-span-1 text-left bg-white p-4 sm:p-5 rounded-xl shadow-sm border transition hover:shadow-md ${
            activeFilterTab === 'PENDING'
              ? 'border-amber-500 ring-2 ring-amber-500/20'
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Pending
            </span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tabular-nums">
              {pendingLeaveRequests.length}
            </span>
            <span className="text-xs font-semibold text-amber-600">
              requests
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 truncate">
            Awaiting approval
          </p>
        </button>
      </div>

      {/* Expandable Quick-Inspection Drawer when a KPI Card is clicked */}
      {activeFilterTab && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1178a4]">
                {activeFilterTab === 'PRESENT' && `Present Staff Today (${presentTodayEmployees.length})`}
                {activeFilterTab === 'LATE' && `Late Arrivals Today — After 09:00 AM (${lateTodayEmployees.length})`}
                {activeFilterTab === 'ABSENT' && `Absent Staff Today (${absentTodayEmployees.length})`}
                {activeFilterTab === 'ON_LEAVE' && `Staff On Approved Leave Today (${onLeaveTodayRequests.length})`}
                {activeFilterTab === 'PENDING' && `Pending Leave Requests (${pendingLeaveRequests.length})`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveFilterTab(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 max-h-64 overflow-y-auto divide-y divide-slate-100">
            {activeFilterTab === 'PRESENT' && (
              presentTodayEmployees.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No staff marked present today yet.</p>
              ) : (
                presentTodayEmployees.map((emp) => {
                  const mins = parseTimeToMinutes(emp.presentTime);
                  const isLate = mins !== null && mins > LATE_CUTOFF_MINUTES;
                  return (
                    <div key={emp.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center shrink-0 border border-emerald-200">
                          {emp.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{emp.name}</div>
                          <div className="text-slate-500 truncate">{formatRoleLabel(emp.role, emp.dept)}</div>
                        </div>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full font-semibold shrink-0 ${
                          isLate
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {emp.presentTime || 'Present'} {isLate ? '(Late)' : '(On Time)'}
                      </span>
                    </div>
                  );
                })
              )
            )}

            {activeFilterTab === 'LATE' && (
              lateTodayEmployees.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No late arrivals recorded today.</p>
              ) : (
                lateTodayEmployees.map((emp) => (
                  <div key={emp.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 font-bold flex items-center justify-center shrink-0 border border-amber-200">
                        {emp.name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{emp.name}</div>
                        <div className="text-slate-500 truncate">{formatRoleLabel(emp.role, emp.dept)}</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-semibold bg-amber-100 text-amber-800 shrink-0">
                      Arrived at {emp.presentTime}
                    </span>
                  </div>
                ))
              )
            )}

            {activeFilterTab === 'ABSENT' && (
              absentTodayEmployees.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No unexplained absences today.</p>
              ) : (
                absentTodayEmployees.map((emp) => (
                  <div key={emp.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-red-50 text-red-700 font-bold flex items-center justify-center shrink-0 border border-red-200">
                        {emp.name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{emp.name}</div>
                        <div className="text-slate-500 truncate">{formatRoleLabel(emp.role, emp.dept)}</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-semibold bg-red-50 text-red-700 border border-red-200 shrink-0">
                      Not Checked In
                    </span>
                  </div>
                ))
              )
            )}

            {activeFilterTab === 'ON_LEAVE' && (
              onLeaveTodayRequests.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No staff members are on approved leave today.</p>
              ) : (
                onLeaveTodayRequests.map((req) => (
                  <div key={req.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-sky-50 text-[#1178a4] font-bold flex items-center justify-center shrink-0 border border-sky-200">
                        {req.employee?.name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{req.employee?.name}</div>
                        <div className="text-slate-500 truncate">
                          {formatLeaveSummaryLine(req)} ({req.startDate}
                          {req.endDate && req.endDate !== req.startDate ? ` → ${req.endDate}` : ''})
                        </div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 shrink-0">
                      Approved
                    </span>
                  </div>
                ))
              )
            )}

            {activeFilterTab === 'PENDING' && (
              pendingLeaveRequests.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">No pending leave requests.</p>
              ) : (
                pendingLeaveRequests.map((req) => (
                  <div key={req.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 font-bold flex items-center justify-center shrink-0 border border-amber-200">
                        {req.employee?.name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{req.employee?.name}</div>
                        <div className="text-slate-500 truncate">
                          {formatLeaveSummaryLine(req)} &bull; {req.startDate || 'No date'}
                        </div>
                      </div>
                    </div>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('approvals')}
                        className="px-2.5 py-1 rounded-lg font-semibold bg-[#1178a4] text-white hover:bg-[#0e6388] transition shrink-0"
                      >
                        Review
                      </button>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}

      {/* ==================== SIDE-BY-SIDE CARDS: ON LEAVE & PENDING REQUESTS ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LEFT CARD: ON LEAVE */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">On Leave</h3>
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                {displayedOnLeaveList.length}
              </span>
              {showAllApprovedLeaves && (
                <span className="text-[11px] font-medium text-slate-400">
                  (All Approved)
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowAllApprovedLeaves((prev) => !prev)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#1178a4] transition"
            >
              <span>{showAllApprovedLeaves ? 'Today only' : 'View all'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2 divide-y divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
            {displayedOnLeaveList.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  {showAllApprovedLeaves
                    ? 'No approved leave records found'
                    : 'No staff on leave today'}
                </p>
                <p className="text-xs text-slate-400">
                  {showAllApprovedLeaves
                    ? 'Approved leave requests will appear here.'
                    : 'Click "View all" to see upcoming or past approved leaves.'}
                </p>
              </div>
            ) : (
              displayedOnLeaveList.map((req) => {
                const empName = req.employee?.name || req.employeeId || 'Staff';
                const initial = empName.charAt(0).toUpperCase();
                const roleLine = formatRoleLabel(req.employee?.role, req.employee?.dept);
                const leaveSummary = formatLeaveSummaryLine(req);
                const { month, dayNum, weekday } = getCalendarBadgeParts(
                  req.startDate,
                  req.createdAt
                );

                return (
                  <div
                    key={req.id}
                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition"
                  >
                    {/* Left: Avatar + Name, Role, Leave Summary */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate">
                          {empName}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {roleLine}
                        </div>
                        <div className="text-xs font-medium text-slate-700 truncate mt-0.5">
                          {leaveSummary}
                        </div>
                      </div>
                    </div>

                    {/* Right: Calendar Date Box + Truncated Reason */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-11 py-1 rounded-lg border border-emerald-400 bg-white text-center shadow-2xs shrink-0">
                        <div className="text-[9px] font-bold uppercase text-red-500 leading-none">
                          {month}
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 leading-tight mt-0.5">
                          {dayNum}
                        </div>
                        <div className="text-[9px] font-medium text-slate-500 leading-none">
                          {weekday}
                        </div>
                      </div>

                      <div
                        className="text-xs text-slate-500 truncate w-28 sm:w-36"
                        title={req.reason || 'No reason provided'}
                      >
                        {req.reason || 'No reason provided'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT CARD: PENDING REQUESTS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Pending Requests</h3>
              <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                {pendingLeaveRequests.length}
              </span>
            </div>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('approvals')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#1178a4] transition"
              >
                <span>view all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="mt-2 divide-y divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
            {pendingLeaveRequests.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-600">
                  All caught up!
                </p>
                <p className="text-xs text-slate-400">
                  There are no pending leave requests awaiting approval.
                </p>
              </div>
            ) : (
              pendingLeaveRequests.map((req) => {
                const empName = req.employee?.name || req.employeeId || 'Staff';
                const initial = empName.charAt(0).toUpperCase();
                const roleLine = formatRoleLabel(req.employee?.role, req.employee?.dept);
                const leaveSummary = formatLeaveSummaryLine(req);
                const { month, dayNum, weekday } = getCalendarBadgeParts(
                  req.startDate,
                  req.createdAt
                );

                return (
                  <div
                    key={req.id}
                    onClick={() => onNavigate && onNavigate('approvals')}
                    className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl cursor-pointer transition"
                  >
                    {/* Left: Avatar + Name, Role, Leave Summary */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                          <span className="truncate">{empName}</span>
                          {req.exceedsQuota && (
                            <AlertTriangle
                              className="w-3.5 h-3.5 text-red-500 shrink-0"
                              title={`Exceeds quota by ${req.exceededBy}`}
                            />
                          )}
                          {req.attachmentName && (
                            <Paperclip
                              className="w-3 h-3 text-[#1178a4] shrink-0"
                              title={`Attachment: ${req.attachmentName}`}
                            />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {roleLine}
                        </div>
                        <div className="text-xs font-medium text-slate-700 truncate mt-0.5">
                          {leaveSummary}
                        </div>
                      </div>
                    </div>

                    {/* Right: Calendar Date Box + Truncated Reason */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-11 py-1 rounded-lg border border-amber-400 bg-white text-center shadow-2xs shrink-0">
                        <div className="text-[9px] font-bold uppercase text-amber-600 leading-none">
                          {month}
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 leading-tight mt-0.5">
                          {dayNum}
                        </div>
                        <div className="text-[9px] font-medium text-slate-500 leading-none">
                          {weekday}
                        </div>
                      </div>

                      <div
                        className="text-xs text-slate-500 truncate w-28 sm:w-36"
                        title={req.reason || 'No reason provided'}
                      >
                        {req.reason || 'No reason provided'}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
