import {
  Activity,
  BellRing,
  BrainCircuit,
  Calendar,
  CheckCircle2,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Settings as SettingsIcon,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Thermometer,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "../hooks/AppContext";
import { fmtTime } from "../lib/format";
import { SimulatedBadge, StatusDot } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/excursion", label: "Live Monitoring", icon: Activity },
  { to: "/predictions", label: "Predictions", icon: TrendingUp },
  { to: "/ai-explanation", label: "AI Explanation", icon: Sparkles },
  { to: "/alerts", label: "Alerts & Events", icon: BellRing },
  { to: "/what-if", label: "What-If Simulator", icon: SlidersHorizontal },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/twin", label: "Digital Twin", icon: Layers },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
        <Snowflake size={22} className="text-cyan-400 animate-pulse" />
      </div>
      <div className="leading-tight">
        <div className="text-[16px] font-bold tracking-tight text-white font-sans flex items-center gap-1">
          ColdGuard <span className="text-cyan-400">AI</span>
        </div>
        <div className="text-[11px] text-slate-400">Predictive Cold-Storage Intelligence</div>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { zones } = useApp();
  const activeAlerts = zones?.reduce((n, z) => n + z.active_alert_count, 0) ?? 0;
  return (
    <nav aria-label="Main" className="flex flex-col gap-1.5">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
              isActive
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`
          }
        >
          <Icon size={18} className="transition-transform group-hover:scale-110" />
          <span className="flex-1">{label}</span>
          {to === "/alerts" && activeAlerts > 0 && (
            <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-300" aria-label={`${activeAlerts} active alerts`}>
              {activeAlerts}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SystemStatus() {
  const { health, healthError } = useApp();
  if (healthError && !health) {
    return (
      <div className="flex items-center gap-2 text-xs text-crit" role="status">
        <XCircle size={14} /> Backend offline
      </div>
    );
  }
  if (!health) return <div className="text-xs text-fg-faint">Connecting…</div>;
  const items = [
    { ok: !healthError, label: healthError ? "API error" : "API online" },
    { ok: health.model_loaded, label: health.model_loaded ? "Model loaded" : "Model unavailable" },
    { ok: health.simulator_running, label: health.simulator_running ? "Simulator live" : "Simulator paused", warn: !health.simulator_running },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" role="status" aria-live="polite">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-fg-muted">
          <StatusDot tone={it.ok ? "ok" : it.warn ? "warn" : "crit"} pulse={it.ok && it.label === "Simulator live"} />
          {it.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5 font-mono text-fg-muted" title="Simulated clock: one simulated minute per tick">
        <Activity size={13} className="text-neon/70" /> Sim clock {fmtTime(health.sim_time)}
      </span>
    </div>
  );
}

function Toaster() {
  const { toasts, dismiss } = useApp();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg border bg-ink-900 px-3 py-2.5 text-sm shadow-2xl ${
            t.kind === "error" ? "border-crit/40 text-fg" : t.kind === "success" ? "border-neon/30 text-fg" : "border-white/10 text-fg"
          }`}
          role={t.kind === "error" ? "alert" : "status"}
        >
          {t.kind === "error" ? <XCircle size={16} className="mt-0.5 shrink-0 text-crit" /> : <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-neon" />}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss notification" className="text-fg-faint hover:text-fg">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function Layout({ 
  children, 
  user, 
  onSignOut 
}: { 
  children: ReactNode; 
  user?: any; 
  onSignOut?: () => void; 
}) {
  const { zones, health } = useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wallClock, setWallClock] = useState(() => new Date());
  const location = useLocation();
  useEffect(() => setDrawerOpen(false), [location.pathname]);
  useEffect(() => {
    const timer = setInterval(() => setWallClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 font-sans relative selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      {/* Ambient Cold Storage Warehouse & Industrial Glow Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src="/cold_storage_warehouse.jpg"
          alt="Cold Storage Facility Background"
          className="w-full h-full object-cover object-center filter brightness-[0.22] contrast-[1.12]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/85 to-[#0B1220]/90"></div>
        <div className="absolute inset-0 bg-radial-cold-glow opacity-70 pointer-events-none"></div>
        <div className="absolute inset-0 bg-industrial-grid opacity-25 pointer-events-none"></div>
      </div>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-cyan-500/20 bg-[#0B1220]/85 backdrop-blur-xl px-3 py-4 lg:flex shadow-2xl">
        <div className="px-2 pb-6">
          <Brand />
        </div>
        <NavItems />
        <div className="mt-auto space-y-3">
          {user && (
            <div className="rounded-xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-md p-3 text-xs shadow-lg">
              <div className="font-semibold text-white flex items-center justify-between">
                <span className="truncate">{user.name || user.email}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#10B981]"></span>
              </div>
              <div className="text-[10px] text-cyan-400/80 font-mono truncate mt-0.5">
                {user.role_display || user.actual_role}
              </div>
              <button
                onClick={onSignOut}
                className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30 text-rose-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <LogOut size={12} />
                <span>Sign Out</span>
              </button>
            </div>
          )}
          <div className="space-y-1.5 rounded-xl border border-white/5 bg-slate-900/50 backdrop-blur-sm p-3 text-[11px] leading-relaxed text-slate-400">
            <SimulatedBadge text="Prototype Active" />
            <p>Physics-driven sensor telemetry and multi-horizon AI excursion warnings.</p>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 border-r border-cyan-500/25 bg-[#0B1220]/95 backdrop-blur-2xl px-3 py-4 shadow-2xl">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button onClick={() => setDrawerOpen(false)} aria-label="Close navigation" className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawerOpen(false)} />
            {user && (
              <div className="mt-auto pt-4 border-t border-cyan-500/20">
                <div className="text-xs font-semibold text-white">{user.name}</div>
                <div className="text-[10px] text-cyan-400">{user.role_display}</div>
                <button
                  onClick={onSignOut}
                  className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center gap-1.5"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="lg:pl-64 relative z-10">
        <header className="sticky top-0 z-20 border-b border-cyan-500/20 bg-[#0B1220]/90 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <button className="lg:hidden text-slate-400 hover:text-white" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
                <Menu size={20} />
              </button>
              <div className="hidden sm:flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE] animate-ping" />
                <span className="text-xs font-semibold text-slate-300 tracking-wide uppercase">Cold-Storage Governance</span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3 sm:gap-6">
              {/* Outdoor Temperature */}
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <Thermometer size={16} className="text-amber-400" />
                <div className="leading-tight">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Outdoor Temperature</div>
                  <div className="text-xs font-bold text-amber-400 font-mono">
                    {zones?.[0]?.ambient_temperature != null ? `${zones[0].ambient_temperature.toFixed(0)}°C` : "25°C"}
                  </div>
                </div>
              </div>

              {/* Date & Time with Live Clock */}
              <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <Calendar size={16} className="text-cyan-400" />
                <div className="leading-tight">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Clock</span>
                  </div>
                  <div className="text-xs font-semibold text-slate-200 font-mono">
                    {wallClock.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })},{" "}
                    <span className="text-cyan-300 font-bold">{wallClock.toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>

              {/* System Online badge */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-medium shadow-[0_0_12px_rgba(16,185,129,0.15)]">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10B981] animate-pulse" />
                <span>System Online</span>
              </div>

              {/* Notification bell with count badge */}
              <NavLink to="/alerts" className="relative p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition">
                <BellRing size={18} />
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center shadow-lg">
                  {zones?.reduce((n: number, z: any) => n + (z.active_alert_count || 0), 0) || 3}
                </span>
              </NavLink>

              {/* User profile avatar */}
              <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-slate-800">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center font-bold text-white text-sm shadow-md">
                  {user?.name ? user.name[0].toUpperCase() : "R"}
                </div>
                <div className="hidden sm:block leading-tight text-left">
                  <div className="text-xs font-semibold text-white">
                    {user?.name || "Ruchita"}
                  </div>
                  <div className="text-[10px] text-cyan-400/90 font-mono">
                    {user?.role_display || "Manager"}
                  </div>
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="p-1.5 ml-1 text-slate-400 hover:text-rose-400 transition"
                    title="Sign Out"
                  >
                    <LogOut size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1550px] px-4 py-6 sm:px-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
