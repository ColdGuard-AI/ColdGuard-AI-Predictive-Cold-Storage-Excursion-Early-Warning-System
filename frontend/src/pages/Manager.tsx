import { Activity, AlertTriangle, ArrowRight, BellRing, Building2, CheckCircle2, ClipboardCheck, Gauge, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertDetail, AlertRow, useAcknowledge } from "../components/alerts";
import { FacilityMap } from "../components/FacilityMap";
import { Card, EmptyState, ErrorState, InfoTip, LoadingState, Segmented, SimulatedBadge, StaleBanner } from "../components/ui";
import { RiskFactors, RiskGauge, RiskLabel, TIPS } from "../components/zone";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { fmtMinutes, fmtTemp, fmtTime } from "../lib/format";
import { TONE_COLORS, zoneHeadline } from "../lib/status";
import { api } from "../services/api";
import type { Alert, ManagerZone } from "../types/api";

const WINDOWS = [
  { value: 60, label: "1 h" },
  { value: 240, label: "4 h" },
  { value: 720, label: "12 h" },
  { value: 1440, label: "24 h" },
];

function Kpi({ label, value, sub, tone, icon, tip }: { label: string; value: string; sub?: string; tone?: "ok" | "warn" | "crit"; icon: React.ReactNode; tip?: string }) {
  const color = tone ? TONE_COLORS[tone].fg : "#f2f5f3";
  return (
    <div className="rounded-xl border border-neon/10 bg-ink-800/90 p-4">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-fg-faint">
        <span className="text-neon/70">{icon}</span> {label} {tip && <InfoTip text={tip} />}
      </div>
      <div className="mt-1.5 font-mono text-2xl font-semibold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-fg-muted">{sub}</div>}
    </div>
  );
}

function pctTone(p: number | null): "ok" | "warn" | "crit" {
  if (p == null) return "warn";
  return p >= 99 ? "ok" : p >= 95 ? "warn" : "crit";
}

export default function Manager() {
  const { selectedZoneId, setSelectedZoneId, zones: liveZones } = useApp();
  const navigate = useNavigate();
  const [windowMin, setWindowMin] = useState(240);
  const [openAlert, setOpenAlert] = useState<Alert | null>(null);
  const overview = usePolling(() => api.managerOverview(windowMin), 2000, [windowMin]);
  const risk = usePolling(() => api.risk(selectedZoneId, 30), 2000, [selectedZoneId]);
  const { acknowledge, pending } = useAcknowledge((a) => {
    void overview.refresh();
    if (openAlert?.id === a.id) setOpenAlert(a);
  });

  if (overview.loading && !overview.data) return <LoadingState label="Loading facility overview…" />;
  if (!overview.data) return <ErrorState message={overview.error ?? "No data"} onRetry={overview.refresh} />;

  const { totals, zones, action_items } = overview.data;
  const selected = zones.find((z) => z.zone_id === selectedZoneId) ?? zones[0];
  const singleStoreZones = [selected];
  const zoneName = (id: string) => zones.find((z) => z.zone_id === id)?.name ?? liveZones?.find((z) => z.zone_id === id)?.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white tracking-tight"><Building2 size={20} className="text-cyan-400" /> Store Overview & Governance</h1>
          <p className="text-sm text-slate-400">
            Good {greeting()}. Here is your active cold storage facility profile. <SimulatedBadge />
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-mono">Compliance window:</span>
          <Segmented label="Compliance window" value={windowMin} onChange={setWindowMin} options={WINDOWS} />
        </div>
      </div>
      <StaleBanner error={overview.error} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={<CheckCircle2 size={13} />} label="Store Status" value={selected.temperature_status === "normal" ? "1 / 1 OK" : "0 / 1 Excursion"} tone={selected.temperature_status === "normal" ? "ok" : "crit"}
          sub={selected.temperature_status === "normal" ? "temperature within range" : "attention required"} />
        <Kpi icon={<BellRing size={13} />} label="Active alerts" value={String(selected.active_alert_count)} tone={selected.active_alert_count ? "crit" : "ok"}
          sub={`${selected.active_alert_count} active excursion flags`} />
        <Kpi icon={<ClipboardCheck size={13} />} label="Time in range" value={selected.time_in_range_pct != null ? `${selected.time_in_range_pct}%` : "—"}
          tone={pctTone(selected.time_in_range_pct)} sub={`last ${fmtMinutes(windowMin)}`}
          tip="Share of readings inside the safe temperature range during the selected compliance window." />
        <Kpi icon={<Gauge size={13} />} label="Store Risk Score" value={`${selected.risk_score ?? "—"}`}
          tone={selected.risk_category === "low" ? "ok" : selected.risk_category === "medium" ? "warn" : "crit"} sub={selected.name} tip={TIPS.risk} />
        <Kpi icon={<Activity size={13} />} label="Sim clock" value={fmtTime(overview.data.sim_time)} sub="1 s = 1 simulated min" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2" title="Storage room — live floor plan" icon={<Building2 size={15} />}
          tip="Shows live temperature, cooling unit on the wall, door seal status, and telemetry.">
          <FacilityMap zones={singleStoreZones} selectedId={selected?.zone_id ?? ""} onSelect={setSelectedZoneId} />
          <Legend />
        </Card>
        {selected && <RoomDetail z={selected} risk={risk.data} canWhatIf onOpen={(path) => { setSelectedZoneId(selected.zone_id); navigate(path); }} />}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Needs your review" icon={<AlertTriangle size={15} />}
          actions={<button onClick={() => navigate("/alerts")} className="text-xs text-cyan-400 hover:underline">All alerts</button>}>
          {!action_items.filter((a) => a.zone_id === selected.zone_id).length ? (
            <EmptyState title="Nothing to review" hint="All alerts for this store have been acknowledged." />
          ) : (
            <ul className="space-y-2">
              {action_items.filter((a) => a.zone_id === selected.zone_id).map((a) => (
                <AlertRow key={a.id} alert={a} zoneName={zoneName(a.zone_id)} onOpen={setOpenAlert} onAck={acknowledge} ackPending={pending === a.id} />
              ))}
            </ul>
          )}
        </Card>
        <Card title="Store compliance" icon={<ClipboardCheck size={15} />} tip="How long this store stayed inside its safe range during the selected window.">
          <ul className="space-y-4">
            {singleStoreZones.map((z) => <ComplianceRow key={z.zone_id} z={z} />)}
          </ul>
        </Card>
      </div>

      {openAlert && (
        <AlertDetail alert={openAlert} zoneName={zoneName(openAlert.zone_id)} onClose={() => setOpenAlert(null)} onAck={acknowledge} ackPending={pending === openAlert.id} />
      )}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 18 ? "afternoon" : "evening";
}

