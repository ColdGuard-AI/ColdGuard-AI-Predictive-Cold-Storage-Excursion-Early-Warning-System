import { AlertTriangle, BrainCircuit, Gauge, ListChecks, ScanLine } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, EmptyState, ErrorState, InfoTip, LoadingState, SimulatedBadge, Stat } from "../components/ui";
import { usePolling } from "../hooks/usePolling";
import { CHART, fmtDateTime, fmtPct } from "../lib/format";
import { api } from "../services/api";
import type { ExcursionScores } from "../types/api";

const tooltipStyle = { background: "#0b0e0d", border: "1px solid rgba(61,255,143,0.2)", borderRadius: 8, fontSize: 12 };

const RISK_RULES = [
  ["Forecast proximity", "0–40", "Closest approach of the ML forecast (within the selected horizon) to a limit; full points once it crosses."],
  ["Current position", "0–20", "Distance of the current reading from the nearest limit; 20 if already outside the range."],
  ["Temperature trend", "0–15", "15-minute rate of change toward a limit; full points at 0.1°C/min (6°C/h)."],
  ["Equipment / door", "0–20", "Compressor stopped: 15. Door open ≥ 5 min: 10 (brief opening: 3). Capped at 20."],
  ["Sensor reliability", "0–10", "Sensor flagged suspicious — the other components may be unreliable."],
];

function ScoreRow({ name, s, highlight }: { name: string; s: ExcursionScores; highlight?: boolean }) {
  return (
    <tr className={`border-t border-white/[0.05] ${highlight ? "text-neon" : "text-fg"}`}>
      <td className="py-1.5 pr-2 font-sans">{name}</td>
      <td className="font-mono">{fmtPct(s.precision)}</td>
      <td className="font-mono">{fmtPct(s.recall)}</td>
      <td className="font-mono">{s.f1 != null ? s.f1.toFixed(2) : "—"}</td>
      <td className="hidden font-mono text-fg-muted sm:table-cell">{s.true_positives}/{s.false_positives}/{s.false_negatives}</td>
    </tr>
  );
}

