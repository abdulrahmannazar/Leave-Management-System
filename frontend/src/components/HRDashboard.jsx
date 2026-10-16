import React, { useState } from 'react';
import { UserPlus, Lock, Plus } from 'lucide-react';
import { updateRemainingLeaves, incrementShortLeave } from '../api';

export default function HRDashboard({ employees, onRefresh, onOpenAddModal }) {
  const [localRemaining, setLocalRemaining] = useState({});

  const handleInputChange = (empId, field, value) => {
    setLocalRemaining((prev) => ({ ...prev, [`${empId}_${field}`]: value }));
  };

  const handleBlur = async (empId, field, value) => {
    const parsed = parseFloat(value);
    const safeVal = isNaN(parsed) ? 0 : parsed;
    await updateRemainingLeaves(empId, { [field]: safeVal });
    onRefresh();
  };

  const handleIncrement = async (empId) => {
    await incrementShortLeave(empId);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Employee Leave Records</h2>
          <p className="text-sm text-slate-500 mt-1">
            Allowed annual & casual quotas are locked. Increment short leaves taken directly as they occur.
          </p>
        </div>
        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="px-5 py-3.5">Employee</th>
                <th className="px-4 py-3.5 text-center">Allowed Annual</th>
                <th className="px-4 py-3.5 text-center">Remaining Annual</th>
                <th className="px-4 py-3.5 text-center">Allowed Casual</th>
                <th className="px-4 py-3.5 text-center">Remaining Casual</th>
                <th className="px-5 py-3.5 text-center">Short Leaves Taken</th>
                <th className="px-5 py-3.5 text-center">Today's Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map((emp) => {
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
                      <div className="text-xs text-slate-500">{emp.dept} &bull; {emp.id}</div>
                    </td>

                    {/* Annual Leaves */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        <Lock className="w-3 h-3" /> {emp.allowedAnnual} Days
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="number"
                        step="0.5"
                        value={annualVal}
                        onChange={(e) => handleInputChange(emp.id, 'remainingAnnual', e.target.value)}
                        onBlur={(e) => handleBlur(emp.id, 'remainingAnnual', e.target.value)}
                        className={`w-20 px-2.5 py-1 text-center font-bold text-sm border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                          Number(annualVal) <= 0 ? 'bg-red-50 text-red-600 border-red-300' : 'bg-white border-slate-300'
                        }`}
                      />
                    </td>

                    {/* Casual Leaves */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Lock className="w-3 h-3" /> {emp.allowedCasual} Days
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="number"
                        step="0.5"
                        value={casualVal}
                        onChange={(e) => handleInputChange(emp.id, 'remainingCasual', e.target.value)}
                        onBlur={(e) => handleBlur(emp.id, 'remainingCasual', e.target.value)}
                        className={`w-20 px-2.5 py-1 text-center font-bold text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 ${
                          Number(casualVal) <= 0 ? 'bg-red-50 text-red-600 border-red-300' : 'bg-white border-slate-300'
                        }`}
                      />
                    </td>

                    {/* Short Leaves Taken (Increment Button & Counter) */}
                    <td className="px-5 py-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={shortVal}
                          onChange={(e) => handleInputChange(emp.id, 'shortLeavesTaken', e.target.value)}
                          onBlur={(e) => handleBlur(emp.id, 'shortLeavesTaken', e.target.value)}
                          className="w-16 px-2 py-1 text-center font-bold text-sm border border-purple-200 bg-purple-50 text-purple-800 rounded-lg focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleIncrement(emp.id)}
                          title="Add +1 Short Leave"
                          className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
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
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}