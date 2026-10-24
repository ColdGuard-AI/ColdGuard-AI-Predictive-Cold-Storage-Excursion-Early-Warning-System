/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — Role-Based Auth Gateway
   Premium Arctic Blue Design System
   Palette:
     Primary Blue:     #2563EB
     Sky Blue:         #38BDF8
     Ice Blue:         #EFF6FF
     Page Background:  #F1F7FF
     White:            #FFFFFF
     Navy Text:        #0F172A
     Secondary Text:   #475569
     Subtle Borders:   #DCE8F6
───────────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  User,
  UserPlus,
  XCircle,
} from "lucide-react";
import { auth, setAuthToken } from "../services/api";

// ── Types ────────────────────────────────────────────────────────────────────
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  actual_role: string;
  role_display: string;
  company_id: string;
  company_name: string;
  assigned_facilities: string[];
  approval_status: string;
}

export interface AuthSession {
  token: string;
  user: SessionUser;
  facility: any;
  dashboard_route: string;
  must_change_password: boolean;
}

interface Props {
  onLoginSuccess: (session: AuthSession) => void;
}

// ── Role Definitions ─────────────────────────────────────────────────────────
const ROLES = [
  {
    id: "cold_storage_manager",
    title: "Cold Storage Manager",
    icon: ShieldCheck,
    badge: "Admin Only",
    description: "Full facility oversight, user approval requests, sensor alerts & financial inventory risk.",
    registrationAllowed: false,
    sampleEmail: "ruchita4@company.org.in",
  },
  {
    id: "facility_operator",
    title: "Facility Operator",
    subtitle: "Maintenance Technician",
    icon: Cpu,
    description: "Live sensor telemetry, 3D Digital Twin, equipment diagnostics, AI root cause analysis and SOPs.",
    registrationAllowed: true,
    sampleEmail: "operator@coldguard.ai",
  },
  {
    id: "government_auditor",
    title: "Government / Quality Auditor",
    icon: ClipboardCheck,
    description: "Regulatory compliance verification, Merkle blockchain audit trails and formal inspection reports.",
    registrationAllowed: true,
    sampleEmail: "auditor@fda-quality.gov",
  },
  {
    id: "buyer_retailer",
    title: "Buyer / Retailer",
    icon: ShoppingBag,
    description: "Lot quality transparency, cold-chain excursion history and shipment acceptance sign-off.",
    registrationAllowed: true,
    sampleEmail: "buyer@freshmart-global.com",
  },
];

