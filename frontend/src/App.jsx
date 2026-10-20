import React, { useState, useEffect } from 'react';
import { Users, UserCheck, ClipboardCheck, LogOut } from 'lucide-react';
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
    <div className="bg-slate-100 min-h-screen text-slate-800 pb-12 font-sans overflow-x-hidden">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-2.5 md:py-0 md:h-16 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src="/logo.png"
              alt="Frontier Advisory Logo"
              className="h-9 sm:h-12 w-auto object-contain shrink-0"
            />
            <div>
              <h1 className="font-bold text-[#1178a4] leading-tight text-sm sm:text-lg">
                Leave Management System
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {currentUser.dept} Department
              </p>
            </div>
          </div>

          {/* Right Controls & Navigation */}
          <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-4 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
            {isManagement && (
              <div className="flex flex-1 md:flex-initial gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
                <button
                  onClick={() => setView('records')}
                  className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    view === 'records'
                      ? 'bg-white text-[#1178a4] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Staff Records</span>
                </button>
                <button
                  onClick={() => setView('approvals')}
                  className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    view === 'approvals'
                      ? 'bg-white text-[#1178a4] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Leave Approvals</span>
                </button>
                <button
                  onClick={() => setView('portal')}
                  className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    view === 'portal'
                      ? 'bg-white text-[#1178a4] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>My Portal</span>
                </button>
              </div>
            )}

            {/* User Profile & Logout */}
            <div className={`flex items-center gap-2 sm:gap-3 ${isManagement ? 'border-l pl-2 sm:pl-4 border-slate-200' : 'ml-auto'}`}>
              <div className="text-right">
                <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[110px] sm:max-w-none">
                  {currentUser.name}
                </div>
                <span className="inline-block px-2 py-0.5 mt-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase bg-sky-50 text-[#1178a4] border border-sky-200 whitespace-nowrap">
                  {currentUser.role} &bull; {currentUser.dept}
                </span>
              </div>

              <button
                onClick={handleLogout}
                title="Log out"
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 mt-5 sm:mt-8">
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