function Legend() {
  const item = (color: string, label: string) => (
    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border" style={{ background: color + "22", borderColor: color }} />{label}</span>
  );
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-fg-muted">
      {item(TONE_COLORS.ok.fg, "All good")}
      {item(TONE_COLORS.warn.fg, "Needs attention")}
      {item(TONE_COLORS.crit.fg, "Act now")}
      <span className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded bg-warn" /> Door open</span>
    </div>
  );
}

function RoomDetail({ z, risk, canWhatIf, onOpen }: { z: ManagerZone; risk: import("../types/api").Risk | null; canWhatIf: boolean; onOpen: (path: string) => void }) {
  const status = zoneHeadline(z);
  const c = TONE_COLORS[status.tone];
  const facts = [
    ["Time in range", z.time_in_range_pct != null ? `${z.time_in_range_pct}%` : "—"],
    ["Minutes out of range", String(z.excursion_minutes)],
    ["Lowest / highest", `${fmtTemp(z.min_temperature)} / ${fmtTemp(z.max_temperature)}`],
    ["Door open (total)", fmtMinutes(z.door_open_minutes_window) === "< 1 min" ? "0 min" : fmtMinutes(z.door_open_minutes_window)],
    ["Cooling off (total)", z.compressor_off_minutes_window ? fmtMinutes(z.compressor_off_minutes_window) : "0 min"],
    ["Missing readings", String(z.missing_readings)],
  ];
  return (
    <Card title={z.name} icon={<Gauge size={15} />} tone={status.tone === "crit" ? "crit" : status.tone === "warn" ? "warn" : undefined}>
      <div className="rounded-lg border p-3" style={{ borderColor: c.border, background: c.bg }}>
        <div className="text-base font-semibold" style={{ color: c.fg }}>{status.headline}</div>
        <p className="mt-0.5 text-sm text-fg">{status.detail}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <RiskGauge score={z.risk_score} category={z.risk_category} size={120} />
        <div className="text-right text-sm">
          <div><RiskLabel category={z.risk_category} /> risk</div>
          <div className="text-xs text-fg-muted">{z.scenario !== "normal" ? `Simulated: ${z.scenario_label}` : "Normal operation"}</div>
        </div>
      </div>
      <div className="mt-3">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">Why</h3>
        <RiskFactors risk={risk && risk.zone_id === z.zone_id ? risk : null} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-white/[0.06] pt-3 text-xs">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-fg-faint">{k}</dt>
            <dd className="font-mono text-fg">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => onOpen("/")} className="inline-flex items-center gap-1.5 rounded-lg border border-neon/25 bg-neon/[0.06] px-3 py-1.5 text-sm text-neon hover:bg-neon/10">
          Live monitor <ArrowRight size={14} />
        </button>
        {canWhatIf && (
          <button onClick={() => onOpen("/what-if")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
            <SlidersHorizontal size={14} /> Plan with What-If
          </button>
        )}
      </div>
    </Card>
  );
}

function ComplianceRow({ z }: { z: ManagerZone }) {
  const p = z.time_in_range_pct;
  const tone = pctTone(p);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-fg">{z.name}</span>
        <span className="font-mono" style={{ color: TONE_COLORS[tone].fg }}>{p != null ? `${p}%` : "—"}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full transition-all" style={{ width: `${p ?? 0}%`, background: TONE_COLORS[tone].fg }} />
      </div>
      <p className="mt-1 text-[11px] text-fg-faint">
        {z.excursion_minutes ? `${z.excursion_minutes} min out of range` : "No excursions"} · {z.readings_in_window} readings
      </p>
    </li>
  );
}
