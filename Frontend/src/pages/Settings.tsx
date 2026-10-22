import {
  Bell,
  CheckCircle2,
  Clock,
  Database,
  Radio,
  Save,
  Settings as SettingsIcon,
  Shield,
  Sliders,
  Thermometer,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "../hooks/AppContext";

export default function Settings() {
  const { zones } = useApp();
  const [saved, setSaved] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState("30");
  const [conservativePercentile, setConservativePercentile] = useState("75");
  const [ambientBaseline, setAmbientBaseline] = useState("25");

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <SettingsIcon className="text-cyan-400" />
            System Governance & Facility Parameters
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure early-warning horizon triggers, sensor drift thresholds, and physical simulation constants.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition cursor-pointer"
        >
          <Save size={14} />
          <span>Save Configuration</span>
        </button>
      </div>

      {saved && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>Settings saved and applied to live telemetry inference engines.</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Early Warning Engine */}
        <div className="rounded-2xl bg-[#0F192C]/90 border border-slate-800 p-5 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-3">
            <Clock size={16} className="text-cyan-400" />
            <span>Early Warning & Forecasting Parameters</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Advance Alert Lead Horizon (minutes)
              </label>
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Alarms trigger when projected trajectory breaches safe limit within this window.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Conservative Tree Quantile Threshold (%)
              </label>
              <input
                type="number"
                value={conservativePercentile}
                onChange={(e) => setConservativePercentile(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                75th percentile of tree ensemble used for risk prioritization over pure mean.
              </span>
            </div>
          </div>
        </div>

        {/* Ambient & Facility Physics */}
        <div className="rounded-2xl bg-[#0F192C]/90 border border-slate-800 p-5 shadow-2xl backdrop-blur-xl space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm border-b border-slate-800 pb-3">
            <Thermometer size={16} className="text-amber-400" />
            <span>Ambient Environment & Thermal Dynamics</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Facility Ambient Temperature Baseline (°C)
              </label>
              <input
                type="number"
                value={ambientBaseline}
                onChange={(e) => setAmbientBaseline(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Surrounding loading dock and exterior corridor thermal baseline.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Telemetry Sampling Frequency
              </label>
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                1 sample / 60 seconds (1 minute live telemetry tick)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
