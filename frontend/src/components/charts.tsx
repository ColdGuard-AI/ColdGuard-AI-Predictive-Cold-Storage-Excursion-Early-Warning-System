import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Forecast, Reading } from "../types/api";
import { CHART, fmtTime } from "../lib/format";

interface Row {
  t: number;
  observed?: number | null;
  forecast?: number | null;
  band?: [number, number] | null;
  humidity?: number | null;
}

const axisProps = {
  stroke: CHART.axis,
  tick: { fill: CHART.axis, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
  tickLine: false,
  axisLine: { stroke: "#DCE8F6" },
};

function timeTick(v: number) {
  return new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function domainWithLimits(values: number[], lower: number, upper: number): [number, number] {
  const all = [...values.filter((v) => Number.isFinite(v)), lower, upper];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = Math.max(0.5, (max - min) * 0.08);
  return [Math.floor((min - pad) * 2) / 2, Math.ceil((max + pad) * 2) / 2];
}

function TooltipBox({ active, payload, label, unit = "°C" }: { active?: boolean; payload?: any[]; label?: number; unit?: string }) {
  if (!active || !payload?.length || label === undefined) return null;
  const row = payload[0].payload as Row;
  const lines: { name: string; value: string; color: string }[] = [];
  if (row.observed != null) lines.push({ name: "Observed", value: `${row.observed.toFixed(2)}${unit}`, color: CHART.observed });
  if (row.forecast != null) lines.push({ name: "Forecast", value: `${row.forecast.toFixed(2)}${unit}`, color: CHART.forecast });
  if (row.band) lines.push({ name: "Tree spread", value: `${row.band[0].toFixed(1)} – ${row.band[1].toFixed(1)}${unit}`, color: CHART.band });
  if (row.humidity != null) lines.push({ name: "Humidity", value: `${row.humidity.toFixed(1)}%`, color: CHART.humidity });
  if (!lines.length) return null;
  return (
    <div className="rounded-xl border border-[#DCE8F6] bg-white p-3 text-xs shadow-xl font-sans">
      <div className="mb-1.5 font-mono font-bold text-[#0F172A]">{fmtTime(new Date(label).toISOString())}</div>
      <div className="space-y-1">
        {lines.map((l) => (
          <div key={l.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: l.color }} />
            <span className="text-[#475569] font-medium">{l.name}</span>
            <span className="ml-auto font-mono font-bold text-[#0F172A]">{l.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string; dashed?: boolean; area?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-[#475569]" aria-label="Chart legend">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          {i.area ? (
            <span className="h-2.5 w-4 rounded-sm border border-[#DCE8F6]" style={{ background: i.color, opacity: 0.35 }} />
          ) : (
            <svg width="18" height="6" aria-hidden>
              <line x1="0" y1="3" x2="18" y2="3" stroke={i.color} strokeWidth="2.5" strokeDasharray={i.dashed ? "4 3" : undefined} />
            </svg>
          )}
          <span className="text-[#0F172A]">{i.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function ForecastChart({
  readings,
  forecast,
  lower,
  upper,
  setpoint,
  height = 300,
}: {
  readings: Reading[];
  forecast: Forecast | null;
  lower: number;
  upper: number;
  setpoint?: number;
  height?: number;
}) {
  const rows: Row[] = readings.map((r) => ({ t: new Date(r.timestamp).getTime(), observed: r.temperature }));
  let nowT: number | null = null;
  if (forecast?.available && forecast.issued_at && forecast.base_temperature != null) {
    nowT = new Date(forecast.issued_at).getTime();
    const anchor = rows.find((r) => r.t === nowT);
    if (anchor) {
      anchor.forecast = forecast.base_temperature;
      anchor.band = [forecast.base_temperature, forecast.base_temperature];
    } else {
      rows.push({ t: nowT, forecast: forecast.base_temperature, band: [forecast.base_temperature, forecast.base_temperature] });
    }
    for (const p of forecast.points) {
      rows.push({
        t: new Date(p.timestamp).getTime(),
        forecast: p.temperature,
        band: p.lower != null && p.upper != null ? [p.lower, p.upper] : null,
      });
    }
  }
  rows.sort((a, b) => a.t - b.t);
  const values = rows.flatMap((r) => [r.observed, r.forecast, ...(r.band ?? [])]).filter((v): v is number => v != null);
  const domain = domainWithLimits(values, lower, upper);

  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Observed temperature and model forecast with configured limits">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={timeTick} minTickGap={40} {...axisProps} />
          <YAxis domain={domain} tickFormatter={(v: number) => `${v}°`} width={48} {...axisProps} />
          <Tooltip content={<TooltipBox />} cursor={{ stroke: "rgba(37,99,235,0.2)" }} />
          {nowT && (
            <ReferenceArea x1={nowT} x2={rows[rows.length - 1]?.t} fill={CHART.forecast} fillOpacity={0.05} ifOverflow="hidden" />
          )}
          <ReferenceLine y={upper} stroke={CHART.limit} strokeDasharray="6 4" label={{ value: `Upper ${upper}°C`, fill: CHART.limit, fontSize: 11, position: "insideTopLeft" }} />
          <ReferenceLine y={lower} stroke={CHART.limit} strokeOpacity={0.7} strokeDasharray="6 4" label={{ value: `Lower ${lower}°C`, fill: CHART.limit, fontSize: 11, position: "insideBottomLeft" }} />
          {setpoint !== undefined && <ReferenceLine y={setpoint} stroke={CHART.setpoint} strokeOpacity={0.5} strokeDasharray="2 4" />}
          {nowT && <ReferenceLine x={nowT} stroke="#94A3B8" label={{ value: "Now", fill: "#475569", fontSize: 11, position: "insideTopRight" }} />}
          <Area dataKey="band" stroke="none" fill={CHART.band} fillOpacity={0.25} isAnimationActive={false} connectNulls />
          <Line dataKey="observed" stroke={CHART.observed} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls={false} />
          <Line dataKey="forecast" stroke={CHART.forecast} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3, fill: CHART.forecast, strokeWidth: 0 }} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Shaded periods (door open / compressor stopped) from consecutive readings. */
export function eventSpans(readings: Reading[], predicate: (r: Reading) => boolean): [number, number][] {
  const spans: [number, number][] = [];
  let start: number | null = null;
  readings.forEach((r, i) => {
    const t = new Date(r.timestamp).getTime();
    if (predicate(r) && start === null) start = t;
    const next = readings[i + 1];
    if (start !== null && (!next || !predicate(next))) {
      spans.push([start, t + 60_000]);
      start = null;
    }
  });
  return spans;
}

export function HistoryTemperatureChart({
  readings,
  forecast,
  lower,
  upper,
  showEvents,
  height = 300,
}: {
  readings: Reading[];
  forecast: Forecast | null;
  lower: number;
  upper: number;
  showEvents: boolean;
  height?: number;
}) {
  const doorSpans = showEvents ? eventSpans(readings, (r) => r.door_status === "open") : [];
  const compSpans = showEvents ? eventSpans(readings, (r) => r.compressor_status === "stopped") : [];
  return (
    <div className="relative">
      <ForecastChart readings={readings} forecast={forecast} lower={lower} upper={upper} height={height} />
      {showEvents && (doorSpans.length > 0 || compSpans.length > 0) && (
        <EventStrip readings={readings} forecast={forecast} doorSpans={doorSpans} compSpans={compSpans} />
      )}
    </div>
  );
}

function EventStrip({ readings, forecast, doorSpans, compSpans }: { readings: Reading[]; forecast: Forecast | null; doorSpans: [number, number][]; compSpans: [number, number][] }) {
  if (!readings.length) return null;
  const t0 = new Date(readings[0].timestamp).getTime();
  const lastForecast = forecast?.available && forecast.points.length ? new Date(forecast.points[forecast.points.length - 1].timestamp).getTime() : null;
  const t1 = Math.max(new Date(readings[readings.length - 1].timestamp).getTime(), lastForecast ?? 0);
  const pct = (t: number) => `${((t - t0) / Math.max(1, t1 - t0)) * 100}%`;
  const row = (spans: [number, number][], color: string, label: string) => (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-xs font-semibold text-[#475569]">{label}</span>
      <div className="relative h-2.5 flex-1 rounded-full bg-slate-100 border border-[#DCE8F6]">
        {spans.map(([a, b]) => (
          <span key={a} className="absolute inset-y-0 rounded-full" style={{ left: pct(a), width: `calc(${pct(b)} - ${pct(a)})`, background: color }} />
        ))}
      </div>
    </div>
  );
  return (
    <div className="mt-3 space-y-2 pl-[36px] pr-3" aria-label="Equipment events timeline">
      {row(doorSpans, "#F59E0B", "Door open")}
      {row(compSpans, "#EF4444", "Compressor off")}
    </div>
  );
}

export function HumidityChart({ readings, height = 200 }: { readings: Reading[]; height?: number }) {
  const rows: Row[] = readings.map((r) => ({ t: new Date(r.timestamp).getTime(), humidity: r.humidity }));
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Observed relative humidity">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={timeTick} minTickGap={40} {...axisProps} />
          <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} width={48} {...axisProps} />
          <Tooltip content={<TooltipBox unit="%" />} cursor={{ stroke: "rgba(37,99,235,0.2)" }} />
          <Line dataKey="humidity" stroke={CHART.humidity} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