export default function Model() {
  const res = usePolling(api.modelMetrics, 0);
  if (res.loading) return <LoadingState label="Loading model metrics…" />;
  if (res.error) return <ErrorState message={res.error} onRetry={res.refresh} />;
  if (!res.data?.available || !res.data.metrics) {
    return (
      <Card title="Model unavailable">
        <EmptyState title={res.data?.reason ?? "The forecasting model has not been trained."} hint="Run `python -m app.train` in the backend folder, then restart the API." />
      </Card>
    );
  }
  const m = res.data.metrics;
  const ex = m.excursion_warning_30min;
  const mae = m.horizons.map((h) => ({ horizon: `${h.horizon_minutes}m`, Model: h.mae_model, Persistence: h.mae_persistence, Trend: h.mae_trend }));
  const h30 = m.horizons.find((h) => h.horizon_minutes === 30);
  const improvement = h30 ? 1 - h30.mae_model / h30.mae_persistence : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-fg"><BrainCircuit size={20} className="text-neon" /> Model & Method</h1>
        <p className="text-sm text-fg-muted">How forecasts, risk scores and sensor checks are produced — and how well the model does on held-out simulated data.</p>
      </div>

      <div role="note" className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/[0.05] px-4 py-3 text-sm">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" />
        <p className="text-fg">
          <span className="font-semibold text-warn">Prototype, simulated data only.</span> These metrics measure how well the model reproduces the
          simulator's own physics. They say nothing about accuracy on real cold rooms, and the system is not validated for medical,
          pharmaceutical or food-safety decisions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-neon/10 bg-ink-800/90 p-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Model" value="Random Forest" sub={`${m.n_estimators} trees, multi-output`} />
        <Stat label="Train samples" value={m.n_train_samples.toLocaleString()} sub={`${m.training_days_simulated ?? "?"} simulated days × 3 zones`} />
        <Stat label="Test samples" value={m.n_test_samples.toLocaleString()} sub="later, held-out period" />
        <Stat label="MAE @30 min" value={h30 ? `${h30.mae_model.toFixed(2)}°C` : "—"} sub={h30 ? `persistence ${h30.mae_persistence.toFixed(2)}°C` : undefined}
          tip="Mean absolute error of the predicted temperature 30 minutes ahead, on the held-out test period." />
        <Stat label="vs persistence" value={improvement != null ? `${Math.round(improvement * 100)}% lower` : "—"} tip="Persistence baseline: 'the temperature stays where it is now'." />
        <Stat label="Trained" value={fmtDateTime(m.trained_at)} sub={m.training_seconds ? `${m.training_seconds}s` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Forecast error by horizon (MAE, °C)" tip="Lower is better. Persistence = no change. Trend = extrapolate the last 15-minute slope." actions={<SimulatedBadge text="Held-out simulated data" />}>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mae} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="horizon" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} />
                <YAxis stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 11 }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(3)}°C`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="Model" stroke={CHART.observed} strokeWidth={2.2} dot={{ r: 2 }} isAnimationActive={false} />
                <Line dataKey="Persistence" stroke="#9aa6a0" strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line dataKey="Trend" stroke={CHART.forecast} strokeDasharray="2 3" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[11px] text-fg-faint">{m.split}. Target: {m.target}.</p>
        </Card>

        <Card title="Early-warning performance (30 min)" tip={ex.description}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-fg-faint">
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 font-medium">Precision</th>
                  <th className="pb-2 font-medium">Recall</th>
                  <th className="pb-2 font-medium">F1</th>
                  <th className="hidden pb-2 font-medium sm:table-cell">TP/FP/FN</th>
                </tr>
              </thead>
              <tbody>
                <ScoreRow name="Model, warning rule (live)" s={ex.model_warning_rule} highlight />
                <ScoreRow name="Model, mean forecast" s={ex.model_mean} />
                <ScoreRow name="Trend baseline" s={ex.trend_baseline} />
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-fg-muted">
            <li>• Test minutes: {ex.positives_in_test} with an upcoming breach, {ex.negatives_in_test.toLocaleString()} without.</li>
            <li>• Live alerts use: {ex.warning_rule}.</li>
            <li>• The plain mean forecast is more precise but misses more excursions; the simple trend baseline is competitive on this simulated data — an honest sign that the task is relatively easy here.</li>
          </ul>
        </Card>

        <Card title="Feature importance" tip="Impurity-based importance from the Random Forest. Indicates what the model relies on, not causal effect.">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.feature_importance} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 40 }}>
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" stroke={CHART.axis} tick={{ fill: CHART.axis, fontSize: 10 }} tickLine={false} />
                <YAxis type="category" dataKey="feature" interval={0} stroke={CHART.axis} tick={{ fill: "#9aa6a0", fontSize: 11 }} tickLine={false} width={120} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.03)" }} formatter={(v: number) => v.toFixed(3)} />
                <Bar dataKey="importance" fill={CHART.observed} fillOpacity={0.75} radius={[0, 3, 3, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Risk score (heuristic)" icon={<Gauge size={15} />}>
          <p className="mb-3 text-sm text-fg-muted">
            The risk score is a transparent rule set, <span className="text-fg">not</span> a model output or a probability. Components are summed and capped at 100.
          </p>
          <table className="w-full text-sm">
            <tbody>
              {RISK_RULES.map(([name, pts, desc]) => (
                <tr key={name} className="border-t border-white/[0.05] align-top">
                  <td className="py-1.5 pr-2 text-fg">{name}</td>
                  <td className="whitespace-nowrap py-1.5 pr-2 font-mono text-neon">{pts}</td>
                  <td className="py-1.5 text-xs text-fg-muted">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-fg-muted">Categories: Low &lt; 25 ≤ Medium &lt; 50 ≤ High &lt; 75 ≤ Critical.</p>
        </Card>

        <Card title="Sensor anomaly detection" icon={<ScanLine size={15} />}>
          <ul className="space-y-2 text-sm text-fg-muted">
            <li><span className="text-fg">Missing data</span> — 2+ of the last 10 readings have no temperature.</li>
            <li><span className="text-fg">Stuck sensor</span> — exactly the same value for 15+ consecutive minutes.</li>
            <li><span className="text-fg">Spike</span> — a reading more than 2.5°C from the median of the previous readings: faster than the room can physically change.</li>
            <li className="flex items-start gap-1"><span><span className="text-fg">Isolation Forest</span> — trained on fault-free simulated readings (1-min change, deviation from rolling median, local volatility). Flags the sensor only if 3+ of the last 10 readings look unusual.</span><InfoTip text="Isolation Forest isolates unusual points with random splits; points that are isolated quickly are considered anomalous." /></li>
          </ul>
          <p className="mt-3 text-xs text-fg-faint">While the sensor is suspicious, predicted-excursion alerts are suppressed and a sensor alert recommends independent verification.</p>
        </Card>

        <Card title="Limitations" icon={<ListChecks size={15} />}>
          <ul className="space-y-1.5 text-sm text-fg-muted">
            {m.limitations.map((l) => <li key={l}>• {l}</li>)}
          </ul>
        </Card>
      </div>
    </div>
  );
}
