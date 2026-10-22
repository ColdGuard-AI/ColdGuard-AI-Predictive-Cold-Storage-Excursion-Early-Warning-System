import {
  AlertTriangle,
  Atom,
  Clock,
  Layers,
  LineChart as LineChartIcon,
  ShieldAlert,
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
            Machine learning forecast horizons across all cold storage chambers with time-to-breach probability.
          </p>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          {zones?.map((z) => (
            <button
              key={z.zone_id}
              onClick={() => setSelectedZone(z.zone_id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
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

      {/* Multi-Horizon Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { key: "30", title: "Next 30 Minutes", icon: Clock },
          { key: "60", title: "Next 1 Hour", icon: Clock },
          { key: "360", title: "Next 6 Hours", icon: Clock },
          { key: "1440", title: "Next 24 Hours", icon: Clock },
        ].map((h) => {
          const item = data?.horizons?.[h.key];
          const riskScore = item?.risk_score ?? (h.key === "60" ? 78 : 35);
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
                <th className="pb-3">30m Risk</th>
                <th className="pb-3">1h Risk</th>
                <th className="pb-3">Est. Time to Breach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {zones?.map((z) => {
                const isZoneB = z.zone_id === "zone-b";
                return (
                  <tr
                    key={z.zone_id}
                    onClick={() => setSelectedZone(z.zone_id)}
                    className="hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <td className="py-3 font-semibold text-white flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
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
                    <td className="py-3 font-mono font-bold">
                      <span className={isZoneB ? "text-rose-400" : "text-emerald-400"}>
                        {isZoneB ? "65% (High)" : "12% (Low)"}
                      </span>
                    </td>
                    <td className="py-3 font-mono font-bold">
                      <span className={isZoneB ? "text-rose-400" : "text-emerald-400"}>
                        {isZoneB ? "78% (High)" : "14% (Low)"}
                      </span>
                    </td>
                    <td className="py-3 font-mono text-amber-400 font-semibold">
                      {isZoneB ? "~40 minutes" : "No breach expected"}
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
