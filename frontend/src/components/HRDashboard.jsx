import React, { useState } from 'react';
import { UserPlus, Lock, Plus, Building2 } from 'lucide-react';
import { updateRemainingLeaves, incrementShortLeave } from '../api';

export default function HRDashboard({ currentUser, employees, onRefresh, onOpenAddModal }) {
  const [localRemaining, setLocalRemaining] = useState({});
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');

  const isHR = currentUser.role === 'HR';
  const isAdminOrHR = ['ADMIN', 'HR'].includes(currentUser.role);

  // Filter employees based on hierarchy & department rules
  const visibleEmployees = employees.filter((emp) => {
    if (isAdminOrHR) {
      if (selectedDeptFilter !== 'ALL' && emp.dept !== selectedDeptFilter) return false;
      return true;
    }
    if (currentUser.role === 'MANAGER') {
      return emp.dept === currentUser.dept && ['MANAGER', 'SUPERVISOR', 'EMPLOYEE'].includes(emp.role);
    }
    if (currentUser.role === 'SUPERVISOR') {
      return emp.dept === currentUser.dept && ['SUPERVISOR', 'EMPLOYEE'].includes(emp.role);
    }
    return emp.id === currentUser.id;
  });

  const handleInputChange = (empId, field, value) => {
    setLocalRemaining((prev) => ({ ...prev, [`${empId}_${field}`]: value }));
  };

  const handleBlur = async (empId, field, value) => {
    if (!isHR) return;
    const parsed = parseFloat(value);
    const safeVal = isNaN(parsed) ? 0 : parsed;
    const res = await updateRemainingLeaves(empId, { [field]: safeVal, requesterRole: currentUser.role });
    if (res.error) alert(res.error);
    onRefresh();
  };

  const handleIncrement = async (empId) => {
    if (!isHR) return;
    const res = await incrementShortLeave(empId, currentUser.role);
    if (res.error) alert(res.error);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {isAdminOrHR ? 'Company-Wide Staff & Leave Records' : `${currentUser.dept} Department Staff Records`}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {isHR
              ? 'HR Exclusive: You can manually reduce remaining leave counts and increment short leaves.'
              : 'Read-Only View: Only HR is authorized to reduce remaining leave counts.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdminOrHR && (
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              <option value="Audit">Audit</option>
              <option value="Tax">Tax</option>
              <option value="Secretarial">Secretarial</option>
              <option value="HR">HR</option>
              <option value="Accounting">Accounting</option>
            </select>
          )}

          {['HR', 'MANAGER', 'SUPERVISOR', 'ADMIN'].includes(currentUser.role) && (
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-[#1178a4] hover:bg-[#0e6388] text-white text-sm font-semibold rounded-lg shadow-sm transition"
            >
              <UserPlus className="w-4 h-4" /> Add Staff Credentials
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Staff Member</th>
                <th className="px-4 py-3.5">Role & Dept</th>
                <th className="px-4 py-3.5 text-center">Allowed Annual</th>
                <th className="px-4 py-3.5 text-center">Remaining Annual</th>
                <th className="px-4 py-3.5 text-center">Allowed Casual</th>
                <th className="px-4 py-3.5 text-center">Remaining Casual</th>
                <th className="px-5 py-3.5 text-center">Short Leaves Taken</th>
                <th className="px-5 py-3.5 text-center">Today's Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleEmployees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-8 text-sm text-slate-500">
                    No staff records found for this view.
                  </td>
                </tr>
              ) : (
                visibleEmployees.map((emp) => {
                  const annualVal =
                    localRemaining[`${emp.id}_remainingAnnual`] !== undefined
                      ? localRemaining[`${emp.id}_remainingAnnual`]
                      : emp.remainingAnnual;

                  const casualVal =
                    localRemaining[`${emp.id}_remainingCasual`] !== undefined
                      ? localRemaining[`${emp.id}_remainingCasual`]
                      : emp.remainingCasual;

                  const shortVal =
                    localRemaining[`${emp.id}_shortLeavesTaken`] !== undefined
                      ? localRemaining[`${emp.id}_shortLeavesTaken`]
                      : emp.shortLeavesTaken;

                  return (
                    <tr key={emp.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-slate-900">{emp.name}</div>
                        <div className="text-xs text-slate-500">{emp.email} &bull; {emp.id}</div>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                          emp.role === 'MANAGER' ? 'bg-emerald-100 text-emerald-800' :
                          emp.role === 'SUPERVISOR' ? 'bg-amber-100 text-amber-800' :
                          emp.role === 'HR' ? 'bg-sky-100 text-[#1178a4]' :
                          emp.role === 'ADMIN' ? 'bg-slate-800 text-white' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {emp.role}
                        </span>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {emp.dept}
                        </div>
                      </td>

                      {/* Allowed Annual (Locked) */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-[#1178a4] border border-sky-200">
                          <Lock className="w-3 h-3" /> {emp.allowedAnnual}
                        </span>
                      </td>

                      {/* Remaining Annual (Editable ONLY by HR) */}
                      <td className="px-4 py-4 text-center">
                        {isHR ? (
                          <input
                            type="number"
                            step="0.5"
                            value={annualVal}
                            onChange={(e) => handleInputChange(emp.id, 'remainingAnnual', e.target.value)}
                            onBlur={(e) => handleBlur(emp.id, 'remainingAnnual', e.target.value)}
                            className={`w-20 px-2.5 py-1 text-center font-bold text-sm border rounded-lg focus:ring-2 focus:ring-[#1178a4] focus:outline-none ${
                              Number(annualVal) <= 0 ? 'bg-red-50 text-red-600 border-red-300' : 'bg-white border-slate-300'
                            }`}
                          />
                        ) : (
                          <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${Number(emp.remainingAnnual) <= 0 ? 'text-red-600 bg-red-50' : 'text-slate-800'}`}>
                            {emp.remainingAnnual}
                          </span>
                        )}
                      </td>

                      {/* Allowed Casual (Locked) */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Lock className="w-3 h-3" /> {emp.allowedCasual}
                        </span>
                      </td>

                      {/* Remaining Casual (Editable ONLY by HR) */}
                      <td className="px-4 py-4 text-center">
                        {isHR ? (
                          <input
                            type="number"
                            step="0.5"
                            value={casualVal}
                            onChange={(e) => handleInputChange(emp.id, 'remainingCasual', e.target.value)}
                            onBlur={(e) => handleBlur(emp.id, 'remainingCasual', e.target.value)}
                            className={`w-20 px-2.5 py-1 text-center font-bold text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none ${
                              Number(casualVal) <= 0 ? 'bg-red-50 text-red-600 border-red-300' : 'bg-white border-slate-300'
                            }`}
                          />
                        ) : (
                          <span className={`font-bold text-sm px-2.5 py-1 rounded-lg ${Number(emp.remainingCasual) <= 0 ? 'text-red-600 bg-red-50' : 'text-slate-800'}`}>
                            {emp.remainingCasual}
                          </span>
                        )}
                      </td>

                      {/* Short Leaves Taken (Editable ONLY by HR) */}
                      <td className="px-5 py-4 text-center">
                        {isHR ? (
                          <div className="inline-flex items-center gap-2">
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={shortVal}
                              onChange={(e) => handleInputChange(emp.id, 'shortLeavesTaken', e.target.value)}
                              onBlur={(e) => handleBlur(emp.id, 'shortLeavesTaken', e.target.value)}
                              className="w-16 px-2 py-1 text-center font-bold text-sm border border-sky-200 bg-sky-50 text-[#1178a4] rounded-lg focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleIncrement(emp.id)}
                              title="HR Only: Add +1 Short Leave"
                              className="p-1.5 bg-[#1178a4] hover:bg-[#0e6388] text-white rounded-lg shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <span className="font-bold text-sm text-[#1178a4] bg-sky-50 px-3 py-1 rounded-lg border border-sky-200">
                            {emp.shortLeavesTaken} / 2
                          </span>
                        )}
                      </td>

                      {/* Attendance */}
                      <td className="px-5 py-4 text-center">
                        {emp.presentToday ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present ({emp.presentTime})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Not Marked
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
    </div>
  );
}