// ── Shared UI primitives ──────────────────────────────────────────────────────
function InputField({
  label, id, type = "text", value, onChange, placeholder, required, icon: Icon, extra
}: any) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm sm:text-base font-bold text-[#0F172A]">
        {label}{required && <span className="text-red-500 ml-1 font-bold">*</span>}
      </label>
      <div className="relative">
        {Icon && <Icon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#475569] pointer-events-none" />}
        <input
          id={id}
          type={isPass ? (show ? "text" : "password") : type}
          value={value}
          onChange={(e: any) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full rounded-xl border-2 border-[#DCE8F6] bg-white py-3 text-base font-medium text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] transition shadow-sm ${Icon ? "pl-11" : "pl-4"} ${isPass ? "pr-12" : "pr-4"} ${extra || ""}`}
        />
        {isPass && (
          <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#0F172A] p-1 cursor-pointer">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Alert({ kind, msg }: { kind: "error" | "success" | "info"; msg: string }) {
  const cfg = {
    error: { bg: "bg-red-50 border-red-200 text-red-800", icon: <XCircle size={18} className="shrink-0 mt-0.5 text-red-600" /> },
    success: { bg: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" /> },
    info: { bg: "bg-[#EFF6FF] border-[#BAE6FD] text-[#1E40AF]", icon: <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[#2563EB]" /> },
  }[kind];
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm sm:text-base font-medium ${cfg.bg}`}>
      {cfg.icon}<span>{msg}</span>
    </div>
  );
}

function Card({ children, className = "" }: any) {
  return (
    <div className={`rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card hover:shadow-arctic-hover transition-all ${className}`}>
      {children}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3.5">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#2563EB] border border-[#1D4ED8] shadow-md shadow-blue-500/20">
        <Snowflake size={24} className="text-white" />
      </div>
      <div className="leading-tight">
        <div className="text-xl font-extrabold text-[#0F172A] tracking-tight">ColdGuard <span className="text-[#2563EB]">AI</span></div>
        <div className="text-xs font-semibold text-[#475569] tracking-wide">Predictive Cold-Storage Intelligence</div>
      </div>
    </div>
  );
}

// ── Main Auth Gateway ─────────────────────────────────────────────────────────
export default function AuthGateway({ onLoginSuccess }: Props) {
  type View = "role-select" | "login" | "register" | "pending" | "rejected" | "change-password";
  const [view, setView] = useState<View>("role-select");
  const [selectedRole, setSelectedRole] = useState<typeof ROLES[0] | null>(null);
  const [pendingEmail, setPendingEmail] = useState("");
  const [rejectedReason, setRejectedReason] = useState("");
  const [tempSession, setTempSession] = useState<AuthSession | null>(null);

  // ── Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // ── Register state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regOrg, setRegOrg] = useState("");
  const [regContractCode, setRegContractCode] = useState("");
  const [regInstantVerified, setRegInstantVerified] = useState(false);
  const [regSession, setRegSession] = useState<AuthSession | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");

  // ── Change password state
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpLoading, setCpLoading] = useState(false);
  const [cpError, setCpError] = useState("");

  function handleRoleSelect(role: typeof ROLES[0]) {
    setSelectedRole(role);
    setLoginEmail(role.sampleEmail || "");
    setLoginPassword(
      role.id === "cold_storage_manager"
        ? "Manager123!"
        : role.id === "facility_operator"
        ? "Operator123!"
        : role.id === "government_auditor"
        ? "Auditor123!"
        : "Buyer123!"
    );
    setLoginError("");
    setRegName("");
    setRegEmail("");
    setRegPassword("");
    setRegPhone("");
    setRegOrg(role.id === "buyer_retailer" ? "Apex Global Perishables & Retail Hub" : "");
    setRegContractCode(role.id === "buyer_retailer" ? "CTR-RETAIL-9901" : "");
    setRegInstantVerified(false);
    setRegSession(null);
    setRegError("");
    setRegSuccess("");
    setView("login");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await auth.login({ email: loginEmail, password: loginPassword });
      setAuthToken(res.token);
      if (res.must_change_password) {
        setTempSession(res);
        setView("change-password");
      } else {
        onLoginSuccess(res);
      }
    } catch (err: any) {
      const msg: string = err?.message ?? "Login failed.";
      if (msg.includes("pending")) { setPendingEmail(loginEmail); setView("pending"); }
      else if (msg.includes("rejected")) { setRejectedReason(msg); setView("rejected"); }
      else if (msg.includes("suspended")) { setRejectedReason(msg); setView("rejected"); }
      else setLoginError(msg);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRole) return;
    setRegLoading(true);
    setRegError(""); setRegSuccess("");
    try {
      const res = await auth.register({
        full_name: regName,
        email: regEmail,
        password: regPassword,
        phone: regPhone || undefined,
        requested_role: selectedRole.id,
        organization: regOrg || undefined,
        contract_code: regContractCode || undefined,
      });

      if (res.status === "APPROVED" || res.instant_verified) {
        setRegInstantVerified(true);
        setRegSuccess(res.message || "Instant verification successful! Your account is active and verified.");
        if (res.session && res.token) {
          setRegSession(res.session);
        }
      } else {
        setRegInstantVerified(false);
        setRegSuccess("Registration submitted! Your account is pending approval by the Cold Storage Manager. Please check back after approval.");
      }
    } catch (err: any) {
      setRegError(err?.message ?? "Registration failed.");
    } finally {
      setRegLoading(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (cpNew !== cpConfirm) { setCpError("New passwords do not match."); return; }
    if (cpNew.length < 8) { setCpError("New password must be at least 8 characters."); return; }
    setCpLoading(true); setCpError("");
    try {
      await auth.changePassword({ email: tempSession!.user.email, current_password: cpCurrent, new_password: cpNew });
      const res = await auth.login({ email: tempSession!.user.email, password: cpNew });
      setAuthToken(res.token);
      onLoginSuccess(res);
    } catch (err: any) {
      setCpError(err?.message ?? "Failed to change password.");
    } finally {
      setCpLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col text-[#0F172A]"
      style={{
        backgroundColor: "#F1F7FF",
        backgroundImage: "radial-gradient(circle at 10% 15%, rgba(56, 189, 248, 0.12) 0px, transparent 50%), radial-gradient(circle at 90% 85%, rgba(37, 99, 235, 0.08) 0px, transparent 55%)"
      }}
    >
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#DCE8F6] px-6 py-4 flex items-center justify-between shadow-sm">
        <Brand />
        <div className="flex items-center gap-2.5 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1.5 text-xs sm:text-sm font-bold text-emerald-800 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          System Online
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-14">

        {/* ── ROLE SELECTION ───────────────────────────────────────────────── */}
        {view === "role-select" && (
          <div className="w-full max-w-4xl">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#EFF6FF] border border-[#DCE8F6] px-4 py-1.5 text-xs font-bold text-[#2563EB] mb-3 uppercase tracking-wider">
                Industrial Intelligence SaaS
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">Select Your Role</h1>
              <p className="mt-3 text-base sm:text-lg text-[#475569] font-medium">Choose your authorized credentials to access the ColdGuard AI operational dashboard.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {ROLES.map((role) => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role)}
                    className="group relative flex flex-col gap-4 rounded-2xl border border-[#DCE8F6] hover:border-[#38BDF8] bg-white p-6 sm:p-7 text-left shadow-arctic-card hover:shadow-arctic-hover transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#38BDF8]/30 cursor-pointer"
                  >
                    {role.badge && (
                      <span className="absolute top-5 right-5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm">
                        {role.badge}
                      </span>
                    )}
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 rounded-2xl bg-[#EFF6FF] border border-[#DCE8F6] text-[#2563EB] flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 group-hover:bg-[#DBEAFE] transition-all">
                        <Icon size={26} />
                      </div>
                      <div>
                        <div className="font-bold text-[#0F172A] text-lg sm:text-xl group-hover:text-[#2563EB] transition-colors leading-snug">
                          {role.title}
                        </div>
                        {role.subtitle && (
                          <div className="text-xs sm:text-sm font-semibold text-[#475569] mt-0.5">
                            {role.subtitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-sm sm:text-base text-[#475569] leading-relaxed font-normal">
                      {role.description}
                    </p>

                    <div className="flex items-center gap-1.5 text-[#2563EB] group-hover:text-[#1D4ED8] text-sm sm:text-base font-bold mt-auto pt-3 border-t border-[#DCE8F6]">
                      <span>{role.registrationAllowed ? "Sign In or Register" : "Sign In (Provisioned Access)"}</span>
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── LOGIN ────────────────────────────────────────────────────────── */}
        {view === "login" && selectedRole && (
          <Card className="w-full max-w-lg p-8 sm:p-10">
            <button
              onClick={() => setView("role-select")}
              className="flex items-center gap-2 text-[#2563EB] hover:text-[#1D4ED8] text-sm sm:text-base font-bold mb-6 transition cursor-pointer"
            >
              <ArrowLeft size={18} /> Back to roles
            </button>

            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[#DCE8F6]">
              <div className="h-12 w-12 rounded-2xl bg-[#EFF6FF] border border-[#DCE8F6] text-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
                <selectedRole.icon size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-[#0F172A]">Sign In</h2>
                <p className="text-sm font-semibold text-[#475569]">{selectedRole.title}</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <InputField
                label="Organization Email Address"
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={setLoginEmail}
                placeholder="you@organization.com"
                required
                icon={Mail}
              />
              <InputField
                label="Password"
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={setLoginPassword}
                placeholder="Enter password (e.g. ColdGuard@2026! or Manager123!)"
                required
                icon={Lock}
              />

              {loginError && <Alert kind="error" msg={loginError} />}

              <button
                type="submit"
                disabled={loginLoading}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-bold py-3.5 text-base shadow-md hover:shadow-lg transition disabled:opacity-60 cursor-pointer"
              >
                {loginLoading ? <span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <LogIn size={18} />}
                {loginLoading ? "Authenticating…" : "Sign In to Dashboard"}
              </button>
            </form>

            {/* Quick credentials hint for evaluation */}
            {selectedRole.id === "cold_storage_manager" && (
              <div className="mt-5 p-3.5 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-xs sm:text-sm text-[#1E40AF] flex items-start gap-2.5">
                <KeyRound size={16} className="text-[#2563EB] shrink-0 mt-0.5" />
                <div className="space-y-1.5 w-full">
                  <div>
                    <strong>Manager Passwords:</strong> <code>Manager123!</code> or <code>ColdGuard@2026!</code>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => { setLoginPassword("Manager123!"); setLoginError(""); }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#BAE6FD] text-xs font-bold text-[#2563EB] hover:bg-[#DBEAFE] cursor-pointer shadow-sm transition"
                    >
                      Fill Manager123!
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLoginPassword("ColdGuard@2026!"); setLoginError(""); }}
                      className="px-2.5 py-1 rounded-lg bg-white border border-[#BAE6FD] text-xs font-bold text-[#2563EB] hover:bg-[#DBEAFE] cursor-pointer shadow-sm transition"
                    >
                      Fill ColdGuard@2026!
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedRole.registrationAllowed && (
              <div className="mt-6 pt-6 border-t border-[#DCE8F6] text-center">
                <p className="text-sm sm:text-base text-[#475569] font-medium">Don't have an approved account?</p>
                <button
                  onClick={() => { setRegEmail(loginEmail); setView("register"); }}
                  className="mt-3 flex items-center justify-center gap-2 w-full rounded-xl border border-[#DCE8F6] bg-[#F1F7FF] hover:bg-[#EFF6FF] text-[#2563EB] font-bold py-3 text-sm sm:text-base transition cursor-pointer"
                >
                  <UserPlus size={18} /> Register as {selectedRole.title}
                </button>
              </div>
            )}
            {!selectedRole.registrationAllowed && (
              <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-[#DCE8F6] text-center text-xs text-[#475569] font-medium">
                Cold Storage Manager accounts are provisioned securely by system administrators.
              </div>
            )}
          </Card>
        )}

        {/* ── REGISTER ─────────────────────────────────────────────────────── */}
        {view === "register" && selectedRole && (
          <Card className="w-full max-w-lg p-8 sm:p-10">
            <button
              onClick={() => { setRegSuccess(""); setView("login"); }}
              className="flex items-center gap-2 text-[#2563EB] hover:text-[#1D4ED8] text-sm sm:text-base font-bold mb-6 transition cursor-pointer"
            >
              <ArrowLeft size={18} /> Back to sign in
            </button>

            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[#DCE8F6]">
              <div className="h-12 w-12 rounded-2xl bg-[#EFF6FF] border border-[#DCE8F6] text-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
                <UserPlus size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-[#0F172A]">Request Access</h2>
                <p className="text-sm font-semibold text-[#475569]">{selectedRole.title}</p>
              </div>
            </div>

            {regSuccess ? (
              <div className="flex flex-col items-center gap-4 py-6 text-center">
                <div className={`h-16 w-16 rounded-full flex items-center justify-center shadow-sm ${
                  regInstantVerified ? "bg-emerald-50 border border-emerald-200 text-[#0D9488]" : "bg-blue-50 border border-blue-200 text-[#2563EB]"
                }`}>
                  <ShieldCheck size={36} />
                </div>
                <h3 className="text-xl font-bold text-[#0F172A]">
                  {regInstantVerified ? "Instant Verification Approved!" : "Registration Submitted"}
                </h3>
                <p className="text-base text-[#475569] leading-relaxed max-w-sm">{regSuccess}</p>
                <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full justify-center">
                  {regInstantVerified && regSession ? (
                    <button
                      onClick={() => {
                        setAuthToken(regSession.token);
                        onLoginSuccess(regSession);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-base transition shadow-sm cursor-pointer"
                    >
                      Enter Buyer Portal Directly →
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      setLoginEmail(regEmail);
                      setLoginPassword(regPassword);
                      setRegSuccess("");
                      setView("login");
                    }}
                    className="px-6 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-base transition shadow-sm cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">

                <InputField label="Full Name" id="reg-name" value={regName} onChange={setRegName} placeholder="Dr. / Mr. / Ms. Full Name" required icon={User} />
                <InputField label="Organization Email Address" id="reg-email" type="email" value={regEmail} onChange={setRegEmail} placeholder="you@organization.com" required icon={Mail} />
                <InputField label="Phone Number" id="reg-phone" type="tel" value={regPhone} onChange={setRegPhone} placeholder="+91 XXXXX XXXXX" icon={Phone} />

                <div>
                  <InputField label="Organization / Company" id="reg-org" value={regOrg} onChange={setRegOrg} placeholder="e.g. Apex Global Perishables & Retail Hub" />
                  {selectedRole.id === "buyer_retailer" && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-[#64748B]">Verified Partners:</span>
                      {[
                        "Apex Global Perishables & Retail Hub",
                        "Metro Health Hospital Network",
                        "FreshMart Supermarkets Supply Alliance",
                        "Nordic Frost Logistics Corp",
                      ].map((orgName) => (
                        <button
                          key={orgName}
                          type="button"
                          onClick={() => setRegOrg(orgName)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer border ${
                            regOrg === orgName
                              ? "bg-[#0D9488] text-white border-[#0D9488]"
                              : "bg-[#F1F7FF] text-[#475569] border-[#DCE8F6] hover:bg-[#E2E8F0]"
                          }`}
                        >
                          {orgName.split(" ")[0]} ({orgName.includes("Hospital") ? "Hospital" : "Retail"})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedRole.id === "buyer_retailer" && (
                  <div>
                    <InputField
                      label="Partner Wholesale Contract Code"
                      id="reg-contract-code"
                      value={regContractCode}
                      onChange={setRegContractCode}
                      placeholder="e.g. CTR-RETAIL-9901 or CONTRACT-2026-NORDIC"
                      icon={KeyRound}
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#64748B]">
                      <span>Valid Codes:</span>
                      {["CTR-RETAIL-9901", "CONTRACT-2026-NORDIC", "CTR-BIOPHARMA-2026"].map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => setRegContractCode(code)}
                          className="font-mono text-[10px] font-bold text-[#0D9488] bg-[#0D9488]/10 hover:bg-[#0D9488]/20 px-1.5 py-0.5 rounded transition cursor-pointer"
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <InputField label="Create Password" id="reg-password" type="password" value={regPassword} onChange={setRegPassword} placeholder="Minimum 8 characters" required icon={Lock} />

                {selectedRole.id !== "buyer_retailer" && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs sm:text-sm font-medium text-amber-900 leading-relaxed">
                    <strong>Notice:</strong> Internal staff registrations remain in a pending state until reviewed and approved by the Cold Storage Manager.
                  </div>
                )}

                {regError && <Alert kind="error" msg={regError} />}

                <button
                  type="submit"
                  disabled={regLoading}
                  className={`mt-2 w-full flex items-center justify-center gap-2 rounded-xl text-white font-bold py-3.5 text-base shadow-md hover:shadow-lg transition disabled:opacity-60 cursor-pointer ${
                    selectedRole.id === "buyer_retailer"
                      ? "bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59]"
                      : "bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF]"
                  }`}
                >
                  {regLoading ? (
                    <span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <UserPlus size={18} />
                  )}
                  {regLoading
                    ? "Submitting application…"
                    : selectedRole.id === "buyer_retailer"
                    ? "Verify & Activate Buyer Account"
                    : "Submit Access Request"}
                </button>
              </form>
            )}
          </Card>
        )}

        {/* ── PENDING ──────────────────────────────────────────────────────── */}
        {view === "pending" && (
          <Card className="w-full max-w-lg p-8 sm:p-10 text-center">
            <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-sm">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0F172A] mb-2">Account Approval Pending</h2>
            <p className="text-base text-[#475569] mb-2">Your registration for</p>
            <div className="inline-block bg-[#EFF6FF] border border-[#DCE8F6] text-[#2563EB] font-bold px-4 py-1.5 rounded-xl text-base mb-4 font-mono">
              {pendingEmail}
            </div>
            <p className="text-base text-[#475569] leading-relaxed mb-6">
              is currently under review by the Cold Storage Manager. Once approved, you will be able to sign in and access your dashboard.
            </p>
            <button
              onClick={() => setView("role-select")}
              className="px-6 py-2.5 rounded-xl border border-[#DCE8F6] bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] font-bold text-base transition cursor-pointer"
            >
              ← Back to Role Selection
            </button>
          </Card>
        )}

        {/* ── REJECTED / SUSPENDED ─────────────────────────────────────────── */}
        {view === "rejected" && (
          <Card className="w-full max-w-lg p-8 sm:p-10 text-center">
            <div className="mx-auto mb-5 h-16 w-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shadow-sm">
              <XCircle size={32} />
            </div>
            <h2 className="text-2xl font-extrabold text-[#0F172A] mb-3">Access Denied</h2>
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-base font-semibold text-red-800 mb-4 leading-relaxed">
              {rejectedReason}
            </div>
            <p className="text-sm text-[#475569] mb-6">
              Please contact your facility administrator or compliance supervisor if you believe this is in error.
            </p>
            <button
              onClick={() => setView("role-select")}
              className="px-6 py-2.5 rounded-xl border border-[#DCE8F6] hover:bg-slate-100 text-[#0F172A] font-bold text-base transition cursor-pointer"
            >
              ← Back to Role Selection
            </button>
          </Card>
        )}

        {/* ── CHANGE PASSWORD ───────────────────────────────────────────────── */}
        {view === "change-password" && tempSession && (
          <Card className="w-full max-w-lg p-8 sm:p-10">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[#DCE8F6]">
              <div className="h-12 w-12 rounded-2xl bg-[#EFF6FF] border border-[#DCE8F6] text-[#2563EB] flex items-center justify-center shrink-0 shadow-sm">
                <Lock size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-[#0F172A]">Set New Password</h2>
                <p className="text-sm font-semibold text-[#475569]">First-time authentication requirement</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#EFF6FF] border border-[#DCE8F6] px-4 py-3 text-sm sm:text-base font-medium text-[#1E40AF] mb-5 leading-relaxed">
              Welcome, <strong>{tempSession.user.name}</strong>! Your account requires setting a permanent password before proceeding to the dashboard.
            </div>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <InputField
                label="Current (Temporary) Password"
                id="cp-current"
                type="password"
                value={cpCurrent}
                onChange={setCpCurrent}
                placeholder="Temporary password"
                required
                icon={Lock}
              />
              <InputField
                label="New Password"
                id="cp-new"
                type="password"
                value={cpNew}
                onChange={setCpNew}
                placeholder="Minimum 8 characters"
                required
                icon={Lock}
              />
              <InputField
                label="Confirm New Password"
                id="cp-confirm"
                type="password"
                value={cpConfirm}
                onChange={setCpConfirm}
                placeholder="Repeat new password"
                required
                icon={Lock}
              />

              {cpError && <Alert kind="error" msg={cpError} />}

              <button
                type="submit"
                disabled={cpLoading}
                className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold py-3.5 text-base shadow-md transition disabled:opacity-60 cursor-pointer"
              >
                {cpLoading ? <span className="h-5 w-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={18} />}
                {cpLoading ? "Updating password…" : "Save Password & Proceed"}
              </button>
            </form>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-5 text-xs sm:text-sm text-[#475569] font-medium border-t border-[#DCE8F6] bg-white/80">
        ColdGuard AI — Predictive Cold-Storage Intelligence · Continuous GxP Compliance Telemetry · Machine Learning Excursion Forecasting
      </footer>
    </div>
  );
}
