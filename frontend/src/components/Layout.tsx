import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  Bot,
  BrainCircuit,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  HelpCircle,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Radio,
  Settings as SettingsIcon,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Thermometer,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../hooks/AppContext";
import { fmtTime } from "../lib/format";
import { isAudioAlertsEnabled, SoundEffects, VoiceSynthesizer } from "../lib/audio";
import { api } from "../services/api";
import type { Alert } from "../types/api";
import { AudioControlModal } from "./AudioControlModal";
import FloatingChatbotWidget from "./FloatingChatbotWidget";
import { SimulatedBadge, StatusDot } from "./ui";

const NAV = [
  { to: "/", label: "Live Monitoring", icon: LayoutDashboard },
  { to: "/excursion", label: "Excursion Monitor", icon: ShieldAlert },
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
    <div className="flex items-center gap-2.5">
      <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/40 shadow-sm">
        <Snowflake size={15} className="text-cyan-400 animate-pulse" />
      </div>
      <div className="leading-tight">
        <div className="text-[14px] font-bold tracking-tight text-white font-sans flex items-center gap-1">
          ColdGuard <span className="text-cyan-400">AI</span>
        </div>
        <div className="text-[10px] text-slate-400">Predictive Intelligence</div>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { zones } = useApp();
  const activeAlerts = zones?.reduce((n, z) => n + z.active_alert_count, 0) ?? 0;
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold"
                : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
            }`
          }
        >
          <Icon size={16} className="transition-transform group-hover:scale-110" />
          <span className="flex-1">{label}</span>
          {to === "/alerts" && activeAlerts > 0 && (
            <span
              className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-300"
              aria-label={`${activeAlerts} active alerts`}
            >
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

function HelpModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-[#0B1220]/95 p-6 shadow-2xl text-slate-200 backdrop-blur-xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          aria-label="Close help modal"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-cyan-500/20">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-sm shrink-0">
            <HelpCircle size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">ColdGuard AI Facility Help & Quick Reference</h3>
            <p className="text-xs text-slate-400">Standard operational guidelines, safe temperature bands & emergency response protocols.</p>
          </div>
        </div>

        <div className="space-y-4 text-xs max-h-[65vh] overflow-y-auto pr-1">
          {/* Key Modules */}
          <div>
            <h4 className="font-semibold text-cyan-300 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
              <Sparkles size={13} /> Platform Modules Overview
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div className="rounded-lg border border-white/5 bg-slate-900/60 p-2.5">
                <div className="font-semibold text-white">Live Monitoring</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Real-time IoT telemetry, mean kinetic temperature (MKT), and active thermal status.</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-slate-900/60 p-2.5">
                <div className="font-semibold text-white">Excursion Monitor</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Countdown to safety limit breach, active alarms, and critical intervention timers.</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-slate-900/60 p-2.5">
                <div className="font-semibold text-white">What-If Simulator</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Conversational physics chatbot to simulate power cuts, door jams, and heatwaves.</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-slate-900/60 p-2.5">
                <div className="font-semibold text-white">Digital Twin</div>
                <p className="text-[11px] text-slate-400 mt-0.5">Physics-based thermal digital twin visualizing equipment wear and heat infiltration.</p>
              </div>
            </div>
          </div>

          {/* Safe Regulatory Bands */}
          <div>
            <h4 className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
              <ShieldCheck size={13} /> Storage Temperature Standards (WHO & FDA GxP)
            </h4>
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 space-y-1.5 text-slate-300">
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-medium text-slate-200">Vaccines & Biologics (Chamber A):</span>
                <span className="font-mono text-emerald-400 font-bold">+2.0°C to +8.0°C</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-medium text-slate-200">Dairy & Fresh Products (Chamber B):</span>
                <span className="font-mono text-emerald-400 font-bold">0.0°C to +4.0°C</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-medium text-slate-200">Deep Freeze Inventory (Chamber C):</span>
                <span className="font-mono text-emerald-400 font-bold">-25.0°C to -18.0°C</span>
              </div>
            </div>
          </div>

          {/* Emergency Containment Actions */}
          <div>
            <h4 className="font-semibold text-rose-400 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
              <ShieldAlert size={13} /> Emergency Power Outage SOP
            </h4>
            <ol className="list-decimal list-inside space-y-1 text-slate-300 rounded-lg border border-rose-500/20 bg-rose-950/20 p-3 text-[11px]">
              <li>Keep chamber doors strictly latched to maximize thermal inertia.</li>
              <li>Verify Automatic Transfer Switch (ATS) engaging backup generator.</li>
              <li>If projected breach is within 20 mins, stage dry-ice or prepare transfer crates.</li>
              <li>Log deviation timestamps in QMS for regulatory audit compliance.</li>
            </ol>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition cursor-pointer"
          >
            Got it, close
          </button>
        </div>
      </div>
    </div>
  );
}

function NotificationDropdown({
  onClose,
  onNavigateAlerts,
}: {
  onClose: () => void;
  onNavigateAlerts: () => void;
}) {
  const { zones, refreshZones, notify } = useApp();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackingId, setAckingId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.alerts({ limit: 6, active: true });
      setAlerts(res);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAck = async (alertId: string) => {
    try {
      setAckingId(alertId);
      await api.acknowledge(alertId);
      notify("success", "Alert acknowledged");
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)));
      void refreshZones();
    } catch {
      notify("error", "Failed to acknowledge alert");
    } finally {
      setAckingId(null);
    }
  };

  const handleAckAll = async () => {
    try {
      setLoading(true);
      const unacked = alerts.filter((a) => !a.acknowledged);
      for (const a of unacked) {
        await api.acknowledge(a.id);
      }
      notify("success", "All active alerts acknowledged");
      setAlerts((prev) => prev.map((a) => ({ ...a, acknowledged: true })));
      void refreshZones();
    } catch {
      notify("error", "Could not acknowledge all alerts");
    } finally {
      setLoading(false);
    }
  };

  const unackedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div
      className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-cyan-500/30 bg-[#0F192C]/95 p-4 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-top-2 text-slate-200"
      role="menu"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-rose-500/20 text-rose-400 grid place-items-center border border-rose-500/30 shrink-0">
            <BellRing size={14} />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Active Notifications</span>
              {unackedCount > 0 && (
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white">
                  {unackedCount}
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400">Live facility alerts & warnings</div>
          </div>
        </div>

        {unackedCount > 0 && (
          <button
            onClick={handleAckAll}
            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-1 rounded-md bg-cyan-950/40 border border-cyan-500/30 transition cursor-pointer"
          >
            Ack All
          </button>
        )}
      </div>

      {/* Body */}
      <div className="py-2 space-y-2 max-h-72 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
            <span>Fetching live alerts...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-400 grid place-items-center border border-emerald-500/30">
              <CheckCircle2 size={16} />
            </div>
            <span className="font-medium text-slate-300">All chambers operating safely</span>
            <span className="text-[11px] text-slate-500">Zero unacknowledged thermal alerts</span>
          </div>
        ) : (
          alerts.map((alert) => {
            const isCrit = alert.severity === "critical";
            const zoneName = zones?.find((z) => z.zone_id === alert.zone_id)?.name || alert.zone_id;
            return (
              <div
                key={alert.id}
                className={`p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 ${
                  alert.acknowledged
                    ? "bg-slate-900/40 border-white/5 opacity-60"
                    : isCrit
                    ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                    : "bg-amber-950/20 border-amber-500/30 text-amber-200"
                }`}
              >
                <div
                  className={`mt-0.5 grid h-5 w-5 place-items-center rounded-md shrink-0 ${
                    isCrit ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  <AlertTriangle size={12} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold text-white truncate text-[11px]">
                      {alert.category_label || alert.title}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1 py-0.2 rounded uppercase ${
                        isCrit ? "bg-rose-500/30 text-rose-300" : "bg-amber-500/30 text-amber-300"
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-tight">
                    {alert.explanation || alert.title}
                  </p>
                  <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-mono">
                    <span className="truncate">📍 {zoneName}</span>
                    <span>{fmtTime(alert.created_at)}</span>
                  </div>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => handleAck(alert.id)}
                    disabled={ackingId === alert.id}
                    className="shrink-0 p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 text-[10px] flex items-center gap-0.5 cursor-pointer mt-0.5"
                    title="Acknowledge alert"
                  >
                    {ackingId === alert.id ? (
                      <div className="h-3 w-3 rounded-full border border-cyan-400 border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <Check size={11} />
                        <span>Ack</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="pt-2.5 mt-1 border-t border-slate-800 flex items-center justify-between text-xs">
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white text-[11px] cursor-pointer"
        >
          Close
        </button>
        <button
          onClick={() => {
            onClose();
            onNavigateAlerts();
          }}
          className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
        >
          <span>View All Alerts</span>
          <ArrowRight size={12} />
        </button>
      </div>
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
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [audioActive, setAudioActive] = useState(() => isAudioAlertsEnabled());
  const [alertsDropdownOpen, setAlertsDropdownOpen] = useState(false);
  const bellContainerRef = useRef<HTMLDivElement>(null);
  const lastAlarmRef = useRef<number>(0);
  const navigate = useNavigate();

  const location = useLocation();
  useEffect(() => {
    setDrawerOpen(false);
    setAlertsDropdownOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellContainerRef.current && !bellContainerRef.current.contains(event.target as Node)) {
        setAlertsDropdownOpen(false);
      }
    }
    if (alertsDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [alertsDropdownOpen]);

  useEffect(() => {
    const timer = setInterval(() => setWallClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Background acoustic & voice excursion monitor:
  // Detects critical excursion projection in any room (<30m to breach) and raises sound
  useEffect(() => {
    if (!zones || !isAudioAlertsEnabled()) return;
    const criticalZone = zones.find(
      (z: any) => z.time_to_breach_minutes != null && z.time_to_breach_minutes <= 30
    );
    if (criticalZone) {
      const now = Date.now();
      if (now - lastAlarmRef.current > 45000) {
        lastAlarmRef.current = now;
        SoundEffects.playExcursionAlarm(2.5);
        VoiceSynthesizer.speak(
          `Attention cold chain team: Critical excursion predicted in ${criticalZone.name}. Upper limit breach expected in approximately ${Math.round(
            criticalZone.time_to_breach_minutes ?? 0
          )} minutes.`
        );
      }
    }
  }, [zones]);

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
        <div className="mt-auto space-y-2.5 pt-3 border-t border-cyan-500/15">
          {/* Ask AI Tab */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("coldguard:open-chat"));
              }
            }}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-cyan-300 bg-gradient-to-r from-cyan-950/60 via-slate-900/80 to-blue-950/50 border border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-900/30 transition-all cursor-pointer shadow-sm group"
            title="Ask ColdGuard AI Assistant"
          >
            <Bot size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="flex-1 text-left">Ask AI</span>
            <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Sparkles size={10} className="animate-pulse" /> Online
            </span>
          </button>

          {/* User Profile Card (placed on top of Help tab) */}
          <div className="rounded-xl border border-cyan-500/30 bg-slate-900/85 backdrop-blur-md p-3 text-xs shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 border border-cyan-400/40 flex items-center justify-center font-bold text-white text-xs shadow-sm shrink-0">
                {user?.name ? user.name[0].toUpperCase() : "E"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate flex items-center gap-1.5">
                  <span className="truncate">{user?.name || "Elena Rostova"}</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#10B981]" title="Online" />
                </div>
                <div className="text-[10px] text-cyan-400/90 font-mono truncate mt-0.5">
                  {user?.role_display || user?.actual_role || "Cold Storage Manager"}
                </div>
              </div>
            </div>
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="mt-2.5 w-full py-1.5 px-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 text-rose-300 text-[11px] font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                title="Sign Out of ColdGuard AI"
              >
                <LogOut size={12} />
                <span>Sign Out</span>
              </button>
            )}
          </div>

          {/* Help Tab (At Last) */}
          <button
            type="button"
            onClick={() => setHelpModalOpen(true)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800/60 hover:text-white transition-all cursor-pointer group"
            title="Help, User Guides & Emergency Protocols"
          >
            <HelpCircle size={16} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
            <span className="flex-1 text-left">Help & Support</span>
          </button>
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
            
            <div className="mt-auto pt-3 border-t border-cyan-500/20 space-y-2">
              {/* Ask AI Tab Mobile */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("coldguard:open-chat"));
                  }
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-cyan-300 bg-cyan-950/50 border border-cyan-500/30"
              >
                <Bot size={15} className="text-cyan-400" />
                <span className="flex-1 text-left">Ask AI</span>
              </button>

              {/* User Card Mobile */}
              <div className="rounded-xl border border-cyan-500/25 bg-slate-900/80 p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-cyan-600 font-bold text-white text-xs grid place-items-center shrink-0">
                    {user?.name ? user.name[0].toUpperCase() : "E"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white truncate">{user?.name || "Elena Rostova"}</div>
                    <div className="text-[10px] text-cyan-400 truncate">{user?.role_display || "Manager"}</div>
                  </div>
                </div>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="mt-2 w-full py-1 rounded bg-rose-950/40 border border-rose-500/30 text-rose-300 text-[11px] flex items-center justify-center gap-1"
                  >
                    <LogOut size={11} />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>

              {/* Help Tab Mobile */}
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setHelpModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-slate-400 hover:text-white"
              >
                <HelpCircle size={15} />
                <span>Help & Support</span>
              </button>
            </div>
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

              {/* Emergency Audio Alarms & Voice Guardian Toggle */}
              <button
                type="button"
                onClick={() => setAudioModalOpen(true)}
                className={`relative p-2 rounded-xl border transition cursor-pointer ${
                  audioActive
                    ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-300 hover:border-cyan-400"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                }`}
                title="Emergency Audio Alarms & Hands-Free Voice Control"
                aria-label="Audio Alarms & Voice Controls"
              >
                {audioActive ? <Volume2 size={18} /> : <VolumeX size={18} />}
                {audioActive && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22D3EE] animate-pulse" />
                )}
              </button>

              {/* Notification bell with count badge & interactive popover */}
              <div ref={bellContainerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAlertsDropdownOpen((prev) => !prev)}
                  className={`relative p-2 rounded-xl border transition cursor-pointer ${
                    alertsDropdownOpen
                      ? "bg-cyan-950/50 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                  }`}
                  title="Active Alerts & Notifications"
                  aria-label="View Active Alerts & Notifications"
                >
                  <BellRing size={18} />
                  <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center shadow-lg">
                    {zones?.reduce((n: number, z: any) => n + (z.active_alert_count || 0), 0) || 3}
                  </span>
                </button>

                {alertsDropdownOpen && (
                  <NotificationDropdown
                    onClose={() => setAlertsDropdownOpen(false)}
                    onNavigateAlerts={() => navigate("/alerts")}
                  />
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1550px] px-4 py-6 sm:px-6">{children}</main>
      </div>
      <FloatingChatbotWidget />
      <Toaster />
      <AudioControlModal
        open={audioModalOpen}
        onClose={() => {
          setAudioModalOpen(false);
          setAudioActive(isAudioAlertsEnabled());
        }}
      />
      <HelpModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />
    </div>
  );
}
