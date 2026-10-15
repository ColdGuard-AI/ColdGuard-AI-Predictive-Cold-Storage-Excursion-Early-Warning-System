import { ChevronDown, CircleCheck, DoorOpen, Lightbulb, PlugZap, RotateCcw, ShieldCheck, Sun, TriangleAlert } from "lucide-react";
import { useState } from "react";
import {
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
import { Button, Card, ErrorState, LoadingState, SimulatedBadge } from "../components/ui";
import { ZoneTabs } from "../components/zone";
import { useApp } from "../hooks/AppContext";
import { CHART, fmtMinutes, fmtTemp } from "../lib/format";
import { api } from "../services/api";
import type { WhatIfResponse, WhatIfScenarioId } from "../types/api";

// Plain-language questions mapped onto the simulator's scenarios.
const EVENTS: { id: WhatIfScenarioId; question: string; example: string; icon: typeof PlugZap }[] = [
  { id: "compressor_failure", question: "The cooling stops", example: "e.g. power cut or compressor breakdown", icon: PlugZap },
  { id: "door_open", question: "Someone leaves the door open", example: "e.g. during a delivery", icon: DoorOpen },
  { id: "ambient_increase", question: "It gets very hot outside", example: "e.g. heatwave or broken ventilation", icon: Sun },
  { id: "normal", question: "Everything goes back to normal", example: "e.g. the problem is fixed now", icon: ShieldCheck },
];

const DURATIONS: { label: string; value: number | null }[] = [
  { label: "15 minutes", value: 15 },
  { label: "30 minutes", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "Until someone fixes it", value: null },
];

const HEAT: { label: string; value: number }[] = [
  { label: "Warm (+5°C)", value: 5 },
  { label: "Hot (+10°C)", value: 10 },
  { label: "Heatwave (+18°C)", value: 18 },
];

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${selected ? "border-neon/50 bg-neon/10 text-neon" : "border-white/10 bg-ink-900/60 text-fg-muted hover:border-neon/30 hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-fg">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-neon/15 font-mono text-xs text-neon">{n}</span>
      {children}
    </h2>
  );
}

