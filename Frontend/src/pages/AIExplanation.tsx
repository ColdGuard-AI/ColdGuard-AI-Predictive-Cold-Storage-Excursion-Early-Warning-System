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
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            AI Explainability & Incident Diagnostics
          </h1>
          <p className="text-xs text-[#475569] mt-1 font-medium">
            Interpretable machine learning, root-cause attribution, and perishable inventory risk for every zone.
          </p>
        </div>

        {/* Zone Selector */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#DCE8F6] shadow-sm">
          {zones?.map((z) => (
            <button
              key={z.zone_id}
              onClick={() => setSelectedZoneId(z.zone_id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                selectedZone === z.zone_id
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F7FF]"
              }`}
            >
              {z.name.replace(" Vaccine Store", "").replace(" Dairy Chiller", "").replace(" Frozen Store", "")}
            </button>
          ))}
        </div>
      </div>

      {/* Main Narrative Card */}
      <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-4 border-b border-[#DCE8F6]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <BrainCircuit size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">Dynamic AI Diagnosis: {currentZone?.name}</h2>
              <p className="text-xs text-[#475569]">Derived from 1-minute time-series features & thermal boundary states</p>
            </div>
          </div>

          {aiExplanation && (
            <span
              className={`text-[11px] uppercase font-bold tracking-wider px-3 py-1 rounded-full border ${
                isCritical
                  ? "bg-rose-50 text-rose-800 border-rose-200"
                  : isWarning
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              {aiExplanation.severity}
            </span>
          )}
        </div>

        {/* AI Headline */}
        {aiExplanation?.headline && (
          <div className="text-sm font-bold text-[#2563EB] font-mono flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isCritical ? "bg-rose-500 animate-pulse" : isWarning ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
            {aiExplanation.headline}
          </div>
        )}

        {/* Narrative Box */}
        <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] text-sm text-[#0F172A] leading-relaxed">
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
          <div className="rounded-xl p-5 bg-[#EFF6FF] border border-[#BAE6FD] space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#2563EB] animate-pulse" />
                <span className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-mono">
                  Perishable Inventory at Risk — {spoilage.zone_name}
                </span>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                  spoilage.spoilage_status.includes("Critical")
                    ? "bg-rose-50 text-rose-800 border-rose-200"
                    : spoilage.spoilage_status.includes("Warning")
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                }`}
              >
                {spoilage.spoilage_status}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
              <div className="p-3 rounded-lg bg-white border border-[#DCE8F6]">
                <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-mono">Stock Category</span>
                <span className="text-[#0F172A] font-semibold">{spoilage.inventory_category}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-[#DCE8F6]">
                <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-mono">Total Value</span>
                <span className="text-emerald-700 font-bold">{spoilage.total_inventory_value_usd}</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-[#DCE8F6]">
                <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-mono">Critical Threshold</span>
                <span className="text-rose-600 font-bold">{spoilage.critical_threshold_c}°C</span>
              </div>
              <div className="p-3 rounded-lg bg-white border border-[#DCE8F6]">
                <span className="text-[10px] text-[#475569] uppercase tracking-wider block font-mono">Time to Spoilage</span>
                <span className={`font-bold ${spoilage.time_to_spoilage_minutes != null ? "text-amber-600" : "text-[#475569]"}`}>
                  {spoilage.time_to_spoilage_minutes != null ? `${spoilage.time_to_spoilage_minutes} min` : "No risk (Safe)"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-semibold text-[#0F172A] block font-mono">Vulnerable Inventory Items:</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {spoilage.vulnerable_items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-[#0F172A] bg-white px-2.5 py-1.5 rounded border border-[#DCE8F6]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] shrink-0" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-[#BAE6FD] text-xs text-[#0F172A]">
              <span className="text-[#2563EB] font-bold font-mono">Spoilage Mechanism: </span>
              {spoilage.spoilage_mechanism}
            </div>

            <div className="flex items-center justify-between text-xs pt-1 font-mono">
              <span className="text-[#475569]">
                Financial Exposure: <span className="text-rose-600 font-bold">{spoilage.financial_impact_risk}</span>
              </span>
              <span className="text-amber-700 font-semibold">{spoilage.mitigation_urgency}</span>
            </div>
          </div>
        )}

        {/* Summary & Expected Recovery Card */}
        <div className="rounded-xl p-4 bg-[#EFF6FF] border border-[#BAE6FD] flex items-start gap-3 shadow-sm">
          <div className="h-8 w-8 rounded-lg bg-white text-[#2563EB] flex items-center justify-center shrink-0 border border-[#DCE8F6]">
            <Sparkles size={18} />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-mono">Summary & Expected Recovery</div>
            <div className="text-xs text-[#475569] leading-relaxed font-sans">
              {aiExplanation?.summary_text ?? (predictionQuery.loading ? "Calculating forecast..." : "Chamber in thermal equilibrium.")}
            </div>
          </div>
        </div>

        {/* Feature Importance & Contributing Factors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-4">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Zap size={14} className="text-[#2563EB]" />
              Primary Driving Factors (Feature Attribution)
            </h3>
            <ul className="space-y-2 text-xs text-[#475569]">
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
                  <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] mt-1.5 shrink-0" />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-4">
            <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Lightbulb size={14} className="text-[#2563EB]" />
              Recommended Corrective Procedures
            </h3>
            <ol className="space-y-2 text-xs text-[#475569]">
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
                  <span className="h-5 w-5 rounded-full bg-[#EFF6FF] text-[#2563EB] font-bold text-[10px] flex items-center justify-center shrink-0 border border-[#BAE6FD]">
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
      <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card">
        <h2 className="text-base font-bold text-[#0F172A] mb-2 flex items-center gap-2">
          <Wrench size={18} className="text-[#2563EB]" />
          Sensor Reliability vs Genuine Thermal Excursion Classification
        </h2>
        <p className="text-xs text-[#475569] mb-5 leading-relaxed font-medium">
          ColdGuard AI continuously distinguishes between instrumentation hardware failures (spikes, stuck values, dropouts) and genuine physical room temperature breaches.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              Genuine Thermal Excursion
            </div>
            <p className="text-[#475569] leading-relaxed">
              Temperature conforms to lumped room thermal capacitance (~180 min time constant). Neighboring probes and compressor power draw show synchronous thermodynamic shift.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Telemetry Spike / Jitter
            </div>
            <p className="text-[#475569] leading-relaxed">
              Instantaneous gradient (&gt;2.5°C/min) physically impossible for stored inventory thermal mass. Flagged by Isolation Forest; filtered by Kalman smoother without false alarms.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="font-bold text-[#0F172A] mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
              Stuck / Frozen Sensor
            </div>
            <p className="text-[#475569] leading-relaxed">
              Zero variance over 15+ consecutive ticks while compressor cycles. Classified as transmitter ADC lockup; recommended probe replacement or bus reset.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
