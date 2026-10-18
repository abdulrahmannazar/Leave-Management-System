import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, UserCheck } from 'lucide-react';
import { fetchEmployees } from './api';
import HRDashboard from './components/HRDashboard';
import EmployeePortal from './components/EmployeePortal';
import AddEmployeeModal from './components/AddEmployeeModal';
import BreachModal from './components/BreachModal';

export default function App() {
  const [view, setView] = useState('hr'); 
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [breachData, setBreachData] = useState(null);

  const loadData = async () => {
    try {
      const data = await fetchEmployees();
      setEmployees(data);
      if (data.length > 0 && !selectedEmpId) setSelectedEmpId(data[0].id);
    } catch (err) { console.error('Load Error:', err); }
  };

  useEffect(() => { loadData(); }, []);

  return (
    <div className="bg-slate-100 min-h-screen text-slate-800 pb-12">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white"><ShieldCheck className="w-5 h-5" /></div>
            <h1 className="font-bold text-slate-900 leading-none">LeaveCore</h1>
          </div>
          <div className="flex gap-2 bg-slate-100 p-1 rounded-xl border">
            <button onClick={() => setView('hr')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold ${view === 'hr' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}><Users className="w-4 h-4"/> HR View</button>
            <button onClick={() => setView('emp')} className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold ${view === 'emp' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'}`}><UserCheck className="w-4 h-4"/> Employee Portal</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {view === 'hr' ? (
          <HRDashboard employees={employees} onRefresh={loadData} onOpenAddModal={() => setIsAddModalOpen(true)} />
        ) : (
          <EmployeePortal employees={employees} selectedEmpId={selectedEmpId} onSelectEmp={setSelectedEmpId} onRefresh={loadData} onBreachDetected={setBreachData} />
        )}
      </main>

      {isAddModalOpen && <AddEmployeeModal onClose={() => setIsAddModalOpen(false)} onSuccess={loadData} />}
      {breachData && <BreachModal breachData={breachData} onClose={() => setBreachData(null)} onRefresh={loadData} />}
    </div>
  );
}