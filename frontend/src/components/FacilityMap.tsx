import { BellRing, Droplets, Fan, Radio } from "lucide-react";
import { fmtMinutes } from "../lib/format";
import { TONE_COLORS, zoneHeadline } from "../lib/status";
import type { ManagerZone } from "../types/api";

/** Tiny inline sparkline of the last hour, with the safe band shaded. */
export function Sparkline({ values, lower, upper, color, height = 36 }: { values: (number | null)[]; lower: number; upper: number; color: string; height?: number }) {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length < 2) return <div style={{ height }} className="text-[10px] text-fg-faint">No recent data</div>;
  const min = Math.min(...nums, lower) - 0.5;
  const max = Math.max(...nums, upper) + 0.5;
  const w = 200;
  const y = (v: number) => height - ((v - min) / (max - min)) * height;
  const x = (i: number) => (i / (values.length - 1)) * w;
  let d = "";
  values.forEach((v, i) => {
    if (v == null) return;
    d += `${d && values[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      <rect x="0" y={y(upper)} width={w} height={Math.max(0, y(lower) - y(upper))} fill="#3dff8f" opacity="0.07" />
      <line x1="0" x2={w} y1={y(upper)} y2={y(upper)} stroke="#ff5c70" strokeOpacity="0.5" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Vertical thermometer: where the current reading sits relative to the safe band. */
function Thermometer({ z, color }: { z: ManagerZone; color: string }) {
  const span = z.upper_limit - z.lower_limit;
  const lo = z.lower_limit - span * 0.5;
  const hi = z.upper_limit + span * 0.8;
  const pct = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
  const t = z.temperature;
  return (
    <div className="relative h-24 w-3 shrink-0 rounded-full bg-white/[0.06]" role="img" aria-label={`Temperature ${t ?? "unknown"}°C, safe range ${z.lower_limit} to ${z.upper_limit}°C`}>
      <div className="absolute inset-x-0 rounded-full bg-neon/15" style={{ bottom: `${pct(z.lower_limit)}%`, height: `${pct(z.upper_limit) - pct(z.lower_limit)}%` }} />
      {t != null && (
        <div className="absolute inset-x-0 bottom-0 rounded-full transition-all duration-700" style={{ height: `${pct(t)}%`, background: color, boxShadow: `0 0 8px ${color}88` }} />
      )}
      <span className="absolute -right-1 h-px w-5 bg-crit/70" style={{ bottom: `${pct(z.upper_limit)}%` }} />
    </div>
  );
}

function Room({ z, selected, onSelect }: { z: ManagerZone; selected: boolean; onSelect: () => void }) {
  const status = zoneHeadline(z);
  const c = TONE_COLORS[status.tone];
  const running = z.compressor_status === "running";
  const doorOpen = z.door_status === "open";
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${z.name}: ${status.headline}. ${z.temperature?.toFixed(1) ?? "no reading"} degrees.`}
      className={`relative flex min-h-[260px] flex-col rounded-lg border-2 p-4 pb-6 text-left transition-all ${selected ? "ring-2 ring-neon/60 ring-offset-2 ring-offset-ink-800" : "hover:brightness-125"}`}
      style={{ background: c.bg, borderColor: c.border, boxShadow: status.tone === "crit" ? `0 0 24px -6px ${c.fg}` : undefined }}
    >
      {/* Refrigeration unit mounted on the wall */}
      <span
        className={`absolute -top-3 right-4 flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${running ? "border-neon/40 bg-ink-900 text-neon" : "border-crit/60 bg-crit/20 text-crit"}`}
        title={running ? "Compressor running" : "Compressor stopped"}
      >
        <Fan size={12} className={running ? "animate-[spin_2.5s_linear_infinite]" : ""} />
        {running ? "Cooling" : "Stopped"}
      </span>

      <div className="flex items-start justify-between gap-2 pr-16">
        <div>
          <div className="text-sm font-semibold text-fg">{z.name}</div>
          <div className="text-[11px] text-fg-muted">{z.product}</div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <Thermometer z={z} color={c.fg} />
        <div className="min-w-0">
          <div className="font-mono text-3xl font-semibold tracking-tight 2xl:text-4xl" style={{ color: status.tone === "ok" ? "#f2f5f3" : c.fg }}>
            {z.temperature != null ? z.temperature.toFixed(1) : "—"}<span className="text-base text-fg-muted">°C</span>
          </div>
          <div className="text-[11px] text-fg-muted">safe {z.lower_limit} to {z.upper_limit}°C</div>
          <div className="mt-2 text-sm font-semibold" style={{ color: c.fg }}>{status.headline}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-muted">
        <span className="flex items-center gap-1"><Droplets size={12} className="text-[#c4a6ff]" /> {z.humidity?.toFixed(0) ?? "—"}%</span>
        <span className="flex items-center gap-1">
          <Radio size={12} className={z.sensor_status === "normal" ? "text-neon" : "text-warn"} /> Sensor {z.sensor_status === "normal" ? "OK" : "check"}
        </span>
        {z.unacknowledged_alerts > 0 && (
          <span className="flex items-center gap-1 text-crit"><BellRing size={12} /> {z.unacknowledged_alerts} to review</span>
        )}
      </div>

      <div className="mt-auto pt-3">
        <Sparkline values={z.sparkline} lower={z.lower_limit} upper={z.upper_limit} color={c.fg} />
        <div className="text-[10px] text-fg-faint">last 60 min</div>
      </div>

      {/* Door on the bottom wall: a gap with a swinging leaf when open */}
      <span className="absolute -bottom-[2px] left-1/2 flex -translate-x-1/2 flex-col items-center" aria-hidden>
        <span className="relative block h-[3px] w-14" style={{ background: doorOpen ? "#070908" : c.border }}>
          <span
            className="absolute left-0 top-0 block h-[3px] w-14 origin-left rounded transition-transform duration-500"
            style={{ background: doorOpen ? "#fbbf24" : "transparent", transform: doorOpen ? "rotate(-50deg)" : "rotate(0deg)" }}
          />
        </span>
      </span>
      <span className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] ${doorOpen ? "text-warn" : "text-fg-faint"}`}>
        Door {doorOpen ? `open ${z.door_open_minutes >= 1 ? fmtMinutes(z.door_open_minutes) : ""}` : "closed"}
      </span>
    </button>
  );
}

/** Floor plan of the facility: each storage room is drawn as a room with its equipment. */
export function FacilityMap({ zones, selectedId, onSelect }: { zones: ManagerZone[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,rgba(255,255,255,0.025)_24px),repeating-linear-gradient(90deg,transparent,transparent_23px,rgba(255,255,255,0.025)_24px)] p-4 pt-6 sm:p-6 sm:pt-8">
      <div className="grid grid-cols-1 gap-x-4 gap-y-10 md:grid-cols-3">
        {zones.map((z) => (
          <Room key={z.zone_id} z={z} selected={z.zone_id === selectedId} onSelect={() => onSelect(z.zone_id)} />
        ))}
      </div>
      {/* Loading corridor */}
      <div className="mt-9 flex items-center justify-center rounded-md border border-dashed border-white/10 py-2 text-[11px] uppercase tracking-[0.2em] text-fg-faint">
        Loading corridor · ambient
      </div>
    </div>
  );
}
