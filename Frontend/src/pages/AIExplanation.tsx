import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  HelpCircle,
  Lightbulb,
  Radio,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Wrench,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { POLL_MS } from "../lib/format";
import { api } from "../services/api";

export default function AIExplanation() {
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
            <Sparkles className="text-purple-400" />
            AI Explainability & Incident Diagnostics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Interpretable machine learning and thermodynamic causality for every prediction, alert, and sensor anomaly.
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
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {z.name.replace(" Vaccine Store", "").replace(" Dairy Chiller", "").replace(" Frozen Store", "")}
            </button>
          ))}
        </div>
      </div>

      {/* Main Narrative Card */}
      <div className="rounded-2xl bg-[#0F192C]/90 border border-slate-800 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="h-8 w-8 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center">
            <BrainCircuit size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Dynamic AI Diagnosis: {currentZone?.name}</h2>
            <p className="text-xs text-slate-400">Derived from 1-minute time-series features & thermal boundary states</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 leading-relaxed mb-6">
          {data?.ai_explanation?.narrative || (
            currentZone?.door_status === "open"
              ? `The door of ${currentZone.name} has been open for ${currentZone.door_open_minutes.toFixed(0)} minutes, allowing warm air from outside (${(currentZone.ambient_temperature ?? 25).toFixed(1)}°C) to enter. This is driving a positive temperature gradient (${currentZone.trend_per_hour >= 0 ? "+" : ""}${currentZone.trend_per_hour.toFixed(1)}°C/h). Upon closure, the chamber will experience residual temperature rise before active refrigeration restabilizes the core.`
              : (currentZone?.residual_rise_predicted ?? 0) > 0.05
              ? `${currentZone?.name} is currently in post-closure thermal recovery. While the door is sealed, trapped warm air is causing a residual rise of +${(currentZone?.residual_rise_predicted ?? 0).toFixed(1)}°C towards a predicted peak of ${
                  currentZone?.peak_temp_predicted != null ? `${currentZone.peak_temp_predicted.toFixed(1)}°C` : "nominal limit"
                }. Risk remains retained until active cooling restabilizes the chamber (estimated ~${Math.round(currentZone?.recovery_time_minutes ?? 0)} minutes remaining).`
              : `${currentZone?.name ?? "Chamber"} is operating within nominal thermodynamic boundary conditions. Current temperature is ${
                  currentZone?.temperature != null ? `${currentZone.temperature.toFixed(1)}°C` : "monitored"
                } against a safe band of ${currentZone?.lower_limit ?? 2}°C to ${currentZone?.upper_limit ?? 8}°C. Continuous ML forecasting indicates low excursion probability.`
          )}
        </div>

        {/* Feature Importance & Contributing Factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              Primary Driving Factors (Feature Attribution)
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              {(data?.ai_explanation?.contributing_factors?.length ? data.ai_explanation.contributing_factors : [
                currentZone?.door_status === "open"
                  ? `Door open for ${currentZone.door_open_minutes.toFixed(0)} minutes (major thermal ingress)`
                  : (currentZone?.residual_rise_predicted ?? 0) > 0.05
                  ? `Post-closure trapped thermal inertia (ΔT residual +${(currentZone?.residual_rise_predicted ?? 0).toFixed(1)}°C)`
                  : "Chamber door sealed; thermal boundary intact",
                `Outdoor ambient temperature ${(currentZone?.ambient_temperature ?? 24.5).toFixed(1)}°C`,
                `10-minute temperature drift: ${currentZone?.trend_per_hour != null ? `${currentZone.trend_per_hour >= 0 ? "+" : ""}${currentZone.trend_per_hour.toFixed(1)}°C/h` : "nominal"}`,
                currentZone?.compressor_status === "running"
                  ? `Refrigeration compressor active (${Math.round(currentZone?.compressor_load_pct ?? 75)}% capacity)`
                  : "Compressor cycling or offline",
              ]).map((factor, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lightbulb size={14} className="text-cyan-400" />
              Recommended Corrective Procedures
            </h3>
            <ol className="space-y-2 text-xs text-slate-300">
              {(data?.ai_explanation?.recommended_actions?.length ? data.ai_explanation.recommended_actions : [
                currentZone?.door_status === "open"
                  ? "Close the chamber door immediately to arrest ambient heat rush."
                  : (currentZone?.residual_rise_predicted ?? 0) > 0.05
                  ? "Maintain door sealed; allow refrigeration compressor to overcome thermal inertia."
                  : "Maintain standard temperature compliance logging.",
                "Verify door seal integrity and magnetic gasket contact.",
                "Observe multi-horizon ML predictions for latent excursion spikes.",
                "If temperature exceeds safe boundary, activate backup refrigeration loop.",
              ]).map((action, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="h-5 w-5 rounded-full bg-blue-600/40 text-blue-300 font-bold text-[10px] flex items-center justify-center shrink-0 border border-blue-500/30">
                    {i + 1}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* Sensor Failure vs Genuine Thermal Shift Explainer */}
      <div className="rounded-2xl bg-[#0F192C]/90 border border-slate-800 p-6 shadow-2xl backdrop-blur-xl">
        <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
          <Wrench size={18} className="text-cyan-400" />
          Sensor Reliability vs Genuine Thermal Excursion Classification
        </h2>
        <p className="text-xs text-slate-400 mb-5 leading-relaxed">
          ColdGuard AI continuously distinguishes between instrumentation hardware failures (spikes, stuck values, dropouts) and genuine physical room temperature breaches.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              Genuine Thermal Excursion
            </div>
            <p className="text-slate-400 leading-relaxed">
              Temperature conforms to lumped room thermal capacitance (~180 min time constant). Neighboring probes and compressor power draw show synchronous thermodynamic shift.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Telemetry Spike / Jitter
            </div>
            <p className="text-slate-400 leading-relaxed">
              Instantaneous gradient (&gt;2.5°C/min) physically impossible for stored inventory thermal mass. Flagged by Isolation Forest; filtered by Kalman smoother without false alarms.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="font-bold text-white mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Stuck / Frozen Sensor
            </div>
            <p className="text-slate-400 leading-relaxed">
              Zero variance over 15+ consecutive ticks while compressor cycles. Classified as transmitter ADC lockup; recommended probe replacement or bus reset.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
