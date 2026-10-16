import { ArrowRight, BellRing, Boxes, DoorOpen, Power, ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SeverityBadge } from "../components/alerts";
import { Badge, ErrorState, InfoTip, LoadingState, StaleBanner } from "../components/ui";
import { RiskGauge, RiskLabel, TempStatusLabel, TIPS } from "../components/zone";
import { useApp } from "../hooks/AppContext";
import { fmtDateTime, fmtTemp } from "../lib/format";

export default function Zones() {
  const { selectedZone, zonesError, zonesLoading, refreshZones } = useApp();
  const navigate = useNavigate();
  if (zonesLoading && !selectedZone) return <LoadingState label="Loading store specifications…" />;
  if (!selectedZone) return <ErrorState message={zonesError ?? "No store data"} onRetry={refreshZones} />;

  const z = selectedZone;
  const critical = z.temperature_status === "critical" || z.risk_category === "critical";
  const open = () => navigate("/");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2.5 text-xl font-bold text-white tracking-tight">
          <Boxes size={22} className="text-cyan-400" /> Cold Storage Store Profile
        </h1>
        <p className="text-sm text-slate-400 mt-1">Operational limits, regulatory compliance band, and real-time equipment status for this single store.</p>
      </div>
      <StaleBanner error={zonesError} />

      <div className="max-w-3xl">
        <article
          className={`flex flex-col rounded-2xl border bg-slate-900/85 backdrop-blur-md p-6 shadow-2xl transition-all ${
            critical ? "border-rose-500/50 shadow-glow-crit" : "border-cyan-500/25 hover:border-cyan-500/40"
          }`}
        >
          <header className="flex items-start justify-between gap-2 border-b border-cyan-500/15 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-xs font-mono font-bold text-cyan-400">ACTIVE STORE</span>
                <h2 className="text-lg font-bold text-white tracking-tight">{z.name}</h2>
              </div>
              <p className="text-xs text-slate-400 mt-1">{z.product} · Primary IoT Sensor Node <strong className="font-mono text-cyan-400">{z.sensor_id}</strong></p>
            </div>
            <Badge tone={z.scenario === "normal" ? "ok" : "warn"} dot>{z.scenario_label}</Badge>
          </header>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="space-y-2">
              <div className="font-mono text-4xl font-extrabold text-white tracking-tight">
                {fmtTemp(z.temperature)}
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <TempStatusLabel zone={z} />
                <span>·</span>
                <span>Safe Range: <strong className="font-mono text-white">{z.lower_limit}–{z.upper_limit}°C</strong></span>
              </div>
              <div className="text-xs text-slate-400">
                Target Setpoint: <strong className="font-mono text-cyan-300">{fmtTemp(z.setpoint, 0)}</strong> · Humidity: <strong className="font-mono text-white">{z.humidity?.toFixed(0) ?? "—"}%</strong>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-slate-950/60">
              <RiskGauge score={z.risk_score} category={z.risk_category} size={130} />
              <div className="flex items-center justify-center gap-1.5 text-xs mt-1">
                <RiskLabel category={z.risk_category} /> <span className="text-slate-400">Risk Assessment</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5 pt-4 border-t border-cyan-500/15">
            <Badge tone={z.compressor_status === "stopped" ? "crit" : "ok"}><Power size={11} /> Compressor {z.compressor_status ?? "—"}</Badge>
            <Badge tone={z.door_status === "open" ? "warn" : "ok"}><DoorOpen size={11} /> Door {z.door_status ?? "—"}</Badge>
            <Badge tone={z.sensor_status === "normal" ? "ok" : "warn"}><ScanLine size={11} /> Sensor {z.sensor_status.replace("_", " ")}</Badge>
          </div>

          <div className="mt-5 rounded-xl border border-cyan-500/20 bg-slate-950/70 p-4">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase font-bold tracking-wider text-cyan-400">
              <BellRing size={13} /> Active Excursion Alert Stream {z.active_alert_count > 0 && <span className="text-rose-400">· {z.active_alert_count} active</span>}
            </div>
            {z.latest_alert ? (
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-white">{z.latest_alert.category_label}</span>
                  <SeverityBadge severity={z.latest_alert.severity} />
                  {!z.latest_alert.active && <Badge tone="ok">Resolved</Badge>}
                </div>
                <p className="font-mono text-[11px] text-slate-400">{fmtDateTime(z.latest_alert.created_at)}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No active excursion warnings. Storage operating within regulatory margin.</p>
            )}
          </div>

          <button
            onClick={open}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300 shadow-glow transition-all cursor-pointer"
          >
            Launch Live Monitor & Telemetry <ArrowRight size={15} />
          </button>
        </article>
      </div>
    </div>
  );
}
