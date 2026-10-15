import { AlertOctagon, BellRing, BrainCircuit, Cpu, Droplets, Gauge, Thermometer, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertDetail, AlertRow, useAcknowledge } from "../components/alerts";
import { ChartLegend, ForecastChart } from "../components/charts";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { Badge, Card, EmptyState, ErrorState, InfoTip, LoadingState, Segmented, StaleBanner } from "../components/ui";
import { RiskFactors, RiskGauge, RiskLabel, TempStatusLabel, TIPS, ZoneTabs } from "../components/zone";
import { useApp } from "../hooks/AppContext";
import { useAuth } from "../hooks/AuthContext";
import { usePolling } from "../hooks/usePolling";
import { CHART, fmtMinutes, fmtNum, fmtTemp, POLL_MS } from "../lib/format";
import { api } from "../services/api";
import type { Alert, Forecast, Horizon, ZoneSummary } from "../types/api";

export default function Dashboard() {
  const { zones, zonesError, zonesLoading, refreshZones, selectedZone, selectedZoneId } = useApp();
  const { can } = useAuth();
  const canSimulate = can("simulate");
  const [horizon, setHorizon] = useState<Horizon>(30);
  const [openAlert, setOpenAlert] = useState<Alert | null>(null);

  const readings = usePolling(() => api.readings(selectedZoneId, 90), POLL_MS, [selectedZoneId]);
  const forecast = usePolling(() => api.forecast(selectedZoneId, horizon), POLL_MS, [selectedZoneId, horizon]);
  const risk = usePolling(() => api.risk(selectedZoneId, horizon), POLL_MS, [selectedZoneId, horizon]);
  const alerts = usePolling(() => api.alerts({ zone_id: selectedZoneId, limit: 6 }), POLL_MS, [selectedZoneId]);
  const { acknowledge, pending } = useAcknowledge((a) => {
    void alerts.refresh();
    if (openAlert?.id === a.id) setOpenAlert(a);
  });

  if (zonesLoading && !zones) return <LoadingState label="Connecting to ColdGuard backend…" />;
  if (!zones) return <ErrorState message={zonesError ?? "No data"} onRetry={refreshZones} />;
  const zone = selectedZone;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">Live Monitor</h1>
          <p className="text-sm text-fg-muted">Real-time readings, AI forecast and early warnings per storage zone.</p>
        </div>
        <ZoneTabs />
      </div>
      <StaleBanner error={zonesError} />

      {!zone ? (
        <EmptyState title="Zone not found" />
      ) : (
        <>
          <EarlyWarningBanner zone={zone} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TemperatureCard zone={zone} />
            <HumidityCard zone={zone} />
            <EquipmentCard zone={zone} />
            <RiskCard zone={zone} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              title="Temperature Forecast"
              icon={<BrainCircuit size={15} />}
              tip={TIPS.forecast}
              actions={
                <Segmented
                  label="Forecast horizon"
                  value={horizon}
                  onChange={setHorizon}
                  options={[{ value: 15, label: "15 min" }, { value: 30, label: "30 min" }, { value: 60, label: "60 min" }]}
                />
              }
            >
              <ForecastSummary forecast={forecast.data} horizon={horizon} />
              {readings.loading && !readings.data ? (
                <LoadingState />
              ) : readings.error && !readings.data ? (
                <ErrorState message={readings.error} onRetry={readings.refresh} />
              ) : !readings.data?.readings.length ? (
                <EmptyState title="No readings yet" hint="The simulator will start producing readings shortly." />
              ) : (
                <ForecastChart readings={readings.data.readings} forecast={forecast.data} lower={zone.lower_limit} upper={zone.upper_limit} setpoint={zone.setpoint} />
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <ChartLegend
                  items={[
                    { label: "Observed (simulated sensor)", color: CHART.observed },
                    { label: "Model forecast", color: CHART.forecast, dashed: true },
                    { label: "Tree spread (10–90%)", color: CHART.band, area: true },
                    { label: "Safe-range limits", color: CHART.limit, dashed: true },
                  ]}
                />
                {forecast.data?.note && <span className="text-[11px] text-warn">{forecast.data.note}</span>}
              </div>
              {forecast.data && !forecast.data.available && (
                <p className="mt-2 text-xs text-warn">Forecast unavailable: {forecast.data.reason}</p>
              )}
              {forecast.error && <p className="mt-2 text-xs text-crit">Forecast request failed: {forecast.error}</p>}
            </Card>

            <Card title="Why this risk score?" icon={<Gauge size={15} />} tip={TIPS.risk}>
              {risk.loading && !risk.data ? (
                <LoadingState />
              ) : risk.error && !risk.data ? (
                <ErrorState message={risk.error} onRetry={risk.refresh} />
              ) : (
                <>
                  <RiskFactors risk={risk.data} />
                  <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-fg-faint">
                    {risk.data?.method_note} Horizon: {risk.data?.horizon_minutes} min.
                  </p>
                </>
              )}
            </Card>
          </div>

          <div className={`grid grid-cols-1 gap-4 ${canSimulate ? "xl:grid-cols-2" : ""}`}>
            {canSimulate && <ScenarioPanel />}
            <Card
              title="Recent Alerts"
              icon={<BellRing size={15} />}
              actions={<Link to="/alerts" className="text-xs text-neon hover:underline">View all</Link>}
            >
              {alerts.loading && !alerts.data ? (
                <LoadingState />
              ) : alerts.error && !alerts.data ? (
                <ErrorState message={alerts.error} onRetry={alerts.refresh} />
              ) : !alerts.data?.length ? (
                <EmptyState title="No alerts for this zone" hint="Activate a scenario to see early warnings being generated." />
              ) : (
                <ul className="space-y-2">
                  {alerts.data.map((a) => (
                    <AlertRow key={a.id} alert={a} onOpen={setOpenAlert} onAck={acknowledge} ackPending={pending === a.id} />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {openAlert && (
        <AlertDetail
          alert={openAlert}
          zoneName={zones.find((z) => z.zone_id === openAlert.zone_id)?.name}
          onClose={() => setOpenAlert(null)}
          onAck={acknowledge}
          ackPending={pending === openAlert.id}
        />
      )}
    </div>
  );
}

function EarlyWarningBanner({ zone }: { zone: ZoneSummary }) {
  const outOfRange = zone.temperature_status === "critical";
  const ttb = zone.warning_time_to_breach_minutes;
  if (!outOfRange && (ttb === null || ttb > 30)) return null;
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${outOfRange ? "border-crit/50 bg-crit/10 shadow-glow-crit" : "border-warn/40 bg-warn/[0.07]"}`}
    >
      <AlertOctagon size={20} className={outOfRange ? "text-crit" : "text-warn"} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${outOfRange ? "text-crit" : "text-warn"}`}>
          {outOfRange
            ? `Temperature excursion in progress — ${fmtTemp(zone.temperature)} is outside ${zone.lower_limit}–${zone.upper_limit}°C`
            : `Early warning: excursion predicted in ~${fmtMinutes(ttb)}`}
        </p>
        <p className="text-xs text-fg-muted">
          {outOfRange
            ? "Follow your excursion procedure. See the alert details for the recommended action."
            : `The model forecasts ${zone.name} may leave its safe range before the limit is actually crossed (currently ${fmtTemp(zone.temperature)}).`}
        </p>
      </div>
      <InfoTip text={TIPS.earlyWarning} />
    </div>
  );
}

function TemperatureCard({ zone }: { zone: ZoneSummary }) {
  const tone = zone.temperature_status === "critical" ? "crit" : zone.temperature_status === "warning" ? "warn" : undefined;
  const Trend = zone.trend_per_hour >= 0 ? TrendingUp : TrendingDown;
  return (
    <Card title="Current Temperature" icon={<Thermometer size={15} />} tone={tone} tip={TIPS.excursion}>
      <div className="flex items-end justify-between gap-2">
        <div className="font-mono text-4xl font-semibold tracking-tight text-fg">
          {zone.temperature != null ? zone.temperature.toFixed(1) : "—"}
          <span className="ml-1 text-lg text-fg-muted">°C</span>
        </div>
        <TempStatusLabel zone={zone} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-fg-faint">Safe range</div>
          <div className="font-mono text-fg">{zone.lower_limit}–{zone.upper_limit}°C</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-fg-faint">Trend <InfoTip text={TIPS.trend} /></div>
          <div className={`flex items-center gap-1 font-mono ${Math.abs(zone.trend_per_hour) > 1 ? "text-warn" : "text-fg"}`}>
            <Trend size={12} /> {zone.trend_per_hour > 0 ? "+" : ""}{zone.trend_per_hour.toFixed(1)}°C/h
          </div>
        </div>
      </div>
      {zone.temperature == null && <p className="mt-2 text-xs text-warn">Latest reading missing — sensor returned no value.</p>}
    </Card>
  );
}

function HumidityCard({ zone }: { zone: ZoneSummary }) {
  return (
    <Card title="Humidity" icon={<Droplets size={15} />}>
      <div className="font-mono text-4xl font-semibold tracking-tight text-fg">
        {zone.humidity != null ? zone.humidity.toFixed(0) : "—"}
        <span className="ml-1 text-lg text-fg-muted">% RH</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
        <div className="h-full rounded-full bg-[#c4a6ff]" style={{ width: `${zone.humidity ?? 0}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-fg-faint">Ambient</div>
          <div className="font-mono text-fg">{fmtTemp(zone.ambient_temperature)}</div>
        </div>
        <div>
          <div className="flex items-center gap-1 text-fg-faint">Setpoint <InfoTip text={TIPS.setpoint} /></div>
          <div className="font-mono text-fg">{fmtTemp(zone.setpoint, 0)}</div>
        </div>
      </div>
    </Card>
  );
}

function EquipmentCard({ zone }: { zone: ZoneSummary }) {
  const rows = [
    {
      label: "Compressor",
      value: zone.compressor_status === "stopped" ? "Stopped" : zone.compressor_status === "running" ? "Running" : "—",
      tone: zone.compressor_status === "stopped" ? "crit" : "ok",
      extra: zone.compressor_status === "stopped" ? `${fmtNum(zone.compressor_off_minutes, 0)} min` : null,
    },
    {
      label: "Door",
      value: zone.door_status === "open" ? "Open" : zone.door_status === "closed" ? "Closed" : "—",
      tone: zone.door_status === "open" ? (zone.door_open_minutes >= 5 ? "crit" : "warn") : "ok",
      extra: zone.door_status === "open" ? `${fmtNum(zone.door_open_minutes, 0)} min` : null,
    },
    {
      label: "Sensor",
      value: zone.sensor_status === "suspicious" ? "Suspicious" : zone.sensor_status === "no_data" ? "No data" : "Normal",
      tone: zone.sensor_status === "normal" ? "ok" : "warn",
      extra: zone.sensor_id,
    },
  ] as const;
  return (
    <Card title="Equipment Status" icon={<Cpu size={15} />} tone={zone.compressor_status === "stopped" ? "crit" : undefined} tip={TIPS.sensor}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="text-sm text-fg-muted">{r.label}</span>
            <span className="flex items-center gap-2">
              {r.extra && <span className="font-mono text-[11px] text-fg-faint">{r.extra}</span>}
              <Badge tone={r.tone} dot>{r.value}</Badge>
            </span>
          </li>
        ))}
      </ul>
      {zone.sensor_issues.length > 0 && (
        <p className="mt-3 line-clamp-3 text-[11px] leading-snug text-warn">{zone.sensor_issues.map((i) => i.detail).join(" ")}</p>
      )}
    </Card>
  );
}

function RiskCard({ zone }: { zone: ZoneSummary }) {
  const ttb = zone.warning_time_to_breach_minutes;
  return (
    <Card title="AI Risk Score" icon={<Gauge size={15} />} tip={TIPS.risk} tone={zone.risk_category === "critical" ? "crit" : zone.risk_category === "high" ? "warn" : undefined}>
      <div className="flex items-center justify-between gap-2">
        <RiskGauge score={zone.risk_score} category={zone.risk_category} size={130} />
        <div className="text-right">
          <div className="text-lg"><RiskLabel category={zone.risk_category} /></div>
          <div className="text-[11px] text-fg-faint">heuristic · 30-min horizon</div>
        </div>
      </div>
      <p className="mt-2 text-xs text-fg-muted">
        {ttb != null && ttb <= 30
          ? <>Excursion predicted in <span className="font-mono text-warn">~{fmtMinutes(ttb)}</span></>
          : "No excursion predicted within 30 min."}
      </p>
    </Card>
  );
}

function ForecastSummary({ forecast, horizon }: { forecast: Forecast | null; horizon: number }) {
  if (!forecast?.available) return null;
  const last = forecast.points[forecast.points.length - 1];
  const ttb = forecast.time_to_breach_minutes;
  const wtb = forecast.warning_time_to_breach_minutes;
  return (
    <div className="mb-2 flex flex-wrap gap-2 text-xs">
      <Badge>
        In {horizon} min: <span className="font-mono text-fg">{fmtTemp(last?.temperature)}</span>
      </Badge>
      {ttb != null ? (
        <Badge tone="crit" dot>Mean forecast crosses {forecast.breach_side} limit in ~{fmtMinutes(ttb)}</Badge>
      ) : wtb != null ? (
        <Badge tone="warn" dot>Early-warning rule: possible breach in ~{fmtMinutes(wtb)}</Badge>
      ) : (
        <Badge tone="ok" dot>Within limits for the next {horizon} min</Badge>
      )}
    </div>
  );
}
