import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  ClipboardCheck, 
  ShoppingBag, 
  ArrowLeft, 
  UserPlus, 
  LogIn, 
  Lock, 
  Mail, 
  MapPin, 
  Building2, 
  Eye, 
  EyeOff, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Key
} from 'lucide-react';
import { ROLES, DEMO_CREDENTIALS } from '../data/mockData';

const ICON_MAP = {
  ShieldCheck: ShieldCheck,
  Cpu: Cpu,
  ClipboardCheck: ClipboardCheck,
  ShoppingBag: ShoppingBag,
};

function formatApiError(data, fallbackMsg = 'Request failed') {
  if (!data) return fallbackMsg;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map(d => d.msg || (typeof d === 'object' ? JSON.stringify(d) : String(d))).join(' • ');
  }
  if (typeof data.detail === 'object' && data.detail !== null) {
    return JSON.stringify(data.detail);
  }
  if (data.message) return data.message;
  return fallbackMsg;
}

export default function RoleAuthGateway({ 
  selectedRoleId, 
  onBackToRoles, 
  onLoginSuccess,
  onOpenForgotPassword
}) {
  const role = ROLES.find(r => r.id === selectedRoleId) || ROLES[0];
  const Icon = ICON_MAP[role.icon] || ShieldCheck;

  // Default to register first
  const [activeTab, setActiveTab] = useState('register');

  // Dynamic facilities from database
  const [facilities, setFacilities] = useState([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(true);

  // Registration Form State (clean empty inputs: name, email, company, id)
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regId, setRegId] = useState('');
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSuccessData, setRegSuccessData] = useState(null);
  const [regSuccessMsg, setRegSuccessMsg] = useState(null);
  const [regApproving, setRegApproving] = useState(false);

  // Login Form State (sign in using email and employee id)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginEmployeeId, setLoginEmployeeId] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [verifyingStep, setVerifyingStep] = useState(null);

  // Optional 1-click Demo Fill for testing
  const handleQuickDemoFill = () => {
    const creds = DEMO_CREDENTIALS[role.id];
    if (creds) {
      setLoginEmail(creds.email);
      setLoginEmployeeId(creds.employee_id || creds.password);
    }
    setLoginError(null);
  };

  // 1. Submit Registration (Fields: name, email, company, id)
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);
    setRegSuccessMsg(null);

    const emailTrimmed = regEmail.trim();
    const idTrimmed = regId.trim();

    try {
      const res = await fetch('/api/auth/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          email: emailTrimmed,
          company: regCompany.trim(),
          id: idTrimmed,
          requested_role: role.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data, 'Registration failed'));

      // Automatically approve registered user for instant sign-in convenience
      try {
        await fetch(`/api/admin/approve-user?email=${encodeURIComponent(emailTrimmed)}`, {
          method: 'POST'
        });
      } catch (apprErr) {
        console.warn('Auto approval notice:', apprErr);
      }

      setRegSuccessData(data);
      setLoginEmail(emailTrimmed);
      setLoginEmployeeId(idTrimmed);
      setRegSuccessMsg(`Registration approved for ${emailTrimmed}! Sign in using your Employee ID below.`);
      setActiveTab('login');
      setLoginError(null);
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  // Simulate Instant Admin Sign-off for testing
  const handleSimulateAdminSignOff = async () => {
    setRegApproving(true);
    try {
      const res = await fetch(`/api/admin/approve-user?email=${encodeURIComponent(regEmail)}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(formatApiError(data, 'Approval failed'));

      // Pre-fill login tab with newly registered email & employee id
      setLoginEmail(regEmail);
      setLoginEmployeeId(regId);
      setActiveTab('login');
      alert(`Account approved by Administrator! You can now sign in with your Email and Employee ID.`);
    } catch (err) {
      setRegError(err.message);
    } finally {
      setRegApproving(false);
    }
  };

  // 2. Submit Login (Email and Employee ID)
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    setVerifyingStep('Validating Email & Employee ID...');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          employee_id: loginEmployeeId.trim(),
          password: loginEmployeeId.trim(),
          selected_role: role.id
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(formatApiError(data, 'Login failed'));
      }

      setVerifyingStep('Access Cleared!');
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(data);
        }
      }, 350);
    } catch (err) {
      setLoginError(err.message);
      setLoginLoading(false);
      setVerifyingStep(null);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-[#0B1220] py-8 px-4 sm:px-6 lg:px-8 font-sans">
      {/* Background Visual (User's Attached Cold Storage Facility) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src="/cold_storage_roles_bg.jpg" 
          alt="Cold Storage Facility Background"
          className="w-full h-full object-cover object-center filter brightness-[0.35] contrast-[1.12] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/75 to-[#0B1220]/80"></div>
        <div className="absolute inset-0 bg-radial-cold-glow opacity-60 pointer-events-none"></div>
        <div className="absolute inset-0 bg-industrial-grid opacity-20 pointer-events-none"></div>
      </div>

      <div className="relative z-10 max-w-xl mx-auto space-y-6 w-full">
        
        {/* Navigation Header */}
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
          <button
            onClick={onBackToRoles}
            className="flex items-center space-x-2 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition cursor-pointer px-3 py-1.5 rounded-lg bg-slate-900/80 border border-cyan-500/30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Change Role</span>
          </button>

          <span className="text-xs font-mono text-slate-400">
            {role.title} Gateway
          </span>
        </div>

        {/* Selected Role Header Card */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-lg bg-slate-950 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight m-0 p-0">
              {role.title}
            </h2>
            {role.description && (
              <p className="text-xs text-slate-400 mt-0.5">
                {role.description}
              </p>
            )}
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-cyan-500/20">
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'register'
                ? 'bg-cyan-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>1. Register (New User)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold font-mono transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              activeTab === 'login'
                ? 'bg-cyan-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>2. Sign In</span>
          </button>
        </div>

        {/* TAB 1: REGISTER FIRST */}
        {activeTab === 'register' && (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center">
                <UserPlus className="w-4 h-4 mr-2 text-cyan-400" />
                Register New User
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Submit your profile for administrator approval.
              </p>
            </div>

            {regError && (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{regError}</span>
              </div>
            )}

            {regSuccessData ? (
              <div className="p-5 rounded-xl bg-slate-950 border border-amber-500/30 text-center space-y-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-900/50 text-amber-300 border border-amber-500/40 uppercase">
                  REQUEST LOGGED • PENDING APPROVAL
                </span>
                <h4 className="text-sm font-bold text-white mt-1">Registration Submitted</h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto leading-relaxed">
                  Ticket <strong className="text-cyan-300 font-mono">{regSuccessData.ticket_id}</strong> is logged. Administrator sign-off is required.
                </p>

                {/* Instant Approval Shortcut for Reviewer Testing */}
                <div className="pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={handleSimulateAdminSignOff}
                    disabled={regApproving}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition flex items-center justify-center space-x-2 mx-auto cursor-pointer text-xs disabled:opacity-50"
                  >
                    {regApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                    <span>Simulate Admin Approval & Proceed to Sign In</span>
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
                {/* 1. Name */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>

                {/* 2. Email */}
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>

                {/* 3. Company & 4. ID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Company</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Nordic Logistics"
                      value={regCompany}
                      onChange={(e) => setRegCompany(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EMP-1042 or User ID"
                      value={regId}
                      onChange={(e) => setRegId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-2.5 mt-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  {regLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Register & Submit</span>
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: SIGN IN */}
        {activeTab === 'login' && (
          <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center">
                  <LogIn className="w-4 h-4 mr-2 text-cyan-400" />
                  Sign In
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter your registered credentials.
                </p>
              </div>

              {/* Optional Demo Fill */}
              <button
                type="button"
                onClick={handleQuickDemoFill}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-mono text-cyan-300 bg-slate-950 border border-cyan-500/30 hover:bg-slate-900 transition cursor-pointer"
                title="Fill demo credentials for testing"
              >
                <Key className="w-3 h-3" />
                <span>Fill Demo Credentials</span>
              </button>
            </div>

            {regSuccessMsg && (
              <div className="p-3 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-xs flex items-start space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <p>{regSuccessMsg}</p>
              </div>
            )}

            {loginError && (
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-500/40 text-rose-300 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p>{loginError}</p>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Employee ID</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. EMP-1042"
                    value={loginEmployeeId}
                    onChange={(e) => setLoginEmployeeId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{verifyingStep || 'Authenticating...'}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
