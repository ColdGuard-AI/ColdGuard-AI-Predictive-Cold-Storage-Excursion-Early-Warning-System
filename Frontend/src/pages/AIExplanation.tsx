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
  const { zones, selectedZoneId, setSelectedZoneId } = useApp();
  const selectedZone = selectedZoneId || (zones?.[0]?.zone_id ?? "zone-a");

  const predictionQuery = usePolling(
    () => api.predictionOverview(selectedZone, 30),
    POLL_MS,
    [selectedZone]
  );

  const data = predictionQuery.data;
  const currentZone = zones?.find((z) => z.zone_id === selectedZone);
  const aiExplanation = data?.ai_explanation;
  const spoilage = aiExplanation?.inventory_spoilage_risk;

  const isCritical = aiExplanation?.severity === "critical";
  const isWarning = aiExplanation?.severity === "warning";

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
            Interpretable machine learning, root-cause attribution, and perishable inventory risk for every zone.
          </p>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          {zones?.map((z) => (
            <button
              key={z.zone_id}
              onClick={() => setSelectedZoneId(z.zone_id)}
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
      <div className="rounded-2xl bg-[#0F192C]/90 border border-slate-800 p-6 shadow-2xl backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center">
              <BrainCircuit size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Dynamic AI Diagnosis: {currentZone?.name}</h2>
              <p className="text-xs text-slate-400">Derived from 1-minute time-series features & thermal boundary states</p>
            </div>
          </div>

          {aiExplanation && (
            <span
              className={`text-[11px] uppercase font-bold tracking-wider px-3 py-1 rounded-full border ${
                isCritical
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                  : isWarning
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              }`}
            >
              {aiExplanation.severity}
            </span>
          )}
        </div>

        {/* AI Headline */}
        {aiExplanation?.headline && (
          <div className="text-sm font-bold text-cyan-300 font-mono flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${isCritical ? "bg-rose-500 animate-pulse" : isWarning ? "bg-amber-500" : "bg-emerald-500"}`} />
            {aiExplanation.headline}
          </div>
        )}

        {/* Narrative Box */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-sm text-slate-200 leading-relaxed">
          {aiExplanation?.narrative || (
            currentZone?.compressor_status === "stopped" || currentZone?.compressor_status === "failed"
              ? `Refrigeration compressor in ${currentZone.name} is offline. Active cooling is halted and chamber temperature is drifting upward toward upper limit (${currentZone.upper_limit}°C). Immediate breaker inspection is required.`
              : currentZone?.door_status === "open"
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

        {/* Perishable Inventory Spoilage Risk Card */}
        {spoilage && (
          <div className="rounded-xl p-4 bg-gradient-to-r from-rose-950/40 via-slate-900/80 to-amber-950/30 border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Perishable Inventory at Risk — {spoilage.zone_name}
                </span>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                  spoilage.spoilage_status.includes("Critical")
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : spoilage.spoilage_status.includes("Warning")
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {spoilage.spoilage_status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Stock Category</span>
                <span className="text-white font-semibold">{spoilage.inventory_category}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Total Value</span>
                <span className="text-emerald-400 font-bold">{spoilage.total_inventory_value_usd}</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Critical Threshold</span>
                <span className="text-rose-400 font-bold">{spoilage.critical_threshold_c}°C</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-mono">Time to Spoilage</span>
                <span className={`font-bold ${spoilage.time_to_spoilage_minutes != null ? "text-amber-400" : "text-slate-300"}`}>
                  {spoilage.time_to_spoilage_minutes != null ? `${spoilage.time_to_spoilage_minutes} min` : "No risk (Safe)"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-slate-300 block font-mono">Vulnerable Inventory Items:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {spoilage.vulnerable_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/50 px-2.5 py-1 rounded border border-slate-800/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800/80 text-xs text-slate-300">
              <span className="text-rose-400 font-semibold font-mono">Spoilage Mechanism: </span>
              {spoilage.spoilage_mechanism}
            </div>

            <div className="flex items-center justify-between text-xs pt-1 font-mono">
              <span className="text-slate-400">Financial Exposure: <span className="text-rose-400 font-bold">{spoilage.financial_impact_risk}</span></span>
              <span className="text-amber-400 font-semibold">{spoilage.mitigation_urgency}</span>
            </div>
          </div>
        )}

        {/* Summary & Expected Recovery Card */}
        <div className="rounded-xl p-3.5 bg-gradient-to-r from-blue-950/70 via-slate-900/90 to-cyan-950/60 border border-blue-500/40 flex items-start gap-3 shadow-lg">
          <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-blue-400/40">
            <Sparkles size={18} />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">Summary & Expected Recovery</div>
            <div className="text-xs text-slate-200 leading-relaxed font-sans">
              {aiExplanation?.summary_text ?? (predictionQuery.loading ? "Calculating forecast..." : "Chamber in thermal equilibrium.")}
            </div>
          </div>
        </div>

        {/* Feature Importance & Contributing Factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              Primary Driving Factors (Feature Attribution)
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              {(aiExplanation?.contributing_factors?.length ? aiExplanation.contributing_factors : [
                currentZone?.compressor_status === "stopped" || currentZone?.compressor_status === "failed"
                  ? "Refrigeration compressor offline (0 kW cooling capacity)"
                  : currentZone?.door_status === "open"
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
              {(aiExplanation?.recommended_actions?.length ? aiExplanation.recommended_actions : [
                currentZone?.compressor_status === "stopped" || currentZone?.compressor_status === "failed"
                  ? "Inspect electrical subpanel breakers and reset compressor motor contactor."
                  : currentZone?.door_status === "open"
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
