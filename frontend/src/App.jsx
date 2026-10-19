import React, { useState, useEffect } from 'react';
import { ShieldCheck, Users, UserCheck, ClipboardCheck, LogOut } from 'lucide-react';
import { fetchEmployees, fetchLeaveRequests } from './api';
import LoginPage from './components/LoginPage';
import HRDashboard from './components/HRDashboard';
import LeaveApprovals from './components/LeaveApprovals';
import EmployeePortal from './components/EmployeePortal';
import AddEmployeeModal from './components/AddEmployeeModal';
import BreachModal from './components/BreachModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('leavecore_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [view, setView] = useState('portal'); // 'records' | 'approvals' | 'portal'
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [breachData, setBreachData] = useState(null);

  const loadData = async () => {
    try {
      const [empData, reqData] = await Promise.all([
        fetchEmployees(),
        fetchLeaveRequests()
      ]);
      if (Array.isArray(empData)) setEmployees(empData);
      if (Array.isArray(reqData)) setLeaveRequests(reqData);
    } catch (err) {
      console.error('Data load error:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadData();
      if (['ADMIN', 'HR', 'MANAGER', 'SUPERVISOR'].includes(currentUser.role)) {
        setView('records');
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

  if (!currentUser) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isManagement = ['ADMIN', 'HR', 'MANAGER', 'SUPERVISOR'].includes(currentUser.role);

  return (
    <div className="bg-slate-100 min-h-screen text-slate-800 pb-12 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 leading-none">LeaveCore</h1>
              <p className="text-xs text-slate-500 mt-0.5">{currentUser.dept} Department</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isManagement && (
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setView('records')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    view === 'records' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Staff Records
                </button>
                <button
                  onClick={() => setView('approvals')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    view === 'approvals' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  Leave Approvals
                </button>
                <button
                  onClick={() => setView('portal')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    view === 'portal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  My Portal
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 border-l pl-4 border-slate-200">
              <div className="text-right">
                <div className="text-xs font-bold text-slate-900 leading-tight">{currentUser.name}</div>
                <span className="inline-block px-2 py-0.5 mt-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {currentUser.role} &bull; {currentUser.dept}
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

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {view === 'records' && isManagement ? (
          <HRDashboard
            currentUser={currentUser}
            employees={employees}
            onRefresh={loadData}
            onOpenAddModal={() => setIsAddModalOpen(true)}
          />
        ) : view === 'approvals' && isManagement ? (
          <LeaveApprovals
            currentUser={currentUser}
            leaveRequests={leaveRequests}
            onRefresh={loadData}
          />
        ) : (
          <EmployeePortal
            currentUser={currentUser}
            employees={employees}
            leaveRequests={leaveRequests}
            onRefresh={loadData}
            onBreachDetected={setBreachData}
          />
        )}
      </main>

      {isAddModalOpen && (
        <AddEmployeeModal
          currentUser={currentUser}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {breachData && (
        <BreachModal
          breachData={breachData}
          onClose={() => setBreachData(null)}
        />
      )}
    </div>
  );
}