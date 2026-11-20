import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserCheck, ClipboardCheck, LogOut, LayoutDashboard } from 'lucide-react';
import {
  fetchEmployees,
  fetchLeaveRequests,
  logoutUserSession,
  clearLocalAuthState,
  IDLE_LOGOUT_MESSAGE
} from './api';
import useIdleTimeout from './hooks/useIdleTimeout';
import LoginPage from './components/LoginPage';
import OverviewDashboard from './components/OverviewDashboard';
import HRDashboard from './components/HRDashboard';
import LeaveApprovals from './components/LeaveApprovals';
import EmployeePortal from './components/EmployeePortal';
import AddEmployeeModal from './components/AddEmployeeModal';
import BreachModal from './components/BreachModal';
import DialogModal from './components/DialogModal';
import IdleWarningModal from './components/IdleWarningModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('leavecore_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [logoutNotice, setLogoutNotice] = useState(() => {
    return sessionStorage.getItem('leavecore_logout_notice') || '';
  });

  const [view, setView] = useState('portal'); // 'records' | 'approvals' | 'portal'
  const [employees, setEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [breachData, setBreachData] = useState(null);
  const [dialogData, setDialogData] = useState(null);

  const handleSessionEnded = useCallback((reasonMessage = null) => {
    setIsAddModalOpen(false);
    setBreachData(null);
    setDialogData(null);
    setEmployees([]);
    setLeaveRequests([]);
    setCurrentUser(null);
    if (reasonMessage) {
      setLogoutNotice(reasonMessage);
      sessionStorage.setItem('leavecore_logout_notice', reasonMessage);
    }
  }, []);

  const {
    isWarningOpen,
    remainingSeconds,
    handleStaySignedIn,
    handleLogoutNow
  } = useIdleTimeout({
    isAuthenticated: Boolean(currentUser),
    onIdleLogout: handleSessionEnded
  });

  // Global 401 Unauthorized Interceptor listener
  useEffect(() => {
    const onUnauthorized = (e) => {
      const msg = e.detail?.message || IDLE_LOGOUT_MESSAGE;
      handleSessionEnded(msg);
    };
    window.addEventListener('leavecore:unauthorized', onUnauthorized);
    return () => window.removeEventListener('leavecore:unauthorized', onUnauthorized);
  }, [handleSessionEnded]);

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
        setView('dashboard');
      } else {
        setView('portal');
      }
    }
  }, [currentUser]);

  const handleLogout = async () => {
    await logoutUserSession();
    clearLocalAuthState(null);
    sessionStorage.removeItem('leavecore_logout_notice');
    setLogoutNotice('');
    localStorage.setItem(
      'leavecore_logout_broadcast',
      JSON.stringify({ timestamp: Date.now(), reason: null })
    );
    handleSessionEnded(null);
  };

  if (!currentUser) {
    return (
      <LoginPage
        logoutNotice={logoutNotice}
        onClearNotice={() => {
          setLogoutNotice('');
          sessionStorage.removeItem('leavecore_logout_notice');
        }}
        onLoginSuccess={(user) => {
          setLogoutNotice('');
          sessionStorage.removeItem('leavecore_logout_notice');
          setCurrentUser(user);
        }}
      />
    );
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
            <div className="flex flex-1 md:flex-initial gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto">
              <button
                onClick={() => setView('dashboard')}
                className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  view === 'dashboard'
                    ? 'bg-white text-[#1178a4] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 shrink-0" />
                <span>Dashboard</span>
              </button>

              {isManagement && (
                <>
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
                </>
              )}

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

            {/* User Profile & Logout */}
            <div className="flex items-center gap-2 sm:gap-3 border-l pl-2 sm:pl-4 border-slate-200">
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
        {view === 'dashboard' ? (
          <OverviewDashboard
            currentUser={currentUser}
            employees={employees}
            leaveRequests={leaveRequests}
            onNavigate={isManagement ? setView : undefined}
          />
        ) : view === 'records' && isManagement ? (
          <HRDashboard
            currentUser={currentUser}
            employees={employees}
            onRefresh={loadData}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onShowDialog={setDialogData}
          />
        ) : view === 'approvals' && isManagement ? (
          <LeaveApprovals
            currentUser={currentUser}
            leaveRequests={leaveRequests}
            onRefresh={loadData}
            onShowDialog={setDialogData}
          />
        ) : (
          <EmployeePortal
            currentUser={currentUser}
            employees={employees}
            leaveRequests={leaveRequests}
            onRefresh={loadData}
            onBreachDetected={setBreachData}
            onShowDialog={setDialogData}
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

      {dialogData && (
        <DialogModal
          dialog={dialogData}
          onClose={() => setDialogData(null)}
        />
      )}

      <IdleWarningModal
        isOpen={isWarningOpen}
        remainingSeconds={remainingSeconds}
        onStaySignedIn={handleStaySignedIn}
        onLogoutNow={handleLogoutNow}
      />
    </div>
  );
}