export default function WhatIf() {
  const { selectedZone, selectedZoneId, notify } = useApp();
  const [event, setEvent] = useState<WhatIfScenarioId>("compressor_failure");
  const [duration, setDuration] = useState<number | null>(60);
  const [heat, setHeat] = useState(10);
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    // Look far enough ahead to see the effect and the recovery afterwards.
    const projection = Math.min(240, Math.max(120, (duration ?? 120) + 60));
    try {
      setResult(
        await api.whatIf({
          zone_id: selectedZoneId,
          scenario: event,
          duration_minutes: event === "normal" ? null : duration,
          ambient_delta: heat,
          projection_minutes: projection,
        }),
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      notify("error", `Could not run the simulation: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setEvent("compressor_failure");
    setDuration(60);
    setHeat(10);
    setResult(null);
    setError(null);
  };

  const chosen = EVENTS.find((e) => e.id === event)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">What happens if…?</h1>
          <p className="text-sm text-fg-muted">
            Try out a problem before it happens and see whether your products would stay safe. Nothing changes in the real room.
          </p>
        </div>
        <ZoneTabs />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <StepTitle n={1}>Which room?</StepTitle>
          <p className="-mt-1 mb-5 text-sm text-fg-muted">
            <span className="text-fg">{selectedZone?.name ?? "—"}</span> · {selectedZone?.product} · must stay between{" "}
            <span className="font-mono text-fg">{selectedZone?.lower_limit}°C</span> and <span className="font-mono text-fg">{selectedZone?.upper_limit}°C</span>.
            <span className="block text-xs text-fg-faint">Change it with the room buttons above.</span>
          </p>

          <StepTitle n={2}>What happens?</StepTitle>
          <div role="radiogroup" aria-label="Event" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EVENTS.map(({ id, question, example, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={event === id}
                onClick={() => setEvent(id)}
                className={`flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ${event === id ? "border-neon/50 bg-neon/[0.08]" : "border-white/[0.08] bg-ink-900/60 hover:border-neon/30"}`}
              >
                <Icon size={18} className={event === id ? "text-neon" : "text-fg-muted"} />
                <span>
                  <span className="block text-sm font-medium text-fg">{question}</span>
                  <span className="block text-[11px] text-fg-faint">{example}</span>
                </span>
              </button>
            ))}
          </div>

          {event === "ambient_increase" && (
            <div className="mt-5">
              <StepTitle n={3}>How hot?</StepTitle>
              <div role="radiogroup" aria-label="How hot" className="flex flex-wrap gap-2">
                {HEAT.map((h) => <Choice key={h.value} selected={heat === h.value} onClick={() => setHeat(h.value)}>{h.label}</Choice>)}
              </div>
            </div>
          )}

          {event !== "normal" && (
            <div className="mt-5">
              <StepTitle n={event === "ambient_increase" ? 4 : 3}>For how long?</StepTitle>
              <div role="radiogroup" aria-label="Duration" className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => <Choice key={d.label} selected={duration === d.value} onClick={() => setDuration(d.value)}>{d.label}</Choice>)}
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-2">
            <Button variant="primary" className="flex-1 py-2.5 text-base" onClick={run} loading={loading}>
              Show me what happens
            </Button>
            <Button onClick={reset} aria-label="Start over"><RotateCcw size={14} /> Start over</Button>
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-3">
          {loading && !result ? (
            <Card><LoadingState label="Simulating the next hours…" /></Card>
          ) : error && !result ? (
            <Card><ErrorState message={error} onRetry={run} /></Card>
          ) : !result ? (
            <Card>
              <div className="flex flex-col items-center py-12 text-center">
                <chosen.icon size={30} className="text-neon/70" />
                <p className="mt-3 text-base text-fg">Pick a situation and press <span className="text-neon">“Show me what happens”</span>.</p>
                <p className="mt-1 max-w-md text-sm text-fg-muted">You will get a simple answer: will the products stay safe, how much time you have, and what to do.</p>
              </div>
            </Card>
          ) : (
            <Answer result={result} stale={result.zone_id !== selectedZoneId} question={EVENTS.find((e) => e.id === result.scenario)!.question} />
          )}
        </div>
      </div>
    </div>
  );
}

function Answer({ result, stale, question }: { result: WhatIfResponse; stale: boolean; question: string }) {
  const [showDetails, setShowDetails] = useState(false);
  const s = result.scenario_result;
  const b = result.baseline;
  const { lower, upper } = result.limits;
  const breach = s.time_to_limit_minutes;
  const warn = s.ai_first_warning_minute;

  let verdict: { tone: "ok" | "warn" | "crit"; title: string; text: string };
  if (s.starts_out_of_range) {
    verdict = s.returns_to_range_minute != null
      ? { tone: "warn", title: `Back to safe in about ${fmtMinutes(s.returns_to_range_minute)}`, text: "The room is out of range right now, but in this situation it recovers." }
      : { tone: "crit", title: "Stays out of the safe range", text: "The room is already too warm and does not recover in this situation." };
  } else if (breach != null) {
    verdict = { tone: "crit", title: `Products at risk in about ${fmtMinutes(breach)}`, text: `The room would get warmer than ${upper}°C after ${fmtMinutes(breach)} and reach up to ${fmtTemp(s.max_temperature)}.` };
  } else if (s.max_temperature > upper - 0.2 * (upper - lower)) {
    verdict = { tone: "warn", title: "Safe, but only just", text: `The room stays in range but gets close to the limit (up to ${fmtTemp(s.max_temperature)}).` };
  } else {
    verdict = { tone: "ok", title: "Products stay safe", text: `The room stays between ${lower}°C and ${upper}°C (highest ${fmtTemp(s.max_temperature)}).` };
  }
  const colors = { ok: "border-neon/40 bg-neon/[0.07] text-neon", warn: "border-warn/40 bg-warn/[0.07] text-warn", crit: "border-crit/50 bg-crit/10 text-crit" }[verdict.tone];
  const Icon = verdict.tone === "ok" ? CircleCheck : TriangleAlert;

  const rows = [
    ...result.history.map((h) => ({ minute: h.minute, now: h.temperature })),
    ...b.points.map((p, i) => ({ minute: p.minute, normal: p.temperature, event: s.points[i]?.temperature })),
  ];
  const temps = rows.flatMap((r) => [("now" in r ? r.now : null), ("normal" in r ? r.normal : null), ("event" in r ? r.event : null)]).filter((v): v is number => v != null);
  const yMin = Math.floor(Math.min(...temps, lower) - 1);
  const yMax = Math.ceil(Math.max(...temps, upper) + 1);

  return (
    <>
      {stale && <p className="rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-warn">This answer is for a different room. Press the button again to update it.</p>}

      <div role="status" className={`rounded-xl border p-5 ${colors}`}>
        <div className="flex items-start gap-3">
          <Icon size={28} className="shrink-0" />
          <div>
            <p className="text-xs uppercase tracking-wider opacity-80">If “{question.toLowerCase()}”…</p>
            <h2 className="text-2xl font-semibold">{verdict.title}</h2>
            <p className="mt-1 text-sm text-fg">{verdict.text}</p>
            <p className="mt-2 text-xs text-fg-muted">
              Assumes: {result.scenario === "normal"
                ? "any current problem is fixed now."
                : `${question.toLowerCase()} ${result.parameters.duration_minutes != null ? `for ${fmtMinutes(result.parameters.duration_minutes)}, then everything returns to normal` : "and nobody fixes it"}.`}
              {" "}Compared with: {result.baseline_label.toLowerCase()}.
            </p>
          </div>
        </div>
        {!s.starts_out_of_range && breach != null && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact label="ColdGuard would warn you" value={warn != null ? `after ${fmtMinutes(warn)}` : "—"} />
            <Fact label="Time to react" value={s.ai_lead_time_minutes != null ? fmtMinutes(s.ai_lead_time_minutes) : "—"} highlight />
            <Fact label="Limit crossed" value={`after ${fmtMinutes(breach)}`} />
          </div>
        )}
      </div>

      <Card title="Temperature over the next hours" actions={<SimulatedBadge text="Simulation" />}>
        <div className="h-[280px] w-full" role="img" aria-label="Temperature if nothing happens versus if the event happens, with the safe range shaded green">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <ReferenceArea y1={lower} y2={upper} fill="#3dff8f" fillOpacity={0.07} ifOverflow="extendDomain"
                label={{ value: "Safe range", fill: "#3dff8f", fontSize: 11, position: "insideTopLeft", opacity: 0.8 }} />
              <XAxis dataKey="minute" type="number" domain={["dataMin", "dataMax"]} stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false}
                tickFormatter={(v: number) => (v === 0 ? "now" : v < 0 ? `${v}m` : v % 60 === 0 ? `+${v / 60}h` : `+${v}m`)} />
              <YAxis domain={[yMin, yMax]} tickFormatter={(v: number) => `${v}°`} width={48} stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#0b0e0d", border: "1px solid rgba(61,255,143,0.2)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v: number) => (v <= 0 ? (v === 0 ? "Now" : `${-v} min ago`) : `In ${fmtMinutes(v)}`)}
                formatter={(v: number, name: string) => [`${v?.toFixed?.(1)}°C`, name]}
              />
              <ReferenceLine x={0} stroke="rgba(255,255,255,0.35)" label={{ value: "Now", fill: "#9aa6a0", fontSize: 11, position: "insideTopRight" }} />
              {warn != null && breach != null && (
                <ReferenceLine x={warn} stroke="#fbbf24" strokeDasharray="3 3" label={{ value: "Warning", fill: "#fbbf24", fontSize: 11, position: "insideBottomRight" }} />
              )}
              <Line dataKey="now" name="Measured" stroke={CHART.observed} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              <Line dataKey="normal" name="If nothing happens" stroke="#9aa6a0" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
              <Line dataKey="event" name={`If ${question.toLowerCase()}`} stroke={CHART.scenario} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-neon" /> Measured</li>
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-fg-muted" /> If nothing happens</li>
          <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-[#ff8a5c]" /> If {question.toLowerCase()}</li>
          <li className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-neon/20" /> Safe range</li>
        </ul>
      </Card>

      <Card title="What you should do" icon={<Lightbulb size={15} />}>
        <ol className="space-y-2">
          {result.recommendations.map((r, i) => (
            <li key={r} className="flex items-start gap-2.5 text-sm text-fg">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-neon/15 font-mono text-[11px] text-neon">{i + 1}</span>
              {r}
            </li>
          ))}
        </ol>
      </Card>

      <div className="rounded-xl border border-white/[0.07] bg-ink-800/60">
        <button onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}
          className="flex w-full items-center justify-between px-4 py-3 text-sm text-fg-muted hover:text-fg">
          Technical details (for engineers)
          <ChevronDown size={16} className={`transition-transform ${showDetails ? "rotate-180" : ""}`} />
        </button>
        {showDetails && (
          <div className="space-y-3 border-t border-white/[0.06] px-4 py-3 text-xs text-fg-muted">
            <table className="w-full">
              <thead><tr className="text-left text-fg-faint"><th className="pb-1 font-medium">Metric</th><th className="pb-1 font-medium">Nothing happens</th><th className="pb-1 font-medium">Event</th></tr></thead>
              <tbody className="font-mono text-fg">
                <tr><td className="py-0.5 font-sans text-fg-muted">Highest temperature</td><td>{fmtTemp(b.max_temperature)}</td><td>{fmtTemp(s.max_temperature)}</td></tr>
                <tr><td className="py-0.5 font-sans text-fg-muted">Temperature at end</td><td>{fmtTemp(b.final_temperature)}</td><td>{fmtTemp(s.final_temperature)}</td></tr>
                <tr><td className="py-0.5 font-sans text-fg-muted">Peak risk score (0–100)</td><td>{b.peak_risk ?? "—"}</td><td>{s.peak_risk ?? "—"}</td></tr>
              </tbody>
            </table>
            <p>Baseline = {result.baseline_label}. Projection length {result.parameters.projection_minutes} min. Current risk score {result.current_risk ?? "—"}.</p>
            <ul className="space-y-1">{result.notes.map((n) => <li key={n}>• {n}</li>)}</ul>
          </div>
        )}
      </div>
    </>
  );
}

function Fact({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/70 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-fg-faint">{label}</div>
      <div className={`font-mono text-lg ${highlight ? "text-neon" : "text-fg"}`}>{value}</div>
    </div>
  );
}
