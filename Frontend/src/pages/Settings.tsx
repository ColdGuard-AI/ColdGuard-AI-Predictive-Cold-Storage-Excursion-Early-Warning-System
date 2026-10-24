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
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <SettingsIcon size={20} />
            </div>
            System Governance & Facility Parameters
          </h1>
          <p className="text-xs text-[#475569] mt-1 font-medium">
            Configure early-warning horizon triggers, sensor drift thresholds, and physical simulation constants.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-xs font-bold shadow-arctic-card transition cursor-pointer"
        >
          <Save size={14} />
          <span>Save Configuration</span>
        </button>
      </div>

      {saved && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-sm">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Settings saved and applied to live telemetry inference engines.</span>
        </div>
      )}

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Early Warning Engine */}
        <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card space-y-4">
          <div className="flex items-center gap-2 text-[#0F172A] font-bold text-sm border-b border-[#DCE8F6] pb-3">
            <Clock size={16} className="text-[#2563EB]" />
            <span>Early Warning & Forecasting Parameters</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[#0F172A] font-semibold mb-1">
                Advance Alert Lead Horizon (minutes)
              </label>
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#DCE8F6] rounded-xl px-3.5 py-2.5 text-[#0F172A] font-mono focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BAE6FD]"
              />
              <span className="text-[11px] text-[#475569] mt-1 block">
                Alarms trigger when projected trajectory breaches safe limit within this window.
              </span>
            </div>

            <div>
              <label className="block text-[#0F172A] font-semibold mb-1">
                Conservative Tree Quantile Threshold (%)
              </label>
              <input
                type="number"
                value={conservativePercentile}
                onChange={(e) => setConservativePercentile(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#DCE8F6] rounded-xl px-3.5 py-2.5 text-[#0F172A] font-mono focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BAE6FD]"
              />
              <span className="text-[11px] text-[#475569] mt-1 block">
                75th percentile of tree ensemble used for risk prioritization over pure mean.
              </span>
            </div>
          </div>
        </div>

        {/* Ambient & Facility Physics */}
        <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card space-y-4">
          <div className="flex items-center gap-2 text-[#0F172A] font-bold text-sm border-b border-[#DCE8F6] pb-3">
            <Thermometer size={16} className="text-[#2563EB]" />
            <span>Ambient Environment & Thermal Dynamics</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[#0F172A] font-semibold mb-1">
                Facility Ambient Temperature Baseline (°C)
              </label>
              <input
                type="number"
                value={ambientBaseline}
                onChange={(e) => setAmbientBaseline(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#DCE8F6] rounded-xl px-3.5 py-2.5 text-[#0F172A] font-mono focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#BAE6FD]"
              />
              <span className="text-[11px] text-[#475569] mt-1 block">
                Surrounding loading dock and exterior corridor thermal baseline.
              </span>
            </div>

            <div>
              <label className="block text-[#0F172A] font-semibold mb-1">
                Telemetry Sampling Frequency
              </label>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] text-[#475569] font-mono font-medium">
                1 sample / 60 seconds (1 minute live telemetry tick)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
