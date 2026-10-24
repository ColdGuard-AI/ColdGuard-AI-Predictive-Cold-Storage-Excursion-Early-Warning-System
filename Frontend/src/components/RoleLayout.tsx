/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — Role-Aware Application Layout
   Premium Arctic Blue Design System
   Sidebar navigation varies by authenticated role.
───────────────────────────────────────────────────────────────────────────── */
import {
  Activity,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FlaskConical,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Package,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  Thermometer,
  Users,
  X,
  XCircle,
  Search,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "../hooks/AppContext";
import { fmtTime } from "../lib/format";
import type { AuthSession } from "../pages/AuthGateway";
import { auth } from "../services/api";

// ── Role-based nav configs ────────────────────────────────────────────────────
const NAV_BY_ROLE: Record<string, { to: string; label: string; icon: any }[]> = {
  cold_storage_manager: [
    { to: "/manager", label: "Overview Dashboard", icon: LayoutDashboard },
    { to: "/manager/alerts", label: "Alerts & Incidents", icon: BellRing },
    { to: "/manager/inventory", label: "Inventory & Financial Risk", icon: Package },
    { to: "/manager/users", label: "User Approval Requests", icon: Users },
  ],
  facility_operator: [
    { to: "/operator", label: "Live Telemetry Monitor", icon: LayoutDashboard },
    { to: "/operator/twin", label: "3D Digital Twin", icon: Layers },
    { to: "/operator/equipment", label: "Equipment & Sensor Health", icon: Cpu },
    { to: "/operator/alerts", label: "Alerts & Incidents", icon: BellRing },
    { to: "/operator/ai", label: "AI Diagnosis & SOPs", icon: BrainCircuit },
    { to: "/operator/what-if", label: "What-If Assistant", icon: FlaskConical },
  ],
  government_auditor: [
    { to: "/auditor", label: "Compliance Overview", icon: ShieldCheck },
    { to: "/auditor/blockchain", label: "Blockchain Audit Trails", icon: Lock },
    { to: "/auditor/reports", label: "Reports & Inspection", icon: ClipboardCheck },
  ],
  buyer_retailer: [
    { to: "/buyer", label: "Orders & Lot Quality", icon: ShoppingBag },
    { to: "/buyer/inventory", label: "Product & Lot Inventory", icon: Package },
    { to: "/buyer/quality", label: "Cold Chain Quality Alerts", icon: ShieldAlert },
  ],
};

const ROLE_COLOR: Record<string, string> = {
  cold_storage_manager: "bg-[#2563EB] text-white",
  facility_operator: "bg-[#0284C7] text-white",
  government_auditor: "bg-[#4F46E5] text-white",
  buyer_retailer: "bg-[#0D9488] text-white",
};

const ROLE_ICON: Record<string, any> = {
  cold_storage_manager: ShieldCheck,
  facility_operator: Cpu,
  government_auditor: ClipboardCheck,
  buyer_retailer: ShoppingBag,
};

// ── Brand ─────────────────────────────────────────────────────────────────────
function Brand() {
  return (
    <div className="flex items-center gap-3 px-2 pb-5">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/20 border border-white/30 shadow-md backdrop-blur-md">
        <Snowflake size={22} className="text-white animate-pulse" />
      </div>
      <div className="leading-tight">
        <div className="text-lg font-extrabold text-white tracking-tight">ColdGuard <span className="text-cyan-300">AI</span></div>
        <div className="text-xs font-semibold text-cyan-100/80">Industrial Cold Intelligence</div>
      </div>
    </div>
  );
}

// ── Sidebar Nav Items ─────────────────────────────────────────────────────────
function NavItems({ role, onNavigate, pendingCount }: { role: string; onNavigate?: () => void; pendingCount: number }) {
  const { zones } = useApp();
  const activeAlerts = zones?.reduce((n, z) => n + z.active_alert_count, 0) ?? 0;
  const navItems = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.facility_operator;

  return (
    <nav aria-label="Main" className="flex flex-col gap-1.5">
      {navItems.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to.split("/").length <= 2}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[15px] font-semibold transition-all ${
              isActive
                ? "bg-white/25 text-white font-bold backdrop-blur-md shadow-md border border-white/30"
                : "text-white/85 hover:bg-white/10 hover:text-white"
            }`
          }
        >
          <Icon size={19} className="shrink-0 transition-transform group-hover:scale-110 text-white" />
          <span className="flex-1 leading-tight">{label}</span>
          {(label.includes("Alerts") || label.includes("Incidents")) && activeAlerts > 0 && (
            <span className="rounded-full bg-rose-500/90 border border-white/40 px-2 py-0.5 text-xs font-bold text-white shadow-sm" aria-label={`${activeAlerts} active alerts`}>
              {activeAlerts}
            </span>
          )}
          {label === "User Approval Requests" && pendingCount > 0 && (
            <span id="pending-badge" className="rounded-full bg-amber-400 border border-white/50 px-2.5 py-0.5 text-xs font-bold text-slate-950 animate-pulse shadow-sm">
              {pendingCount}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// ── Toast notifications ───────────────────────────────────────────────────────
function Toaster() {
  const { toasts, dismiss } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold shadow-2xl ${
            t.kind === "error" ? "border-red-200 text-red-800" : t.kind === "success" ? "border-emerald-200 text-emerald-800" : "border-[#DCE8F6] text-[#0F172A]"
          }`}
          role={t.kind === "error" ? "alert" : "status"}
        >
          {t.kind === "error" ? <XCircle size={18} className="mt-0.5 shrink-0 text-red-600" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />}
          <span className="flex-1 leading-snug">{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-[#0F172A] p-0.5 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── System status chip ────────────────────────────────────────────────────────
function SimBadge() {
  const { health } = useApp();
  if (!health) return null;
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-[#475569]">
      <Activity size={14} className="text-[#2563EB]" />
      <span>Sim Clock {fmtTime(health.sim_time)}</span>
    </div>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export function RoleLayout({
  children,
  session,
  onSignOut,
}: {
  children: ReactNode;
  session: AuthSession;
  onSignOut: () => void;
}) {
  const { zones } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wallClock, setWallClock] = useState(() => new Date());
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();
  const role = session.user.actual_role;
  const RoleIcon = ROLE_ICON[role] ?? ShieldCheck;

  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => {
    const t = setInterval(() => setWallClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Poll pending count for managers
  useEffect(() => {
    if (role === "cold_storage_manager") {
      auth.getPendingUsers()
        .then((users) => setPendingCount(users.length))
        .catch(() => {});
    }
  }, [role, location.pathname]);

  const Sidebar = (
    <div className="flex flex-col h-full text-white">
      <Brand />
      {/* Role badge */}
      <div className="mx-1 mb-4 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-bold shadow-sm bg-white/15 text-white border border-white/20 backdrop-blur-md">
        <RoleIcon size={16} />
        <span className="truncate">{session.user.role_display}</span>
      </div>

      <NavItems role={role} onNavigate={() => setDrawerOpen(false)} pendingCount={pendingCount} />

      <div className="mt-auto pt-4 border-t border-white/20 space-y-3">
        {/* User card (Frosted White Card matching Dribbble design) */}
        <div className="rounded-2xl border border-white/40 bg-white/95 text-[#0F172A] p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-1">
            <span className="font-extrabold text-sm truncate text-[#0F172A]">{session.user.name}</span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
          </div>
          <div className="text-[#475569] text-xs font-medium truncate">{session.user.email}</div>
          <button
            onClick={onSignOut}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-[#475569] hover:text-rose-700 text-xs font-bold py-2 transition shadow-sm cursor-pointer"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
        <div className="flex items-center justify-between px-1 text-xs text-cyan-100/80 font-medium">
          <SimBadge />
          <span>Telemetry Active</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F7FF] text-[#0F172A] font-sans relative overflow-x-hidden">
      {/* Desktop sidebar with vibrant Dribbble electric blue gradient */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-gradient-to-b from-[#142C6F] via-[#1D4ED8] to-[#0284C7] px-3.5 py-5 lg:flex shadow-2xl border-r border-[#1D4ED8]/30">
        {Sidebar}
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col bg-gradient-to-b from-[#142C6F] via-[#1D4ED8] to-[#0284C7] px-3.5 py-5 shadow-2xl">
            <button onClick={() => setDrawerOpen(false)} className="self-end text-white/70 hover:text-white p-1 mb-2 cursor-pointer">
              <X size={20} />
            </button>
            {Sidebar}
          </div>
        </div>
      )}

      {/* Content area */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top header bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#DCE8F6] shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6 gap-4">
            <div className="flex items-center gap-3">
              <button className="lg:hidden text-[#475569] hover:text-[#0F172A] p-1 cursor-pointer" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
                <Menu size={22} />
              </button>
              <div className="hidden sm:flex items-center gap-2.5">
                <span className="h-2 w-2 rounded-full bg-[#2563EB] animate-pulse" />
                <span className="text-xs sm:text-sm font-bold text-[#475569] uppercase tracking-wide">ColdGuard AI — Enterprise Intelligence</span>
              </div>
            </div>

            {/* Dribbble Search Bar */}
            <div className="relative flex-1 max-w-md hidden md:flex items-center">
              <Search size={15} className="absolute left-3.5 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search cold room, telemetry, lot, or alert..."
                className="w-full pl-9 pr-14 py-2 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-xs sm:text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
                readOnly
              />
              <span className="absolute right-3 text-[10px] font-mono font-bold text-[#64748B] bg-white px-1.5 py-0.5 rounded border border-[#DCE8F6]">
                ⌘ K
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Outdoor temp */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EFF6FF] border border-[#DCE8F6] text-xs sm:text-sm">
                <Thermometer size={15} className="text-[#2563EB]" />
                <span className="font-mono font-bold text-[#0F172A]">
                  {zones?.[0]?.ambient_temperature != null ? `${zones[0].ambient_temperature.toFixed(0)}°C` : "25°C"}
                </span>
                <span className="text-[#475569] font-medium">Ambient</span>
              </div>

              {/* Live clock */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#EFF6FF] border border-[#DCE8F6] text-xs sm:text-sm font-mono font-bold text-[#0F172A]">
                <span className="h-2 w-2 rounded-full bg-[#2563EB] animate-pulse" />
                {wallClock.toLocaleTimeString()}
              </div>

              {/* System online */}
              <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Telemetry Online
              </div>

              {/* User avatar */}
              <div className="flex items-center gap-2.5 pl-2 border-l border-[#DCE8F6]">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow ${ROLE_COLOR[role] ?? "bg-[#2563EB]"}`}>
                  {session.user.name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-bold text-[#0F172A]">{session.user.name}</div>
                  <div className="text-xs font-semibold text-[#475569] truncate max-w-[130px]">{session.user.role_display}</div>
                </div>
                <button onClick={onSignOut} className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer" title="Sign Out">
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 mx-auto w-full max-w-[1550px] px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>

      <Toaster />
    </div>
  );
}
