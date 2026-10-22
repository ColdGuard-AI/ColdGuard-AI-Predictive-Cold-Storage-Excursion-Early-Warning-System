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
            "The door of Zone B has been open for 5 minutes, allowing warm air from outside (25°C) to enter. This has caused a rapid increase in temperature from 3.6°C to 6.8°C. Based on current trends, the temperature is predicted to cross the safe limit (8°C) in approximately 40 minutes if the door remains open."
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
              {(data?.ai_explanation?.contributing_factors || [
                "Door open for 5 minutes (major impact)",
                "Outdoor temperature 25°C (higher heat load)",
                "Rising temperature trend (+3.2°C in last 10 minutes)",
                "Compressor is working but may not compensate if door remains open",
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
              {(data?.ai_explanation?.recommended_actions || [
                "Close the door immediately.",
                "Monitor temperature for next 1 hour.",
                "Verify door seal and check for any obstruction.",
                "Ensure compressor is functioning properly.",
                "If temperature does not recover, inspect cooling system.",
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
