import type { RiskCategory, Severity, TempStatus } from "../types/api";

export const POLL_MS = 2000;

export function fmtTemp(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined || Number.isNaN(value) ? "—" : `${value.toFixed(digits)}°C`;
}

export function fmtNum(value: number | null | undefined, digits = 1, suffix = ""): string {
  return value === null || value === undefined || Number.isNaN(value) ? "—" : `${value.toFixed(digits)}${suffix}`;
}

export function fmtPct(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`;
}

export function fmtTime(iso: string | null | undefined, withSeconds = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(withSeconds ? { second: "2-digit" } : {}) });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function fmtMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Formats elapsed real-time door open duration accurately without fake minutes (e.g. "5s", "45s", "1m 30s") */
export function fmtDoorDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds <= 0) return "0s";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

/** Signed value, e.g. "+1.2°C" / "−0.4°C". */
export function fmtDelta(value: number | null | undefined, digits = 1, unit = "°C"): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${Math.abs(value).toFixed(digits)}${unit}`;
}

type Tone = "ok" | "warn" | "crit" | "neutral";

export function toneForTemp(status: TempStatus): Tone {
  return status === "critical" ? "crit" : status === "warning" ? "warn" : status === "normal" ? "ok" : "neutral";
}

export function toneForRisk(category: RiskCategory): Tone {
  if (category === "critical" || category === "high") return "crit";
  if (category === "medium") return "warn";
  if (category === "low") return "ok";
  return "neutral";
}

export function toneForSeverity(severity: Severity): Tone {
  return severity === "critical" ? "crit" : severity === "warning" ? "warn" : "neutral";
}

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-emerald-700",
  warn: "text-amber-700",
  crit: "text-red-700",
  neutral: "text-slate-600",
};

export const TONE_BADGE: Record<Tone, string> = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  crit: "bg-red-50 text-red-800 border-red-200",
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
};

export const TONE_DOT: Record<Tone, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  crit: "bg-red-500",
  neutral: "bg-slate-400",
};

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

export const RISK_COLOR: Record<RiskCategory, string> = {
  low: "#10B981",      // Emerald safe
  medium: "#F59E0B",   // Amber warning
  high: "#F97316",     // Orange elevated
  critical: "#EF4444", // Red critical
  unknown: "#64748B",
};

// Chart palette (aligned with Premium Arctic Blue design system)
export const CHART = {
  observed: "#2563EB",   // Primary blue
  forecast: "#38BDF8",   // Sky blue
  band: "#93C5FD",       // Ice spread
  limit: "#EF4444",      // Red excursion threshold
  setpoint: "#475569",   // Secondary slate
  humidity: "#6366F1",   // Indigo
  scenario: "#F59E0B",   // Amber
  baseline: "#2563EB",   // Primary blue
  grid: "#E2E8F0",       // Light grid
  axis: "#475569",       // Secondary text
};
