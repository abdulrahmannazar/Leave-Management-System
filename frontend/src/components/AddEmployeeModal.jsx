import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { addEmployee } from '../api';

const DEPARTMENTS = ['Audit', 'Tax', 'Secretarial', 'HR', 'Accounting'];

export default function AddEmployeeModal({ currentUser, onClose, onSuccess }) {
  const isDeptLocked = ['MANAGER', 'SUPERVISOR'].includes(currentUser.role);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('EMPLOYEE');
  const [dept, setDept] = useState(isDeptLocked ? currentUser.dept : 'Audit');
  const [annual, setAnnual] = useState(14);
  const [casual, setCasual] = useState(7);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const availableRoles = () => {
    if (currentUser.role === 'SUPERVISOR') {
      return [{ value: 'EMPLOYEE', label: 'Employee' }];
    }
    if (currentUser.role === 'MANAGER') {
      return [
        { value: 'EMPLOYEE', label: 'Employee' },
        { value: 'SUPERVISOR', label: 'Supervisor' }
      ];
    }
    return [
      { value: 'EMPLOYEE', label: 'Employee' },
      { value: 'SUPERVISOR', label: 'Supervisor' },
      { value: 'MANAGER', label: 'Department Manager (Max 1/Dept)' },
      { value: 'HR', label: 'HR Officer' },
      { value: 'ADMIN', label: 'Admin' }
    ];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await addEmployee({
        name,
        email,
        password,
        role,
        dept: isDeptLocked ? currentUser.dept : dept,
        allowedAnnual: annual,
        allowedCasual: casual,
        creatorRole: currentUser.role,
        creatorDept: currentUser.dept
      });

      if (res.error) {
        setError(res.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError('Failed to add employee.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-[#1178a4]">Add Staff Credentials</h3>
          <button onClick={onClose} type="button">
            <X className="w-5 h-5 text-slate-400 hover:text-slate-600 transition" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-xs font-semibold text-red-600 rounded-lg">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="Staff Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Login Email
              </label>
              <input
                type="email"
                required
                placeholder="staff@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Login Password
              </label>
              <input
                type="text"
                required
                placeholder="Initial password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              >
                {availableRoles().map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Department
              </label>
              <select
                value={isDeptLocked ? currentUser.dept : dept}
                disabled={isDeptLocked}
                onChange={(e) => setDept(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50 disabled:opacity-60 focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-[#0e6388] space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" /> Onboarding Quota
            </p>
            <p>
              Allowed Annual & Casual quotas are fixed upon creation. Only HR can reduce remaining balances later.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Allowed Annual
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={annual}
                onChange={(e) => setAnnual(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Allowed Casual
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={casual}
                onChange={(e) => setCasual(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 sm:gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2 bg-[#1178a4] hover:bg-[#0e6388] text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Create Credentials'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}