/**
 * ExcursionMonitor.tsx – Real-Time Excursion Risk & Early Warning Command Center
 *
 * Connects to the backend SSE stream (/api/stream/telemetry) for live,
 * sub-second updates. No polling – true push-based real-time monitoring.
 */
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bell,
  BellRing,
  CheckCircle2,
  Clock,
  Cpu,
  DoorOpen,
  Droplets,
  Eye,
  Flame,
  Gauge,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Signal,
  Snowflake,
  Sparkles,
  Sun,
  Target,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
  Zap,
  ZapOff,
  Download,
  Database,
  FileSpreadsheet,
  Play,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useApp } from "../hooks/AppContext";
import { api } from "../services/api";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/* ═══════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════ */

interface ForecastPoint {
  timestamp: string;
  minutes_ahead: number;
  temperature: number;
  lower: number | null;
  upper: number | null;
}

interface SensorIssue {
  type: string;
  detail: string;
}

interface StreamZone {
  zone_id: string;
  name: string;
  product: string;
  temperature: number | null;
  humidity: number | null;
  ambient_temperature: number | null;
  temperature_status: string;
  compressor_status: string | null;
  compressor_load_pct: number | null;
  power_consumption_kw: number | null;
  sensor_health: string;
  door_status: string | null;
  door_open_minutes: number;
  compressor_off_minutes: number;
  sensor_status: string;
  sensor_issues: SensorIssue[];
  risk_score: number | null;
  risk_category: string;
  trend_per_hour: number;
  time_to_breach_minutes: number | null;
  warning_time_to_breach_minutes: number | null;
  active_alert_count: number;
  setpoint: number;
  lower_limit: number;
  upper_limit: number;
  scenario: string;
  scenario_label: string;
  forecast_available: boolean;
  forecast_points: ForecastPoint[];
  excursion_expected: boolean;
  slope_per_min: number;
  residual_rise_predicted?: number;
  peak_temp_predicted?: number | null;
  recovery_time_minutes?: number;
  recovery_progress_pct?: number;
  recovery_phase?: string;
  time_since_closure_minutes?: number;
  door_events_count_24h?: number;
  cumulative_open_minutes_24h?: number;
  is_synthetic?: boolean;
}

interface StreamAlert {
  id: string;
  zone_id: string;
  category: string;
  severity: string;
  title: string;
  explanation: string;
  recommended_action: string;
  created_at: string;
  occurrences: number;
  acknowledged: boolean;
}

interface StreamPayload {
  timestamp: string | null;
  tick_count: number;
  running: boolean;
  zones: StreamZone[];
  alerts: StreamAlert[];
  facility_risk: number;
  total_power_kw?: number;
  is_synthetic?: boolean;
}

/* ═══════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════════════════════ */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

function riskColor(score: number | null): string {
  if (score === null) return "#64748b";
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  if (score >= 20) return "#3b82f6";
  return "#10b981";
}

function riskGlow(score: number | null): string {
  if (score === null) return "none";
  if (score >= 70) return "0 0 30px rgba(239,68,68,0.5)";
  if (score >= 40) return "0 0 25px rgba(245,158,11,0.4)";
  if (score >= 20) return "0 0 20px rgba(59,130,246,0.3)";
  return "0 0 15px rgba(16,185,129,0.25)";
}

function riskLabel(cat: string): string {
  const map: Record<string, string> = { low: "LOW", medium: "MEDIUM", high: "HIGH", critical: "CRITICAL", unknown: "N/A" };
  return map[cat] ?? cat.toUpperCase();
}

function riskBg(cat: string): string {
  const map: Record<string, string> = {
    low: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
    medium: "bg-blue-500/15 border-blue-500/30 text-blue-300",
    high: "bg-amber-500/15 border-amber-500/30 text-amber-300",
    critical: "bg-rose-500/15 border-rose-500/30 text-rose-300",
  };
  return map[cat] ?? "bg-slate-500/15 border-slate-500/30 text-slate-300";
}

function tempStatusIcon(status: string) {
  switch (status) {
    case "critical":
      return <Flame size={14} className="text-rose-400" />;
    case "warning":
      return <AlertTriangle size={14} className="text-amber-400" />;
    default:
      return <Snowflake size={14} className="text-cyan-400" />;
  }
}

