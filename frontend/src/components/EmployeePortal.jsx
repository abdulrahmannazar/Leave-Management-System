import React, { useState } from 'react';
import { Calendar, Sun, Clock, CheckCircle2 } from 'lucide-react';
import { markAttendance, requestLeave } from '../api';

export default function EmployeePortal({ employees, selectedEmpId, onSelectEmp, onRefresh, onBreachDetected }) {
  const currentEmp = employees.find((e) => e.id === selectedEmpId) || employees[0];
  const [leaveType, setLeaveType] = useState('annual');
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!currentEmp) return <p className="text-center mt-10">No employees added yet.</p>;

  const handleAttendance = async () => {
    try {
      await markAttendance(currentEmp.id);
      onRefresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    const reqDays = parseFloat(days);
    if (!reqDays || reqDays <= 0) return alert('Enter a valid amount (at least 0.5 days)');
    
    setLoading(true);
    try {
      const res = await requestLeave(currentEmp.id, { type: leaveType, days: reqDays, reason });
      if (res.exceeded) {
        // Triggers the popup modal instantly
        onBreachDetected(res);
      } else {
        alert('Leave approved successfully!');
        setDays('');
        setReason('');
        onRefresh();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Attendance & Selector */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">Viewing as:</label>
          <select
            value={currentEmp.id}
            onChange={(e) => onSelectEmp(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name} ({emp.dept})</option>
            ))}
          </select>
        </div>
        {currentEmp.presentToday ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" /> Marked Present Today ({currentEmp.presentTime})
          </div>
        ) : (
          <button
            onClick={handleAttendance}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition active:scale-95 shadow-md shadow-emerald-100"
          >
            <Clock className="w-4 h-4" /> Click If Present Today
          </button>
        )}
      </div>

      {/* Leave Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between text-sm font-semibold text-slate-600">
            Annual Leaves <span className="bg-indigo-50 text-indigo-600 p-2 rounded-lg"><Calendar className="w-4 h-4"/></span>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {currentEmp.remainingAnnual} <span className="text-sm text-slate-500 font-medium">remaining</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Out of {currentEmp.allowedAnnual} allowed days</div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between text-sm font-semibold text-slate-600">
            Casual Leaves <span className="bg-amber-50 text-amber-600 p-2 rounded-lg"><Sun className="w-4 h-4"/></span>
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">
            {currentEmp.remainingCasual} <span className="text-sm text-slate-500 font-medium">remaining</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Out of {currentEmp.allowedCasual} allowed days</div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between text-sm font-semibold text-slate-600">
            Short Leaves Taken <span className="bg-purple-50 text-purple-600 p-2 rounded-lg"><Clock className="w-4 h-4"/></span>
          </div>
          <div className="mt-3 text-3xl font-bold text-purple-700">
            {currentEmp.shortLeavesTaken ?? 0} <span className="text-sm text-slate-500 font-medium">taken</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Logged directly by HR</div>
        </div>
      </div>

      {/* Apply for Leave Form */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 mb-1">Apply for Leave</h3>
        <p className="text-xs text-slate-500 mb-4">
          Submissions exceeding your remaining quota will trigger an instant alert popup and dispatch email notifications to HR and Admin.
        </p>
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="annual">Annual Leave</option>
                <option value="casual">Casual Leave</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Days Requested</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                placeholder="e.g. 1 or 0.5"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Reason / Note</label>
            <input
              type="text"
              placeholder="Reason for taking leave"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-sm transition shadow-sm"
          >
            {loading ? 'Processing...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
}