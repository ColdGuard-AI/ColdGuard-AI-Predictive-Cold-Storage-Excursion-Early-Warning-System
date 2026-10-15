import { ArrowRight, BellRing, Boxes, DoorOpen, Power, ScanLine } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SeverityBadge } from "../components/alerts";
import { Badge, ErrorState, InfoTip, LoadingState, StaleBanner } from "../components/ui";
import { RiskGauge, RiskLabel, TempStatusLabel, TIPS } from "../components/zone";
import { useApp } from "../hooks/AppContext";
import { fmtDateTime, fmtTemp } from "../lib/format";

export default function Zones() {
  const { zones, zonesError, zonesLoading, refreshZones, setSelectedZoneId } = useApp();
  const navigate = useNavigate();
  if (zonesLoading && !zones) return <LoadingState label="Loading zones…" />;
  if (!zones) return <ErrorState message={zonesError ?? "No zones"} onRetry={refreshZones} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg"><Boxes size={20} className="text-neon" /> Storage Zones</h1>
        <p className="text-sm text-fg-muted">Select a zone to open its live readings and forecast.</p>
      </div>
      <StaleBanner error={zonesError} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {zones.map((z) => {
          const critical = z.temperature_status === "critical" || z.risk_category === "critical";
          const open = () => {
            setSelectedZoneId(z.zone_id);
            navigate("/");
          };
          return (
            <article
              key={z.zone_id}
              className={`flex flex-col rounded-xl border bg-ink-800/90 p-4 transition-colors hover:border-neon/30 ${critical ? "border-crit/40 shadow-glow-crit" : "border-neon/10"}`}
            >
              <header className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-fg">{z.name}</h2>
                  <p className="text-xs text-fg-muted">{z.product} · sensor {z.sensor_id}</p>
                </div>
                <Badge tone={z.scenario === "normal" ? "ok" : "warn"} dot>{z.scenario_label}</Badge>
              </header>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-3xl font-semibold text-fg">{fmtTemp(z.temperature)}</div>
                  <div className="mt-0.5 text-xs text-fg-muted">
                    <TempStatusLabel zone={z} /> · range {z.lower_limit}–{z.upper_limit}°C
                  </div>
                  <div className="mt-1 text-xs text-fg-muted">Humidity <span className="font-mono text-fg">{z.humidity?.toFixed(0) ?? "—"}%</span></div>
                </div>
                <div className="text-center">
                  <RiskGauge score={z.risk_score} category={z.risk_category} size={110} />
                  <div className="flex items-center justify-center gap-1 text-xs">
                    <RiskLabel category={z.risk_category} /> risk <InfoTip text={TIPS.risk} />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Badge tone={z.compressor_status === "stopped" ? "crit" : "ok"}><Power size={11} /> Compressor {z.compressor_status ?? "—"}</Badge>
                <Badge tone={z.door_status === "open" ? "warn" : "ok"}><DoorOpen size={11} /> Door {z.door_status ?? "—"}</Badge>
                <Badge tone={z.sensor_status === "normal" ? "ok" : "warn"}><ScanLine size={11} /> Sensor {z.sensor_status.replace("_", " ")}</Badge>
              </div>

              <div className="mt-4 flex-1 rounded-lg border border-white/[0.06] bg-ink-900/60 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
                  <BellRing size={12} /> Latest alert {z.active_alert_count > 0 && <span className="text-crit">· {z.active_alert_count} active</span>}
                </div>
                {z.latest_alert ? (
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-fg">{z.latest_alert.category_label}</span>
                      <SeverityBadge severity={z.latest_alert.severity} />
                      {!z.latest_alert.active && <Badge>Resolved</Badge>}
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-fg-faint">{fmtDateTime(z.latest_alert.created_at)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-fg-muted">No alerts.</p>
                )}
              </div>

              <button onClick={open} className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-neon/25 bg-neon/[0.06] px-3 py-2 text-sm font-medium text-neon hover:bg-neon/10">
                Open zone dashboard <ArrowRight size={14} />
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