function fmtTemp(v: number | null): string {
  return v !== null ? `${v.toFixed(1)}°C` : "—";
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   ANIMATED RISK GAUGE (SVG)
   ═══════════════════════════════════════════════════════════════════ */

function RiskGauge({ score, size = 140, label }: { score: number | null; size?: number; label?: string }) {
  const val = score ?? 0;
  const r = (size - 16) / 2;
  const circumference = 2 * Math.PI * r * 0.75; // 270° arc
  const offset = circumference - (val / 100) * circumference;
  const color = riskColor(score);

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-lg">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(100,116,139,0.15)"
          strokeWidth={8}
          strokeDasharray={`${circumference} ${2 * Math.PI * r * 0.25}`}
          strokeLinecap="round"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />
        {/* Active arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeDasharray={`${circumference} ${2 * Math.PI * r * 0.25}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(135 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 0.8s ease, stroke 0.5s ease",
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
        {/* Center text */}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill={color} fontSize={size * 0.22} fontWeight="bold" fontFamily="monospace">
          {score !== null ? Math.round(val) : "—"}
        </text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill="#94a3b8" fontSize={10} fontFamily="sans-serif">
          {label ?? "RISK"}
        </text>
      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONNECTION STATUS BADGE
   ═══════════════════════════════════════════════════════════════════ */

function ConnectionBadge({ connected, lastUpdate }: { connected: boolean; lastUpdate: string | null }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border backdrop-blur-sm transition-all ${
        connected
          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
          : "bg-rose-500/10 border-rose-500/30 text-rose-300 animate-pulse"
      }`}
    >
      {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
      {connected ? "LIVE STREAM" : "RECONNECTING…"}
      {connected && lastUpdate && (
        <span className="text-[10px] text-emerald-400/70 font-mono ml-1">{fmtTime(lastUpdate)}</span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ZONE RISK CARD
   ═══════════════════════════════════════════════════════════════════ */

function ZoneRiskCard({ zone, selected, onSelect }: { zone: StreamZone; selected: boolean; onSelect: () => void }) {
  const risk = zone.risk_score;
  const color = riskColor(risk);
  const breachSoon = zone.time_to_breach_minutes !== null && zone.time_to_breach_minutes <= 30;
  const warnSoon = zone.warning_time_to_breach_minutes !== null && zone.warning_time_to_breach_minutes <= 30;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border p-4 transition-all duration-300 group cursor-pointer ${
        selected
          ? "border-cyan-400/50 bg-cyan-500/8 shadow-[0_0_25px_rgba(34,211,238,0.15)]"
          : "border-white/8 bg-slate-900/40 hover:border-white/15 hover:bg-slate-800/40"
      }`}
      style={{ boxShadow: selected ? riskGlow(risk) : undefined }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {tempStatusIcon(zone.temperature_status)}
            <span className="text-sm font-bold text-white">{zone.name}</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{zone.product}</div>
        </div>
        <div
          className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold font-mono ${riskBg(zone.risk_category)}`}
        >
          {riskLabel(zone.risk_category)}
        </div>
      </div>

      {/* Temperature + Gauge */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="text-2xl font-mono font-bold" style={{ color }}>
            {fmtTemp(zone.temperature)}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-slate-500 font-mono">
              Target {fmtTemp(zone.setpoint)} · Range {fmtTemp(zone.lower_limit)}–{fmtTemp(zone.upper_limit)}
            </span>
          </div>
          {/* Trend */}
          <div className="flex items-center gap-1 mt-1.5">
            {zone.trend_per_hour > 0.5 ? (
              <TrendingUp size={12} className="text-rose-400" />
            ) : zone.trend_per_hour < -0.5 ? (
              <TrendingDown size={12} className="text-cyan-400" />
            ) : (
              <ArrowRight size={12} className="text-slate-400" />
            )}
            <span className="text-[10px] font-mono text-slate-400">
              {zone.trend_per_hour > 0 ? "+" : ""}
              {zone.trend_per_hour.toFixed(2)}°C/hr
            </span>
          </div>
        </div>
        <RiskGauge score={risk} size={72} label="" />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        <div
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${
            zone.compressor_status === "running"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : zone.compressor_status === "degraded"
              ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          {zone.compressor_status === "running" ? (
            <Zap size={9} />
          ) : zone.compressor_status === "degraded" ? (
            <AlertTriangle size={9} />
          ) : (
            <ZapOff size={9} />
          )}
          {zone.compressor_status === "running"
            ? "Compressor OK"
            : zone.compressor_status === "degraded"
            ? "Compressor Degraded"
            : "Compressor OFF"}
        </div>
        {zone.power_consumption_kw !== null && (
          <div className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono border bg-amber-500/10 border-amber-500/20 text-amber-300">
            <Zap size={9} className="text-amber-400" />
            {zone.power_consumption_kw.toFixed(1)} kW
          </div>
        )}
        <div
          className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border ${
            zone.door_status === "open"
              ? "bg-rose-500/15 border-rose-500/30 text-rose-300 animate-pulse"
              : ((zone.recovery_phase && zone.recovery_phase !== "none" && zone.recovery_phase !== "recovered") || (zone.residual_rise_predicted ?? 0) > 0.05)
              ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
              : "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
          }`}
        >
          <DoorOpen size={9} />
          {zone.door_status === "open"
            ? "Door OPEN"
            : ((zone.recovery_phase && zone.recovery_phase !== "none" && zone.recovery_phase !== "recovered") || (zone.residual_rise_predicted ?? 0) > 0.05)
            ? `Door Sealed (Recovering ${Math.round(zone.recovery_progress_pct ?? 0)}%)`
            : "Door Sealed"}
        </div>
        {zone.sensor_health && zone.sensor_health !== "healthy" && (
          <div className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium border bg-purple-500/10 border-purple-500/20 text-purple-300">
            <Cpu size={9} />
            {zone.sensor_health === "degraded_drift"
              ? "Sensor Drift"
              : zone.sensor_health === "stuck_frozen"
              ? "Sensor Frozen"
              : zone.sensor_health === "spike_anomaly"
              ? "Sensor Spike"
              : "Sensor Fault"}
          </div>
        )}
        {breachSoon && (
          <div className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border bg-rose-500/15 border-rose-500/30 text-rose-200 animate-pulse">
            <ShieldAlert size={9} />
            Breach in {Math.round(zone.time_to_breach_minutes!)}m
          </div>
        )}
        {!breachSoon && warnSoon && (
          <div className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border bg-amber-500/15 border-amber-500/30 text-amber-200">
            <AlertTriangle size={9} />
            Warning in {Math.round(zone.warning_time_to_breach_minutes!)}m
          </div>
        )}
      </div>

      {/* Humidity & Ambient */}
      <div className="flex items-center gap-4 mt-2.5 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <Droplets size={10} className="text-blue-400/60" />
          {zone.humidity !== null ? `${zone.humidity.toFixed(0)}% RH` : "—"}
        </span>
        <span className="flex items-center gap-1">
          <Sun size={10} className="text-amber-400/60" />
          Ambient {fmtTemp(zone.ambient_temperature)}
        </span>
        {zone.active_alert_count > 0 && (
          <span className="flex items-center gap-1 text-rose-400">
            <BellRing size={10} />
            {zone.active_alert_count} alert{zone.active_alert_count > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FORECAST MINI-CHART
   ═══════════════════════════════════════════════════════════════════ */

function ForecastChart({ zone }: { zone: StreamZone }) {
  const data = useMemo(() => {
    const pts: { minute: number; temp: number; lower: number; upper: number }[] = [
      { minute: 0, temp: zone.temperature ?? zone.setpoint, lower: zone.lower_limit, upper: zone.upper_limit },
    ];
    for (const fp of zone.forecast_points) {
      pts.push({
        minute: fp.minutes_ahead,
        temp: fp.temperature,
        lower: zone.lower_limit,
        upper: zone.upper_limit,
      });
    }
    return pts;
  }, [zone]);

  if (!zone.forecast_available || zone.forecast_points.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 text-xs">
        <Cpu size={14} className="mr-2" />
        Forecast unavailable
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 4 }}>
        <defs>
          <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={riskColor(zone.risk_score)} stopOpacity={0.3} />
            <stop offset="95%" stopColor={riskColor(zone.risk_score)} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.1)" />
        <XAxis dataKey="minute" tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#64748b", fontSize: 9 }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 8, fontSize: 11 }}
          labelFormatter={(v) => `+${v} min`}
          formatter={(v: number) => [`${v.toFixed(1)}°C`, "Forecast"]}
        />
        <ReferenceLine y={zone.upper_limit} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.5} />
        <ReferenceLine y={zone.lower_limit} stroke="#3b82f6" strokeDasharray="5 5" strokeOpacity={0.5} />
        <ReferenceLine y={zone.setpoint} stroke="#22d3ee" strokeDasharray="3 3" strokeOpacity={0.3} />
        <Area type="monotone" dataKey="temp" stroke={riskColor(zone.risk_score)} fill="url(#tempGrad)" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TEMPERATURE HISTORY SPARKLINE (ring buffer)
   ═══════════════════════════════════════════════════════════════════ */

function TempSparkline({ history, color, lower, upper }: { history: number[]; color: string; lower: number; upper: number }) {
  if (history.length < 2) return null;
  const min = Math.min(...history, lower);
  const max = Math.max(...history, upper);
  const range = max - min || 1;
  const w = 200;
  const h = 40;
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const upperY = h - ((upper - min) / range) * h;
  const lowerY = h - ((lower - min) / range) * h;

  return (
    <svg width={w} height={h} className="opacity-80">
      <line x1={0} y1={upperY} x2={w} y2={upperY} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.3} />
      <line x1={0} y1={lowerY} x2={w} y2={lowerY} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.3} />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} />
      {/* Latest dot */}
      {pts.length > 0 && (
        <circle
          cx={parseFloat(pts[pts.length - 1].split(",")[0])}
          cy={parseFloat(pts[pts.length - 1].split(",")[1])}
          r={3}
          fill={color}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      )}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EARLY WARNING TIMELINE
   ═══════════════════════════════════════════════════════════════════ */

function EarlyWarningTimeline({ zone }: { zone: StreamZone }) {
  const events: { time: string; label: string; severity: string; icon: React.ReactNode }[] = [];

  if (zone.warning_time_to_breach_minutes !== null) {
    events.push({
      time: `+${Math.round(zone.warning_time_to_breach_minutes)}m`,
      label: "Warning threshold crossed",
      severity: "warning",
      icon: <AlertTriangle size={12} />,
    });
  }
  if (zone.time_to_breach_minutes !== null) {
    events.push({
      time: `+${Math.round(zone.time_to_breach_minutes)}m`,
      label: "Excursion breach predicted",
      severity: "critical",
      icon: <ShieldAlert size={12} />,
    });
  }

  if (zone.excursion_expected) {
    events.push({
      time: "NOW",
      label: "EXCURSION IN PROGRESS",
      severity: "critical",
      icon: <Flame size={12} />,
    });
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-400/70">
        <ShieldCheck size={14} />
        No excursion predicted within forecast horizon
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${
            e.severity === "critical"
              ? "bg-rose-500/10 border-rose-500/25 text-rose-200"
              : "bg-amber-500/10 border-amber-500/25 text-amber-200"
          }`}
        >
          <div
            className={`rounded-full p-1 ${
              e.severity === "critical" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
            }`}
          >
            {e.icon}
          </div>
          <div className="flex-1 font-medium">{e.label}</div>
          <div className="font-mono font-bold">{e.time}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ALERT FEED
   ═══════════════════════════════════════════════════════════════════ */

function AlertFeed({ alerts }: { alerts: StreamAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500">
        <ShieldCheck size={28} className="mb-2 text-emerald-400/50" />
        <div className="text-xs">No active alerts</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
      {alerts.map((a) => (
        <div
          key={a.id}
          className={`rounded-xl border p-3 transition-all ${
            a.severity === "critical"
              ? "bg-rose-500/8 border-rose-500/25"
              : a.severity === "warning"
              ? "bg-amber-500/8 border-amber-500/25"
              : "bg-blue-500/8 border-blue-500/25"
          }`}
        >
          <div className="flex items-start gap-2">
            <div
              className={`mt-0.5 rounded-full p-1 ${
                a.severity === "critical"
                  ? "bg-rose-500/20 text-rose-400"
                  : a.severity === "warning"
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-blue-500/20 text-blue-400"
              }`}
            >
              {a.severity === "critical" ? <Flame size={11} /> : <AlertTriangle size={11} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate">{a.title}</span>
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                    a.severity === "critical" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {a.severity}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{a.explanation}</div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                <span className="font-mono">{a.zone_id}</span>
                <span>×{a.occurrences}</span>
                <span>{fmtTime(a.created_at)}</span>
              </div>
            </div>
          </div>
          {a.recommended_action && (
            <div className="mt-2 rounded-lg bg-slate-800/50 border border-white/5 px-2.5 py-1.5 text-[10px] text-cyan-300/80 flex items-start gap-1.5">
              <Sparkles size={10} className="mt-0.5 shrink-0 text-cyan-400" />
              {a.recommended_action}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SENSOR HEALTH MATRIX
   ═══════════════════════════════════════════════════════════════════ */

function SensorHealthMatrix({ zones }: { zones: StreamZone[] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {zones.map((z) => (
        <div key={z.zone_id} className="rounded-xl border border-white/8 bg-slate-900/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-white">{z.name}</span>
            <span
              className={`rounded-full h-2 w-2 ${
                z.sensor_status === "normal" ? "bg-emerald-400 shadow-[0_0_6px_#10B981]" : "bg-rose-400 shadow-[0_0_6px_#ef4444] animate-pulse"
              }`}
            />
          </div>
          <div className="space-y-1.5">
            {/* Temperature sensor */}
            <div className="flex items-center gap-2 text-[10px]">
              <Thermometer size={10} className="text-cyan-400/60" />
              <span className="text-slate-400">Temperature</span>
              <span className={`ml-auto font-mono ${z.temperature !== null ? "text-emerald-300" : "text-rose-300"}`}>
                {z.temperature !== null ? "● ACTIVE" : "✕ OFFLINE"}
              </span>
            </div>
            {/* Humidity sensor */}
            <div className="flex items-center gap-2 text-[10px]">
              <Droplets size={10} className="text-blue-400/60" />
              <span className="text-slate-400">Humidity</span>
              <span className={`ml-auto font-mono ${z.humidity !== null ? "text-emerald-300" : "text-rose-300"}`}>
                {z.humidity !== null ? "● ACTIVE" : "✕ OFFLINE"}
              </span>
            </div>
            {/* Compressor */}
            <div className="flex items-center gap-2 text-[10px]">
              <Cpu size={10} className="text-violet-400/60" />
              <span className="text-slate-400">Compressor</span>
              <span className={`ml-auto font-mono ${z.compressor_status === "running" ? "text-emerald-300" : "text-rose-300"}`}>
                {z.compressor_status === "running" ? "● RUNNING" : "✕ STOPPED"}
              </span>
            </div>
            {/* Door */}
            <div className="flex items-center gap-2 text-[10px]">
              <DoorOpen size={10} className="text-amber-400/60" />
              <span className="text-slate-400">Door Seal</span>
              <span
                className={`ml-auto font-mono ${
                  z.door_status === "open"
                    ? "text-rose-300"
                    : ((z.recovery_phase && z.recovery_phase !== "none" && z.recovery_phase !== "recovered") || (z.residual_rise_predicted ?? 0) > 0.05)
                    ? "text-amber-300"
                    : "text-emerald-300"
                }`}
              >
                {z.door_status === "open"
                  ? "⚠ OPEN"
                  : ((z.recovery_phase && z.recovery_phase !== "none" && z.recovery_phase !== "recovered") || (z.residual_rise_predicted ?? 0) > 0.05)
                  ? "● RECOVERING"
                  : "● SEALED"}
              </span>
            </div>
            {/* Issues */}
            {z.sensor_issues.length > 0 && (
              <div className="mt-1.5 rounded-lg bg-rose-500/8 border border-rose-500/15 px-2 py-1 text-[9px] text-rose-300">
                {z.sensor_issues.map((issue, i) => (
                  <div key={i}>⚠ {issue.detail}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function ExcursionMonitor() {
  const {
    selectedZoneId,
    setSelectedZoneId,
    zones,
    facilityRisk,
    totalPowerKw,
    activeAlerts,
    tickCount,
    simTimestamp,
    streamConnected,
    tempHistories,
  } = useApp();

  const selectedZone = selectedZoneId;
  const setSelectedZone = setSelectedZoneId;
  const connected = streamConnected;
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [datasetModalOpen, setDatasetModalOpen] = useState(false);

  const triggerScenario = async (scenario: any) => {
    if (!selectedZone) return;
    setScenarioBusy(true);
    try {
      await api.setScenario(selectedZone, scenario);
    } catch (e) {
      console.error("Scenario trigger failed:", e);
    } finally {
      setScenarioBusy(false);
    }
  };

  const data: StreamPayload | null = useMemo(() => {
    if (!zones || zones.length === 0) return null;
    return {
      timestamp: simTimestamp,
      tick_count: tickCount,
      running: true,
      zones: zones as unknown as StreamZone[],
      alerts: activeAlerts as unknown as StreamAlert[],
      facility_risk: facilityRisk,
      total_power_kw: totalPowerKw,
      is_synthetic: true,
    };
  }, [zones, simTimestamp, tickCount, activeAlerts, facilityRisk, totalPowerKw]);

  const activeZone = useMemo(() => data?.zones.find((z) => z.zone_id === selectedZone), [data, selectedZone]);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
          <Signal size={20} className="absolute inset-0 m-auto text-cyan-400" />
        </div>
        <div className="text-sm text-slate-400">Connecting to real-time telemetry stream…</div>
        <div className="text-[10px] text-slate-600 font-mono">SSE → /api/stream/telemetry</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ══════════ HEADER BAR ══════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 p-2">
              <Shield size={20} className="text-rose-400" />
            </div>
            Excursion Risk & Early Warning
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time SSE stream · Live excursion risk monitoring · AI-powered early warning predictions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Total Facility Power Load */}
          <div className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-mono font-bold text-amber-300">
            <Zap size={14} className="text-amber-400" />
            <span>{data.total_power_kw !== undefined ? `${data.total_power_kw.toFixed(1)} kW` : "— kW"}</span>
            <span className="text-[10px] text-amber-400/60 font-normal">Grid Load</span>
          </div>

          {/* Synthetic Physics Disclaimer & Dataset Download Badge */}
          <button
            onClick={() => setDatasetModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20 transition-all cursor-pointer"
          >
            <Database size={13} className="text-cyan-400" />
            <span>SYNTHETIC PHYSICS DATA (v2.0)</span>
            <Download size={11} className="text-cyan-400 ml-0.5" />
          </button>

          <ConnectionBadge connected={connected} lastUpdate={data.timestamp} />
          <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-slate-900/50 px-3 py-2 text-xs text-slate-400">
            <Activity size={13} className="text-cyan-400" />
            <span className="font-mono">Tick #{data.tick_count}</span>
            <span className="text-slate-600">·</span>
            <Clock size={11} />
            <span className="font-mono">{fmtTime(data.timestamp)}</span>
          </div>
        </div>
      </div>

      {/* ══════════ LIVE SCENARIO INJECTION BAR ══════════ */}
      <div className="rounded-2xl border border-white/8 bg-slate-900/50 backdrop-blur-sm p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs">
          <Sparkles size={14} className="text-amber-400" />
          <span className="font-semibold text-white">Live Fault Injection Test:</span>
          <span className="text-slate-400 font-mono text-[11px]">
            Target: <strong className="text-cyan-300">{activeZone?.name ?? "Zone"}</strong>
          </span>
          {scenarioBusy && <span className="text-amber-400 text-[10px] animate-pulse">Switching…</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            disabled={scenarioBusy}
            onClick={() => triggerScenario("normal")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
              activeZone?.scenario === "normal"
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                : "bg-slate-800/60 border-white/5 text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            ✓ Normal
          </button>
          <button
            disabled={scenarioBusy}
            onClick={() => triggerScenario("door_open")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
              activeZone?.scenario === "door_open"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-slate-800/60 border-white/5 text-slate-400 hover:text-amber-200 hover:bg-slate-800"
            }`}
          >
            🚪 Door Left Open
          </button>
          <button
            disabled={scenarioBusy}
            onClick={() => triggerScenario("compressor_failure")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
              activeZone?.scenario === "compressor_failure"
                ? "bg-rose-500/20 border-rose-500/40 text-rose-300"
                : "bg-slate-800/60 border-white/5 text-slate-400 hover:text-rose-200 hover:bg-slate-800"
            }`}
          >
            ⚡ Compressor Trip
          </button>
          <button
            disabled={scenarioBusy}
            onClick={() => triggerScenario("cooling_degradation")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
              activeZone?.scenario === "cooling_degradation"
                ? "bg-orange-500/20 border-orange-500/40 text-orange-300"
                : "bg-slate-800/60 border-white/5 text-slate-400 hover:text-orange-200 hover:bg-slate-800"
            }`}
          >
            📉 Cooling Degradation (45%)
          </button>
          <button
            disabled={scenarioBusy}
            onClick={() => triggerScenario("sensor_anomaly")}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
              activeZone?.scenario === "sensor_anomaly"
                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                : "bg-slate-800/60 border-white/5 text-slate-400 hover:text-purple-200 hover:bg-slate-800"
            }`}
          >
            📡 Sensor Drift / Spike
          </button>
        </div>
      </div>

      {/* ══════════ DATASET & PHYSICS MODAL ══════════ */}
      {datasetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-2xl rounded-2xl border border-cyan-500/30 bg-slate-900 p-6 shadow-2xl">
            <button
              onClick={() => setDatasetModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-xl bg-cyan-500/20 border border-cyan-500/30 p-2 text-cyan-400">
                <Database size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Physics-Informed Synthetic Cold Storage Datasets</h2>
                <p className="text-xs text-slate-400 font-mono">Calibrated ODE Thermodynamics · Multi-Horizon Labels</p>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-3 leading-relaxed mb-6">
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-amber-200 text-[11px]">
                <strong>NOTICE:</strong> All data is <strong>SYNTHETIC</strong>, generated via a lumped-capacitance
                differential thermal model (<code className="text-amber-300">dT/dt = k_leak(Tamb - T) + k_door - cooling</code>)
                calibrated to ASHRAE cold-chain standards.
              </div>
              <p>
                The datasets include 1-minute interval readings for 3 zones, with multi-horizon supervision targets:
                <span className="text-cyan-300 font-mono"> T(t+15m)</span>,
                <span className="text-cyan-300 font-mono"> T(t+30m)</span>,
                <span className="text-cyan-300 font-mono"> T(t+60m)</span>, and
                <span className="text-rose-300 font-mono"> excursion_risk_30m</span>.
                Chronological splits (Train 70% / Val 15% / Test 15%) prevent look-ahead data leakage.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              <a
                href={`${BASE_URL}/api/stream/datasets/download/train`}
                download
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-800 hover:border-cyan-400/40 transition-all text-xs"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-emerald-400" />
                  <div>
                    <div className="font-semibold text-white">Training Set (70%)</div>
                    <div className="text-[10px] text-slate-400">42,336 samples · Labeled</div>
                  </div>
                </div>
                <Download size={14} className="text-cyan-400" />
              </a>

              <a
                href={`${BASE_URL}/api/stream/datasets/download/val`}
                download
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-800 hover:border-cyan-400/40 transition-all text-xs"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-amber-400" />
                  <div>
                    <div className="font-semibold text-white">Validation Set (15%)</div>
                    <div className="text-[10px] text-slate-400">9,072 samples · Labeled</div>
                  </div>
                </div>
                <Download size={14} className="text-cyan-400" />
              </a>

              <a
                href={`${BASE_URL}/api/stream/datasets/download/test`}
                download
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-800 hover:border-cyan-400/40 transition-all text-xs"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-cyan-400" />
                  <div>
                    <div className="font-semibold text-white">Test Set (15%)</div>
                    <div className="text-[10px] text-slate-400">8,892 samples · Unseen Evaluation</div>
                  </div>
                </div>
                <Download size={14} className="text-cyan-400" />
              </a>

              <a
                href={`${BASE_URL}/api/stream/datasets/download/full`}
                download
                className="flex items-center justify-between p-3 rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-800 hover:border-cyan-400/40 transition-all text-xs"
              >
                <div className="flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-purple-400" />
                  <div>
                    <div className="font-semibold text-white">Full 14-Day Series</div>
                    <div className="text-[10px] text-slate-400">60,480 samples · All Zones</div>
                  </div>
                </div>
                <Download size={14} className="text-cyan-400" />
              </a>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10 text-[11px] text-slate-400">
              <a
                href={`${BASE_URL}/api/stream/datasets/info`}
                target="_blank"
                rel="noreferrer"
                className="text-cyan-400 hover:underline flex items-center gap-1 font-mono"
              >
                View JSON Calibration Metadata →
              </a>
              <button
                onClick={() => setDatasetModalOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ FACILITY RISK OVERVIEW ══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Facility gauge */}
        <div className="rounded-2xl border border-white/8 bg-slate-900/40 backdrop-blur-sm p-5 flex flex-col items-center justify-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-semibold">Facility Risk</div>
          <RiskGauge score={data.facility_risk} size={150} label="OVERALL" />
          <div className={`mt-3 rounded-lg border px-3 py-1 text-xs font-bold ${riskBg(
            data.facility_risk >= 70 ? "critical" : data.facility_risk >= 40 ? "high" : data.facility_risk >= 20 ? "medium" : "low"
          )}`}>
            {data.facility_risk >= 70 ? "CRITICAL" : data.facility_risk >= 40 ? "HIGH" : data.facility_risk >= 20 ? "MEDIUM" : "LOW"}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500">
            <span>{data.zones.length} zones</span>
            <span className="text-rose-400">{data.alerts.length} active alerts</span>
          </div>
        </div>

        {/* Zone cards */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {data.zones.map((z) => (
            <ZoneRiskCard
              key={z.zone_id}
              zone={z}
              selected={selectedZone === z.zone_id}
              onSelect={() => setSelectedZone(z.zone_id)}
            />
          ))}
        </div>
      </div>

      {/* ══════════ DETAILED ZONE PANEL ══════════ */}
      {activeZone && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Forecast chart */}
          <div className="lg:col-span-2 rounded-2xl border border-white/8 bg-slate-900/40 backdrop-blur-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Target size={15} className="text-cyan-400" />
                  {activeZone.name} — 30-Min AI Forecast
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Random Forest multi-horizon temperature prediction with excursion breach detection
                </p>
              </div>
              <div className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${
                activeZone.excursion_expected
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-300 animate-pulse"
                  : "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              }`}>
                {activeZone.excursion_expected ? "⚠ EXCURSION EXPECTED" : "✓ IN RANGE"}
              </div>
            </div>
            <div className="h-[220px]">
              <ForecastChart zone={activeZone} />
            </div>

            {/* Temperature sparkline history */}
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  Live Temperature History (last 60 ticks)
                </span>
                <span className="text-[10px] font-mono text-slate-600">
                  {tempHistories[activeZone.zone_id]?.length ?? 0} samples
                </span>
              </div>
              <TempSparkline
                history={tempHistories[activeZone.zone_id] ?? []}
                color={riskColor(activeZone.risk_score)}
                lower={activeZone.lower_limit}
                upper={activeZone.upper_limit}
              />
            </div>
          </div>

          {/* Early warning + Details */}
          <div className="space-y-4">
            {/* Early Warning */}
            <div className="rounded-2xl border border-white/8 bg-slate-900/40 backdrop-blur-sm p-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
                <Radio size={13} className="text-amber-400" />
                Early Warning System
              </h3>
              <EarlyWarningTimeline zone={activeZone} />
            </div>

            {/* Zone Details */}
            <div className="rounded-2xl border border-white/8 bg-slate-900/40 backdrop-blur-sm p-4">
              <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-3">
                <Eye size={13} className="text-cyan-400" />
                Zone Details
              </h3>
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[10px]">
                <div className="text-slate-500">Scenario</div>
                <div className="text-white font-mono">{activeZone.scenario_label}</div>
                <div className="text-slate-500">Temperature</div>
                <div className="text-white font-mono">{fmtTemp(activeZone.temperature)}</div>
                <div className="text-slate-500">Setpoint</div>
                <div className="text-white font-mono">{fmtTemp(activeZone.setpoint)}</div>
                <div className="text-slate-500">Safe Range</div>
                <div className="text-white font-mono">{fmtTemp(activeZone.lower_limit)} – {fmtTemp(activeZone.upper_limit)}</div>
                <div className="text-slate-500">Humidity</div>
                <div className="text-white font-mono">{activeZone.humidity !== null ? `${activeZone.humidity.toFixed(1)}%` : "—"}</div>
                <div className="text-slate-500">Ambient</div>
                <div className="text-white font-mono">{fmtTemp(activeZone.ambient_temperature)}</div>
                <div className="text-slate-500">Trend</div>
                <div className={`font-mono ${activeZone.trend_per_hour > 0.5 ? "text-rose-300" : activeZone.trend_per_hour < -0.5 ? "text-cyan-300" : "text-slate-300"}`}>
                  {activeZone.trend_per_hour > 0 ? "+" : ""}{activeZone.trend_per_hour.toFixed(2)}°C/hr
                </div>
                <div className="text-slate-500">Door Open</div>
                <div className="text-white font-mono">{activeZone.door_open_minutes.toFixed(0)} min</div>
                <div className="text-slate-500">Compressor Off</div>
                <div className="text-white font-mono">{activeZone.compressor_off_minutes.toFixed(0)} min</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ SENSOR HEALTH + ALERTS ══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sensor Health */}
        <div className="rounded-2xl border border-white/8 bg-slate-900/40 backdrop-blur-sm p-5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
            <Gauge size={15} className="text-violet-400" />
            Sensor Health Matrix
          </h3>
          <SensorHealthMatrix zones={data.zones} />
        </div>

        {/* Active Alerts */}
        <div className="rounded-2xl border border-white/8 bg-slate-900/40 backdrop-blur-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BellRing size={15} className="text-rose-400" />
              Active Alert Feed
            </h3>
            <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold font-mono text-rose-300">
              {data.alerts.length} active
            </span>
          </div>
          <AlertFeed alerts={data.alerts} />
        </div>
      </div>

      {/* ══════════ DATA SOURCE INFO ══════════ */}
      <div className="rounded-2xl border border-white/5 bg-slate-900/20 backdrop-blur-sm p-4">
        <div className="flex items-start gap-3">
          <Signal size={16} className="text-cyan-400/50 mt-0.5 shrink-0" />
          <div className="text-[10px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-400">Real-Time Data Pipeline:</span>{" "}
            Backend physics simulator generates 1 sensor reading/zone/second → SSE (Server-Sent Events) stream pushes
            to browser at <code className="text-cyan-400/60 bg-slate-800/50 px-1 rounded">/api/stream/telemetry</code> →
            Random Forest model (scikit-learn) produces 30-min temperature forecasts → Heuristic risk engine scores
            excursion probability 0–100 → Alert manager evaluates conditions and fires early warnings.
            <span className="block mt-1 text-slate-600">
              Tick #{data.tick_count} · {data.zones.length} zones monitored · {data.alerts.length} active alerts ·
              Simulator {data.running ? "RUNNING" : "PAUSED"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
