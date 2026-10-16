import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { addEmployee } from '../api';

export default function AddEmployeeModal({ onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [annual, setAnnual] = useState(14);
  const [casual, setCasual] = useState(7);
  const [shortL, setShortL] = useState(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addEmployee({
      name,
      dept,
      allowedAnnual: annual,
      allowedCasual: casual,
      allowedShort: shortL
    });
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b flex justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900">Add Employee</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input
            type="text"
            required
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="text"
            required
            placeholder="Department"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
          />

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 space-y-1">
            <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Fixed Onboarding Quota</p>
            <p>Allowed quotas are locked once saved. Remaining balances will automatically match this starting balance.</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Annual</label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={annual}
                onChange={(e) => setAnnual(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Casual</label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={casual}
                onChange={(e) => setCasual(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Short</label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={shortL}
                onChange={(e) => setShortL(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold">Save Quotas</button>
          </div>
        </form>
      </div>
    </div>
  );
}