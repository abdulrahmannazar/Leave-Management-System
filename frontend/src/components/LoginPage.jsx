import React, { useState } from 'react';
import { Lock, Mail, User, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { loginUser, registerUser } from '../api';

const DEPARTMENTS = ['Audit', 'Tax', 'Secretarial', 'HR', 'Accounting'];

const ROLES = [
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'MANAGER', label: 'Department Manager (Max 1 per Dept)' },
  { value: 'HR', label: 'HR Officer' },
  { value: 'ADMIN', label: 'Admin' }
];

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Register State
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState('SUPERVISOR');
  const [regDept, setRegDept] = useState('Audit');
  const [allowedAnnual, setAllowedAnnual] = useState(14);
  const [allowedCasual, setAllowedCasual] = useState(7);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginUser({ identifier, password });
      if (res.error) {
        setError(res.error);
      } else {
        localStorage.setItem('leavecore_token', res.token);
        localStorage.setItem('leavecore_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError('Unable to reach server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await registerUser({
        name: regName,
        email: regEmail,
        password: regPassword,
        role: regRole,
        dept: regDept,
        allowedAnnual,
        allowedCasual
      });
      if (res.error) {
        setError(res.error);
      } else {
        localStorage.setItem('leavecore_token', res.token);
        localStorage.setItem('leavecore_user', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError('Registration failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <img
            src="/logo.png"
            alt="Frontier Advisory Logo"
            className="h-24 w-auto object-contain bg-white p-2 rounded-2xl shadow-sm border border-slate-200"
          />
        </div>
        <h2 className="mt-4 text-center text-2xl font-extrabold text-[#1178a4]">
          Leave Management System
        </h2>
        <p className="mt-1 text-center text-sm text-slate-500">
          Departmental Leave & Attendance Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-200">
          
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); }}
              className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
                mode === 'login' ? 'bg-white text-[#1178a4] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); }}
              className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
                mode === 'register' ? 'bg-white text-[#1178a4] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Management Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
              ⚠️ {error}
            </div>
          )}

          {mode === 'login' ? (
            /* ==================== LOGIN FORM ==================== */
            <form className="space-y-5" onSubmit={handleLogin}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Email or Employee ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter your email or ID"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-[#1178a4] hover:bg-[#0e6388] transition disabled:opacity-50"
              >
                {loading ? 'Signing in...' : 'Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* ==================== REGISTER FORM ==================== */
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-[11px] text-[#0e6388]">
                <strong>Note:</strong> Employee accounts are created by HR, Department Managers, or Supervisors inside the portal.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="john@company.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Create a password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Role
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => {
                      setRegRole(e.target.value);
                      if (e.target.value === 'HR') setRegDept('HR');
                    }}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Department
                  </label>
                  <select
                    value={regDept}
                    onChange={(e) => setRegDept(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-[#1178a4] focus:outline-none"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Allowed Annual
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={allowedAnnual}
                    onChange={(e) => setAllowedAnnual(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
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
                    value={allowedCasual}
                    onChange={(e) => setAllowedCasual(e.target.value)}
                    className="block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-[#1178a4] hover:bg-[#0e6388] transition disabled:opacity-50 mt-2"
              >
                {loading ? 'Creating Account...' : 'Register & Sign In'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}