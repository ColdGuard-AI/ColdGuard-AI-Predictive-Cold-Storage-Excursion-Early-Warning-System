import { RISK_COLOR, TONE_TEXT, toneForRisk, toneForTemp } from "../lib/format";
import type { Risk, RiskCategory, ZoneSummary } from "../types/api";
import { useApp } from "../hooks/AppContext";
import { InfoTip, StatusDot } from "./ui";

export function ZoneTabs({ className = "" }: { className?: string }) {
  const { zones, selectedZoneId, setSelectedZoneId } = useApp();
  if (!zones?.length) return null;
  return (
    <div role="tablist" aria-label="Storage zone" className={`flex gap-2 overflow-x-auto pb-1 ${className}`}>
      {zones.map((z) => {
        const tone = z.temperature_status === "critical" || z.risk_category === "critical" || z.risk_category === "high"
          ? "crit"
          : z.temperature_status === "warning" || z.risk_category === "medium" || z.sensor_status === "suspicious"
            ? "warn"
            : "ok";
        const selected = z.zone_id === selectedZoneId;
        return (
          <button
            key={z.zone_id}
            role="tab"
            aria-selected={selected}
            onClick={() => setSelectedZoneId(z.zone_id)}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3.5 py-2 text-left transition-all cursor-pointer backdrop-blur-md ${
              selected
                ? "border-cyan-400 bg-cyan-500/15 shadow-glow"
                : "border-cyan-500/20 bg-slate-900/80 hover:border-cyan-400/40 hover:bg-slate-850"
            }`}
          >
            <StatusDot tone={tone} pulse={tone === "crit"} />
            <span>
              <span className={`block text-sm font-semibold tracking-tight ${selected ? "text-white" : "text-slate-300"}`}>{z.name}</span>
              <span className="block font-mono text-[11px] text-cyan-400/80">
                {z.temperature != null ? `${z.temperature.toFixed(1)}°C` : "no data"} · risk {z.risk_score ?? "—"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Semi-circular gauge for the 0–100 heuristic risk score. */
export function RiskGauge({ score, category, size = 150 }: { score: number | null; category: RiskCategory; size?: number }) {
  const value = score ?? 0;
  const r = 52;
  const circumference = Math.PI * r;
  const filled = (value / 100) * circumference;
  const color = RISK_COLOR[category];
  return (
    <svg viewBox="0 0 130 78" width={size} height={size * 0.6} role="img" aria-label={`Risk score ${score ?? "unknown"} of 100, ${category}`}>
      <path d="M 13 70 A 52 52 0 0 1 117 70" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" strokeLinecap="round" />
      <path
        d="M 13 70 A 52 52 0 0 1 117 70"
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: "stroke-dasharray 400ms ease, stroke 400ms ease", filter: `drop-shadow(0 0 4px ${color}66)` }}
      />
      <text x="65" y="62" textAnchor="middle" fill="#f2f5f3" fontSize="26" fontWeight="700" fontFamily="JetBrains Mono, monospace">
        {score ?? "—"}
      </text>
      <text x="65" y="76" textAnchor="middle" fill="#6b7671" fontSize="9">/ 100</text>
    </svg>
  );
}

export function RiskFactors({ risk }: { risk: Risk | null }) {
  if (!risk) return null;
  if (!risk.factors.length) {
    return <p className="text-sm text-fg-muted">No risk factors detected — readings, trend, forecast and equipment are all within normal bounds.</p>;
  }
  return (
    <ul className="space-y-3" aria-label="Risk factors">
      {risk.factors.map((f) => (
        <li key={f.key}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-fg">{f.label}</span>
            <span className="font-mono text-xs text-fg-muted">
              +{f.points.toFixed(0)} <span className="text-fg-faint">/ {f.max_points}</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(f.points / f.max_points) * 100}%`, background: RISK_COLOR[f.points / f.max_points > 0.66 ? "critical" : f.points / f.max_points > 0.33 ? "medium" : "low"] }}
            />
          </div>
          <p className="mt-1 text-xs text-fg-muted">{f.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function TempStatusLabel({ zone }: { zone: ZoneSummary }) {
  const tone = toneForTemp(zone.temperature_status);
  return <span className={`font-semibold ${TONE_TEXT[tone]}`}>{zone.temperature_status === "unknown" ? "Unknown" : zone.temperature_status[0].toUpperCase() + zone.temperature_status.slice(1)}</span>;
}

export function RiskLabel({ category }: { category: RiskCategory }) {
  return (
    <span className={`font-semibold ${TONE_TEXT[toneForRisk(category)]}`} style={{ color: RISK_COLOR[category] }}>
      {category[0].toUpperCase() + category.slice(1)}
    </span>
  );
}

export const TIPS = {
  risk: "Heuristic 0–100 score (not a probability): combines the ML forecast's distance to the limits, the current reading, the 15-min trend, equipment/door state and sensor health. See Model & Method for the exact rules.",
  forecast: "Temperature forecast from a Random Forest model trained on simulated data. The shaded band is the 10th–90th percentile of individual tree predictions — an uncertainty indicator, not a calibrated interval.",
  excursion: "An excursion is any reading outside the configured safe range for the zone.",
  earlyWarning: "Early-warning rule: an alert is raised when the 75th percentile of the model's tree forecasts crosses a limit within 30 minutes. This favours catching excursions early over avoiding false alarms.",
  sensor: "Rule-based checks for spikes, missing values and stuck (identical) readings, plus an Isolation Forest trained on fault-free simulated data as a secondary signal.",
  trend: "Rate of change over the last 15 minutes, expressed per hour.",
  setpoint: "The temperature the refrigeration unit is controlled to.",
};

export function TipLabel({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      {children}
      <InfoTip text={tip} />
    </span>
  );
}
