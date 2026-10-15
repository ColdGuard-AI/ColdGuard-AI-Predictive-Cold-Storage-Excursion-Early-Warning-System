import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  ShieldAlert, 
  UserPlus, 
  KeyRound,
  ShieldCheck,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import RoleCard from './RoleCard';
import { ROLES, PRESET_FACILITIES, DEMO_PRESETS } from '../data/mockData';

export default function LoginForm({ 
  onLoginSuccess, 
  onOpenRegisterCompany, 
  onOpenRequestAccess, 
  onOpenForgotPassword,
  initialCredentials 
}) {
  const [selectedRole, setSelectedRole] = useState('cold_storage_manager');
  const [facilityId, setFacilityId] = useState('FAC-CHILL-8092');
  const [companyId, setCompanyId] = useState('');
  const [email, setEmail] = useState('manager@coldguard.ai');
  const [password, setPassword] = useState('Manager123!');
  const [showPassword, setShowPassword] = useState(false);
  const [customFacilityMode, setCustomFacilityMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [verifyingStep, setVerifyingStep] = useState(null);
  const [error, setError] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);

  // If initialCredentials passed from registration or access request
  useEffect(() => {
    if (initialCredentials) {
      if (initialCredentials.email) setEmail(initialCredentials.email);
      if (initialCredentials.password) setPassword(initialCredentials.password);
      if (initialCredentials.facilityId) setFacilityId(initialCredentials.facilityId);
      if (initialCredentials.companyId) setCompanyId(initialCredentials.companyId);
      if (initialCredentials.role) setSelectedRole(initialCredentials.role);
    }
  }, [initialCredentials]);

  // When a preset facility is picked, update companyId
  const handleFacilitySelect = (e) => {
    const facVal = e.target.value;
    if (facVal === 'CUSTOM') {
      setCustomFacilityMode(true);
      setFacilityId('');
      setCompanyId('');
    } else {
      setCustomFacilityMode(false);
      setFacilityId(facVal);
      const found = PRESET_FACILITIES.find(f => f.id === facVal);
      if (found) {
        setCompanyId(found.companyId);
      }
    }
  };

  // Quick fill from Role Card
  const handleRoleCardSelect = (roleId) => {
    setSelectedRole(roleId);
  };

  const handleQuickFillRole = (role) => {
    setSelectedRole(role.id);
    setEmail(role.demoEmail);
    setPassword(role.demoPass);
    setFacilityId(role.defaultFacility);
    const found = PRESET_FACILITIES.find(f => f.id === role.defaultFacility);
    if (found) {
      setCompanyId(found.companyId);
    }
    setError(null);
  };

  // Quick Demo Preset loader
  const handleApplyPreset = (preset) => {
    setSelectedRole(preset.role);
    setEmail(preset.email);
    setPassword(preset.password);
    setFacilityId(preset.facilityId);
    setCompanyId(preset.companyId);
    setError(null);
  };

  // Submit Handler calling FastAPI
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrorDetails(null);

    // Visual sequence showing zero-trust backend verification
    setVerifyingStep('Verifying cryptographic credentials...');

    try {
      await new Promise(r => setTimeout(r, 250));
      setVerifyingStep('Validating facility membership & tenant boundary...');

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          facility_id: facilityId.trim(),
          company_id: companyId.trim() || undefined,
          selected_role: selectedRole
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      setVerifyingStep('Enforcing authoritative database clearance...');
      await new Promise(r => setTimeout(r, 200));

      if (onLoginSuccess) {
        onLoginSuccess(data);
      }
    } catch (err) {
      setError(err.message);
      // Check if it was an approval issue
      if (err.message.includes('Approval Pending')) {
        setErrorDetails({
          type: 'PENDING_APPROVAL',
          email: email
        });
      }
    } finally {
      setLoading(false);
      setVerifyingStep(null);
    }
  };

  const selectedFacilityObj = PRESET_FACILITIES.find(f => f.id === facilityId);

  return (
    <div className="flex flex-col justify-between p-6 sm:p-8 lg:p-10 font-sans max-w-2xl mx-auto w-full">
      {/* Top Header & Fast Switcher */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981] animate-pulse"></span>
              <span className="text-xs font-mono font-semibold tracking-wider text-emerald-400 uppercase">
                Zero-Trust Gateway Online
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1 m-0 p-0">
              Sign In to ColdGuard AI
            </h2>
          </div>

          {/* Quick Links for Registration & Request Access */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            <button
              type="button"
              onClick={onOpenRegisterCompany}
              className="text-cyan-400 hover:text-cyan-300 transition underline underline-offset-4 cursor-pointer"
            >
              + Register Company
            </button>
            <span className="text-slate-600">|</span>
            <button
              type="button"
              onClick={onOpenRequestAccess}
              className="text-slate-300 hover:text-cyan-300 transition underline underline-offset-4 cursor-pointer"
            >
              Request Access
            </button>
          </div>
        </div>

        {/* Demo Preset Quick-Selector Bar */}
        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/20 text-xs font-mono">
          <div className="flex items-center justify-between mb-1.5 text-slate-400 text-[11px]">
            <span className="flex items-center text-cyan-300">
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              1-Click Test Scenarios:
            </span>
            <span className="text-slate-400 text-[10px]">Click any persona to pre-fill</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_PRESETS.map((demo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(demo)}
                className={`px-2 py-1 rounded text-[10px] font-semibold transition cursor-pointer flex items-center space-x-1 ${
                  email === demo.email && facilityId === demo.facilityId
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_8px_rgba(34,211,238,0.4)]'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                }`}
                title={demo.note}
              >
                <span>{demo.label.split(' ')[0]}</span>
                {demo.status === 'PENDING_APPROVAL' && (
                  <span className="text-[9px] px-1 rounded bg-amber-900/80 text-amber-300 ml-1">Gate</span>
                )}
                {demo.status === 'UNAUTHORIZED_FACILITY' && (
                  <span className="text-[9px] px-1 rounded bg-rose-900/80 text-rose-300 ml-1">Mismatch</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* SECTION: 4 ROLE CARDS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center">
              <span>Select Intended Role</span>
              <span className="ml-2 text-[10px] text-slate-400 font-normal">
                (FastAPI will verify actual assigned clearance)
              </span>
            </label>
            <span className="text-[10px] font-mono text-cyan-400">4 Clearances Available</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLES.map((role) => (
              <RoleCard
                key={role.id}
                role={role}
                isSelected={selectedRole === role.id}
                onSelect={handleRoleCardSelect}
                onQuickFill={handleQuickFillRole}
              />
            ))}
          </div>
        </div>

        {/* SECTION: LOGIN FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-xs space-y-2">
              <div className="flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold font-mono">Authentication Denied:</span>
                  <p className="leading-relaxed">{error}</p>
                </div>
              </div>

              {errorDetails?.type === 'PENDING_APPROVAL' && (
                <div className="pt-2 border-t border-rose-900/50 flex justify-end">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/admin/approve-user?email=${encodeURIComponent(errorDetails.email)}`, { method: 'POST' });
                      setError(null);
                      setErrorDetails(null);
                      // Trigger login immediately
                      alert('Account has been approved by Facility Admin! Click Sign In again.');
                    }}
                    className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-[11px] font-mono transition cursor-pointer"
                  >
                    Simulate Admin Approval for {errorDetails.email}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FACILITY SELECTION & COMPANY ID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Facility ID */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300 flex items-center">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Facility ID
                </label>
                <button
                  type="button"
                  onClick={() => setCustomFacilityMode(!customFacilityMode)}
                  className="text-[10px] text-cyan-400 hover:underline cursor-pointer"
                >
                  {customFacilityMode ? 'Use Preset List' : 'Enter Custom ID'}
                </button>
              </div>

              {customFacilityMode ? (
                <input
                  type="text"
                  required
                  placeholder="e.g. FAC-CHILL-8092"
                  value={facilityId}
                  onChange={(e) => setFacilityId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono text-xs transition"
                />
              ) : (
                <div className="relative">
                  <select
                    value={facilityId}
                    onChange={handleFacilitySelect}
                    className="w-full appearance-none px-3 py-2 pr-8 rounded-lg bg-slate-950/80 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs transition cursor-pointer"
                  >
                    {PRESET_FACILITIES.map((fac) => (
                      <option key={fac.id} value={fac.id}>
                        {fac.id} ({fac.temp})
                      </option>
                    ))}
                    <option value="CUSTOM">+ Enter Other Facility ID...</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
                </div>
              )}

              {/* Facility details sub-pill */}
              {selectedFacilityObj && !customFacilityMode && (
                <div className="mt-1 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                  <span className="truncate max-w-[160px]">{selectedFacilityObj.name}</span>
                  <span className="text-emerald-400 font-semibold">{selectedFacilityObj.temp} [SAFE]</span>
                </div>
              )}
            </div>

            {/* Company ID (Optional if user selects facility directly) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300 flex items-center">
                  <Building2 className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Company ID
                </label>
                <span className="text-[10px] text-slate-400 font-mono italic">
                  (Optional)
                </span>
              </div>
              <input
                type="text"
                placeholder={selectedFacilityObj ? selectedFacilityObj.companyId : "COMP-NORDIC-01"}
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-mono text-xs transition"
              />
              <span className="block text-[10px] text-slate-400 mt-1">
                Auto-resolved if facility is selected directly.
              </span>
            </div>
          </div>

          {/* REGISTERED EMAIL */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Registered Corporate Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                placeholder="name@coldguard.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs transition"
              />
            </div>
          </div>

          {/* PASSWORD WITH SHOW/HIDE & FORGOT PASSWORD */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Encrypted Password
              </label>
              <button
                type="button"
                onClick={onOpenForgotPassword}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition underline underline-offset-2 cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 rounded-lg bg-slate-950/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono text-xs transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* SIGN IN BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(34,211,238,0.35)] hover:shadow-[0_0_35px_rgba(34,211,238,0.55)] transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  <span className="font-mono text-xs font-bold">
                    {verifyingStep || 'Authenticating...'}
                  </span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  <span>Sign In to ColdGuard AI</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Security Rule Assurance Footnote */}
        <div className="pt-2 text-[10px] font-mono text-slate-400 text-center leading-relaxed">
          <p>
            Cryptographic Security Rule: Access permissions and dashboard routing are strictly evaluated against the authoritative backend ledger. Client role selections cannot escalate privileges.
          </p>
        </div>
      </div>
    </div>
  );
}
