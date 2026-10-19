import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, UserCheck, LogOut, Award } from 'lucide-react';
import { fetchEmployees } from './api';
import LoginPage from './components/LoginPage';
import HRDashboard from './components/HRDashboard';
import EmployeePortal from './components/EmployeePortal';
import AddEmployeeModal from './components/AddEmployeeModal';
import BreachModal from './components/BreachModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('leavecore_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = useState('portal'); // 'hr' | 'portal'
  const [employees, setEmployees] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [breachData, setBreachData] = useState(null);

  const loadData = async () => {
    try {
      const data = await fetchEmployees();
      setEmployees(data);
    } catch (err) {
      console.error('Data load error:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
      // Set initial landing view based on role
      if (['HR', 'MANAGER', 'SUPERVISOR'].includes(currentUser.role)) {
        setView('hr');
      } else {
        setView('portal');
      }
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('leavecore_token');
    localStorage.removeItem('leavecore_user');
    setCurrentUser(null);
  };

  // If not authenticated, render Login Page
  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isManagement = ['HR', 'MANAGER', 'SUPERVISOR'].includes(currentUser.role);

  return (
    <div className="bg-slate-100 min-h-screen text-slate-800 pb-12 font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-none">LeaveCore</h1>
              <p className="text-xs text-slate-500 mt-0.5">Role-Based Leave System</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* View Switcher for Management Roles */}
            {isManagement && (
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setView('hr')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    view === 'hr' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  {currentUser.role === 'HR' ? 'HR Records' : 'Team Records'}
                </button>
                <button
                  onClick={() => setView('portal')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    view === 'portal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" /> My Leaves
                </button>
              </div>
            )}

            {/* Profile & Role Badge */}
            <div className="flex items-center gap-3 border-l pl-4 border-slate-200">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-900 leading-tight">{currentUser.name}</div>
                <span className={`inline-block px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  currentUser.role === 'HR'
                    ? 'bg-indigo-100 text-indigo-700'
                    : currentUser.role === 'MANAGER'
                    ? 'bg-emerald-100 text-emerald-700'
                    : currentUser.role === 'SUPERVISOR'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-purple-100 text-purple-700'
                }`}>
                  {currentUser.role}
                </span>
              </div>

              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Views */}
      <main className="max-w-6xl mx-auto px-4 mt-8">
        {view === 'hr' && isManagement ? (
          <HRDashboard
            employees={employees}
            onRefresh={loadData}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        ) : (
          <EmployeePortal
            employees={employees}
            selectedEmpId={currentUser.id}
            onSelectEmp={() => {}}
            onRefresh={loadData}
            onBreachDetected={setBreachData}
          />
        )}
      </main>

      {isAddModalOpen && (
        <AddEmployeeModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {breachData && (
        <BreachModal
          breachData={breachData}
          onClose={() => setBreachData(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}