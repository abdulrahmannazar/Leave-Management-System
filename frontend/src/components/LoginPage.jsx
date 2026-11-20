import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ArrowRight, Clock } from 'lucide-react';
import { loginUser } from '../api';

export default function LoginPage({ onLoginSuccess, logoutNotice, onClearNotice }) {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (onClearNotice) onClearNotice();
    sessionStorage.removeItem('leavecore_logout_notice');
    setLoading(true);
    try {
      const res = await loginUser({ identifier, password });
      if (res.error) {
        setError(res.error);
      } else {
        localStorage.setItem('leavecore_token', res.token);
        localStorage.setItem('leavecore_user', JSON.stringify(res.user));
        localStorage.setItem('leavecore_last_activity', String(Date.now()));
        onLoginSuccess(res.user);
      }
    } catch (err) {
      setError('Unable to reach server. Please try again.');
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
          <div className="mb-6 text-center">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#1178a4]">
              Sign In to Your Account
            </h3>
          </div>

          {logoutNotice && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{logoutNotice}</span>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-600">
              ⚠️ {error}
            </div>
          )}

          {/* ==================== LOGIN FORM ==================== */}
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
        </div>
      </div>
    </div>
  );
}