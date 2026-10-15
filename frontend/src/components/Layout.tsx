import {
  Activity,
  BellRing,
  Building2,
  KeyRound,
  LogOut,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  LayoutDashboard,
  LineChart,
  Menu,
  ShieldCheck,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "../hooks/AppContext";
import { useAuth } from "../hooks/AuthContext";
import type { Permission } from "../types/api";
import { fmtTime } from "../lib/format";
import { SimulatedBadge, StatusDot } from "./ui";

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[] = [
  { to: "/manager", label: "Facility Overview", icon: Building2, permission: "manager_overview" },
  { to: "/", label: "Live Monitor", icon: LayoutDashboard, permission: "view" },
  { to: "/zones", label: "Storage Zones", icon: Boxes, permission: "view" },
  { to: "/history", label: "Sensor History", icon: LineChart, permission: "view" },
  { to: "/alerts", label: "Alerts", icon: BellRing, permission: "view" },
  { to: "/what-if", label: "What-If Simulator", icon: SlidersHorizontal, permission: "what_if" },
  { to: "/model", label: "Model & Method", icon: BrainCircuit, permission: "model" },
  { to: "/access", label: "Access Control", icon: KeyRound, permission: "manage_users" },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-lg border border-neon/30 bg-neon/10 shadow-glow">
        <ShieldCheck size={19} className="text-neon" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight text-fg">
          ColdGuard <span className="text-neon">AI</span>
        </div>
        <div className="text-[11px] text-fg-muted">Predict Before It Spoils.</div>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { zones } = useApp();
  const { can } = useAuth();
  const activeAlerts = zones?.reduce((n, z) => n + z.active_alert_count, 0) ?? 0;
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.filter((n) => can(n.permission)).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive ? "bg-neon/10 text-neon border border-neon/20" : "text-fg-muted border border-transparent hover:bg-white/[0.04] hover:text-fg"
            }`
          }
        >
          <Icon size={17} />
          <span className="flex-1">{label}</span>
          {to === "/alerts" && activeAlerts > 0 && (
            <span className="rounded-full bg-crit/20 px-1.5 text-[11px] font-semibold text-crit" aria-label={`${activeAlerts} active alerts`}>
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

function UserMenu() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const initials = user.full_name.split(" ").map((p) => p[0]).join("").slice(0, 2);
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-full border border-neon/30 bg-neon/10 text-xs font-semibold text-neon" aria-hidden>{initials}</span>
      <span className="hidden leading-tight sm:block">
        <span className="block text-xs font-medium text-fg">{user.full_name}</span>
        <span className="block text-[11px] text-fg-muted">{user.role_label}</span>
      </span>
      <button onClick={() => void logout()} className="rounded-md p-1.5 text-fg-muted hover:bg-white/5 hover:text-fg" aria-label="Sign out" title="Sign out">
        <LogOut size={16} />
      </button>
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

export function Layout({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-ink text-fg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-neon/10 bg-ink-900/95 px-3 py-4 lg:flex">
        <div className="px-2 pb-6">
          <Brand />
        </div>
        <NavItems />
        <div className="mt-auto space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-fg-faint">
          <SimulatedBadge text="Prototype" />
          <p>All readings come from a sensor simulator. Forecasts are not validated for real-world, medical or food-safety decisions.</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/70" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 border-r border-neon/15 bg-ink-900 px-3 py-4">
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button onClick={() => setDrawerOpen(false)} aria-label="Close navigation" className="text-fg-muted hover:text-fg">
                <X size={18} />
              </button>
            </div>
            <NavItems onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-neon/10 bg-ink/85 backdrop-blur">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <button className="lg:hidden text-fg-muted hover:text-fg" onClick={() => setDrawerOpen(true)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <div className="lg:hidden">
              <Brand />
            </div>
            <div className="hidden lg:block text-sm font-semibold text-fg">Cold-Storage Monitoring</div>
            <SimulatedBadge text="Prototype · Simulated data" />
            <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
              <SystemStatus />
              <UserMenu />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
