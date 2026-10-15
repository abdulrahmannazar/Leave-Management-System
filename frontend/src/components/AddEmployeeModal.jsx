import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { addEmployee } from '../api';

export default function AddEmployeeModal({ onClose, onSuccess }) {
  const [name, setName] = useState('');
  const [dept, setDept] = useState('');
  const [annual, setAnnual] = useState(14);
  const [casual, setCasual] = useState(7);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addEmployee({ name, dept, allowedAnnual: annual, allowedCasual: casual });
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between bg-slate-50">
          <h3 className="font-bold text-slate-900">Add Employee</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <input type="text" required placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input type="text" required placeholder="Department" value={dept} onChange={(e) => setDept(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Allowed Annual</label>
              <input type="number" min="0" step="0.5" required value={annual} onChange={(e) => setAnnual(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Allowed Casual</label>
              <input type="number" min="0" step="0.5" required value={casual} onChange={(e) => setCasual(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">Save Quota</button>
          </div>
        </form>
      </div>
    </div>
  );
}