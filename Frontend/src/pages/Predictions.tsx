import {
  AlertTriangle,
  Atom,
  Clock,
  DoorOpen,
  Layers,
  LineChart as LineChartIcon,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { fmtTemp, POLL_MS } from "../lib/format";
import { api } from "../services/api";

export default function Predictions() {
  const { zones } = useApp();
  const [selectedZone, setSelectedZone] = useState("zone-b");

  const predictionQuery = usePolling(
    () => api.predictionOverview(selectedZone, 60),
    POLL_MS,
    [selectedZone]
  );

  const data = predictionQuery.data;
  const currentZone = zones?.find((z) => z.zone_id === selectedZone);
  const isRecovering =
    (currentZone?.recovery_phase && currentZone.recovery_phase !== "none" && currentZone.recovery_phase !== "recovered") ||
    (currentZone?.residual_rise_predicted ?? 0) > 0.05;

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <TrendingUp className="text-cyan-400" />
            Predictive Intelligence & Multi-Horizon Forecasts
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Machine learning forecast horizons across all cold storage chambers with thermodynamic residual inertia and time-to-breach probability.
          </p>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          {zones?.map((z) => (
            <button
              key={z.zone_id}
              onClick={() => setSelectedZone(z.zone_id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedZone === z.zone_id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {z.name.replace(" Vaccine Store", "").replace(" Dairy Chiller", "").replace(" Frozen Store", "")}
            </button>
          ))}
        </div>
      </div>

      {/* Stateful Door & Post-Closure Recovery Banner */}
      {(currentZone?.door_status === "open" || isRecovering) && (
        <div
          className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-3 backdrop-blur-xl ${
            currentZone?.door_status === "open"
              ? "bg-rose-950/40 border-rose-500/50 text-rose-200"
              : "bg-amber-950/40 border-amber-500/50 text-amber-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                currentZone?.door_status === "open" ? "bg-rose-500/20 text-rose-400" : "bg-amber-500/20 text-amber-400"
              }`}
            >
              <DoorOpen size={20} className={currentZone?.door_status === "open" ? "animate-pulse" : ""} />
            </div>
            <div>
              <div className="font-bold text-sm text-white flex items-center gap-2">
                <span>
                  {currentZone?.door_status === "open"
                    ? `Chamber Door Open (${currentZone.door_open_minutes.toFixed(0)} min)`
                    : "Door Sealed — Cooling Recovery Active (Risk Retained)"}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/40 border border-white/10">
                  {currentZone?.name}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {currentZone?.door_status === "open"
                  ? "Ambient warm air ingress active. ML model forecasting residual rise upon closure."
                  : `Trapped warm air dissipating. Predicted residual rise ΔT +${(currentZone?.residual_rise_predicted ?? 0).toFixed(1)}°C · Peak ${
                      currentZone?.peak_temp_predicted != null ? fmtTemp(currentZone.peak_temp_predicted) : "evaluating"
                    } · Recovery ~${Math.round(currentZone?.recovery_time_minutes ?? 0)} min.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase">Recovery Progress</div>
              <div className="font-bold text-cyan-300 text-sm">
                {Math.round(currentZone?.recovery_progress_pct ?? 100)}%
              </div>
            </div>
            <div className="w-24 h-2 bg-slate-900 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(5, currentZone?.recovery_progress_pct ?? 100))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Multi-Horizon Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: "30", title: "Next 30 Minutes", icon: Clock },
          { key: "60", title: "Next 1 Hour", icon: Clock },
          { key: "360", title: "Next 6 Hours", icon: Clock },
          { key: "1440", title: "Next 24 Hours", icon: Clock },
        ].map((h) => {
          const item = data?.horizons?.[h.key];
          const riskScore = item?.risk_score ?? (currentZone?.risk_score ?? 15);
          const isHighRisk = riskScore >= 60;
          return (
            <div
              key={h.key}
              className={`rounded-2xl p-5 border flex flex-col justify-between backdrop-blur-xl ${
                isHighRisk
                  ? "bg-gradient-to-b from-rose-950/40 via-slate-900/90 to-slate-950 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                  : "bg-slate-900/80 border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                <span className="font-semibold text-white">{h.title}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isHighRisk
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {item?.risk_label || (isHighRisk ? "High Risk" : "Low")}
                </span>
              </div>

              <div className="my-2">
                <div className="text-[11px] text-slate-400">Predicted Temperature</div>
                <div className="text-3xl font-bold font-mono text-white tracking-tight">
                  {item?.predicted_temperature != null ? `${item.predicted_temperature.toFixed(1)}°C` : "—"}
                </div>
                <div
                  className={`text-xs font-mono font-medium flex items-center gap-1 mt-1 ${
                    (item?.temperature_delta ?? 0) >= 0 ? "text-rose-400" : "text-emerald-400"
                  }`}
                >
                  {(item?.temperature_delta ?? 0) >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  <span>
                    {(item?.temperature_delta ?? 0) >= 0 ? "+" : ""}
                    {(item?.temperature_delta ?? 0).toFixed(1)}°C from current
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Risk Score:</span>
                  <span className="font-bold font-mono text-white">{riskScore}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Excursion Expected:</span>
                  <span className={`font-semibold ${item?.excursion_expected ? "text-rose-400" : "text-emerald-400"}`}>
                    {item?.excursion_expected ? "YES" : "NO"}
                  </span>
                </div>
                {item?.time_to_breach_minutes != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Time to Breach:</span>
                    <span className="font-bold font-mono text-amber-400">
                      ~{Math.round(item.time_to_breach_minutes)} min
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cross-Zone Comparison Table */}
      <div className="rounded-2xl bg-[#0F192C]/90 border border-slate-800 p-5 shadow-2xl backdrop-blur-xl">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Atom size={18} className="text-purple-400" />
          Facility-Wide Excursion Risk Matrix
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold">
                <th className="pb-3">Chamber</th>
                <th className="pb-3">Product Class</th>
                <th className="pb-3">Current Temp</th>
                <th className="pb-3">Safe Range</th>
                <th className="pb-3">Trend</th>
                <th className="pb-3">Door / Thermal Status</th>
                <th className="pb-3">Live Risk Score</th>
                <th className="pb-3">Est. Time to Breach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {zones?.map((z) => {
                const zIsRecovering =
                  (z.recovery_phase && z.recovery_phase !== "none" && z.recovery_phase !== "recovered") ||
                  (z.residual_rise_predicted ?? 0) > 0.05;
                const score = z.risk_score ?? 0;
                const isCritical = score >= 60;
                const isWarning = score >= 30;

                return (
                  <tr
                    key={z.zone_id}
                    onClick={() => setSelectedZone(z.zone_id)}
                    className={`hover:bg-slate-800/40 cursor-pointer transition ${
                      selectedZone === z.zone_id ? "bg-slate-800/30" : ""
                    }`}
                  >
                    <td className="py-3 font-semibold text-white flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isCritical ? "bg-rose-400 animate-pulse" : isWarning ? "bg-amber-400" : "bg-cyan-400"
                        }`}
                      />
                      {z.name}
                    </td>
                    <td className="py-3 text-slate-300">{z.product}</td>
                    <td className="py-3 font-mono font-bold text-white">
                      {z.temperature != null ? fmtTemp(z.temperature) : "—"}
                    </td>
                    <td className="py-3 font-mono text-slate-400">
                      {z.lower_limit}°C to {z.upper_limit}°C
                    </td>
                    <td className="py-3 font-mono">
                      <span className={z.trend_per_hour >= 0 ? "text-rose-400" : "text-emerald-400"}>
                        {z.trend_per_hour >= 0 ? "+" : ""}
                        {z.trend_per_hour.toFixed(1)}°C/h
                      </span>
                    </td>
                    <td className="py-3 font-mono text-xs">
                      {z.door_status === "open" ? (
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <DoorOpen size={12} className="animate-pulse" /> OPEN ({z.door_open_minutes.toFixed(0)}m)
                        </span>
                      ) : zIsRecovering ? (
                        <span className="text-amber-400 font-semibold flex items-center gap-1">
                          <Snowflake size={12} /> RECOVERING (+{(z.residual_rise_predicted ?? 0).toFixed(1)}°C)
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <ShieldCheck size={12} /> Sealed (Nominal)
                        </span>
                      )}
                    </td>
                    <td className="py-3 font-mono font-bold">
                      <span
                        className={
                          isCritical
                            ? "text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30"
                            : isWarning
                            ? "text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30"
                            : "text-emerald-400"
                        }
                      >
                        {z.risk_score != null ? `${z.risk_score}% (${z.risk_category.toUpperCase()})` : "—"}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-amber-400 font-semibold">
                      {z.time_to_breach_minutes != null
                        ? `~${Math.round(z.time_to_breach_minutes)} min`
                        : "No breach expected"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
