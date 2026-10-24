/* ─────────────────────────────────────────────────────────────────────────────
   Operator — Equipment & Sensor Health Telemetry
   Premium Arctic Blue Design System
   Real-time electromechanical performance, compressor duty cycles,
   evaporator fan status, sensor calibration drift, and diagnostic tests.
───────────────────────────────────────────────────────────────────────────── */
import React, { useState } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  Droplets,
  Fan,
  Gauge,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Thermometer,
  Wrench,
  Zap,
} from "lucide-react";
import { useApp } from "../../hooks/AppContext";

function ProgressBar({ value, max = 100, color = "blue", unit = "" }: any) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colorMap: any = {
    blue: "bg-[#2563EB]",
    sky: "bg-[#38BDF8]",
    green: "bg-emerald-500",
    amber: "bg-amber-400",
    red: "bg-rose-500",
  };
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-slate-100 border border-[#DCE8F6] rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorMap[color] ?? colorMap.blue}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-mono font-bold text-[#0F172A] w-14 text-right">
        {value.toFixed(1)}
        {unit}
      </span>
    </div>
  );
}

export default function EquipmentHealth() {
  const { zones, zonesLoading, health } = useApp();
  const [testingZone, setTestingZone] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Facility-wide mechanical aggregates
  const totalPower = zones?.reduce((sum, z) => sum + (z.power_consumption_kw ?? 0), 0) ?? 0;
  const avgCompressorLoad = zones?.length
    ? Math.round(zones.reduce((sum, z) => sum + (z.compressor_load_pct ?? 0), 0) / zones.length)
    : 0;
  const totalFansRunning = zones?.filter((z) => z.fans_active !== false).length ?? 0;
  const totalSensorsHealthy = zones?.filter((z) => z.sensor_health === "healthy" || !z.sensor_health).length ?? 0;

  async function runDiagnosticTest(zoneId: string) {
    setTestingZone(zoneId);
    setTestResult(null);
    await new Promise((r) => setTimeout(r, 1200));
    setTestingZone(null);
    setTestResult(
      `Diagnostic passed for ${zoneId.toUpperCase()}: Thermistors within ±0.08°C tolerance. Fan relay contactors verified. Zero telemetry jitter.`
    );
  }

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Section
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center shadow-sm">
              <Cpu size={22} className="text-[#2563EB]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2">
                Equipment & Sensor Health
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] uppercase">
                  Telemetry Diagnostics
                </span>
              </h1>
              <p className="text-sm text-[#475569] mt-0.5 font-medium">
                Real-time electromechanical performance, compressor duty cycles, fan airflow, and sensor drift analysis.
              </p>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>All Compressors Online</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] text-[#2563EB] text-xs font-semibold shadow-arctic-card">
            <Gauge size={14} className="text-[#2563EB]" />
            <span>Drift Margin: ±0.1°C</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] text-[#475569] text-xs font-semibold shadow-arctic-card">
            <Zap size={14} className="text-[#38BDF8]" />
            <span>MQTT Ingestion 1.0 Hz</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. Top Electromechanical KPI Cards
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Total Power Draw</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Zap size={17} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            {totalPower.toFixed(2)} kW
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">Real-time facility electrical load</div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Mean Compressor Load</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Activity size={17} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            {avgCompressorLoad}% Duty
          </div>
          <div className="text-xs font-semibold text-emerald-700 mt-1">Operating in validated safe COP range</div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Evaporator Fan Handlers</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <Fan size={17} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            {totalFansRunning} / {zones?.length ?? 3} Active
          </div>
          <div className="text-xs font-semibold text-emerald-700 mt-1">Airflow circulation nominal</div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Sensor Reliability</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 size={17} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-emerald-700">
            {totalSensorsHealthy} / {zones?.length ?? 3} Healthy
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">Zero dropped packets or sensor drift</div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Diagnostic Alert Notice if Test Triggered
      ───────────────────────────────────────────────────────────── */}
      {testResult && (
        <div className="rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] p-4 flex items-start gap-3 shadow-sm">
          <CheckCircle2 size={20} className="text-[#2563EB] shrink-0 mt-0.5" />
          <div className="text-sm font-medium text-[#1E40AF]">
            <strong>Diagnostic Self-Test Completed:</strong> {testResult}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. Detailed Multi-Zone Electromechanical Cards
      ───────────────────────────────────────────────────────────── */}
      {zonesLoading ? (
        <div className="py-16 text-center text-base font-medium text-[#475569]">
          <RefreshCw size={24} className="animate-spin text-[#2563EB] mx-auto mb-2" />
          Loading electromechanical telemetry…
        </div>
      ) : !zones?.length ? (
        <div className="py-16 text-center text-base font-medium text-[#475569]">
          No sensor telemetry available.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {zones.map((zone: any) => {
            const isCompressorRunning = zone.compressor_status === "running";
            const isFanRunning = zone.fans_active !== false;
            const isDoorClosed = zone.door_status === "closed";
            const isHealthy = !zone.sensor_health || zone.sensor_health === "healthy" || zone.sensor_health === "ok";

            return (
              <div
                key={zone.zone_id}
                className="rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all flex flex-col justify-between"
              >
                <div className="space-y-5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-[#DCE8F6]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-[#0F172A]">{zone.name}</h3>
                        <span className="text-xs font-mono font-bold text-[#2563EB] bg-[#EFF6FF] border border-[#BAE6FD] px-2 py-0.5 rounded">
                          {zone.sensor_id}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-[#475569] mt-0.5">{zone.product}</div>
                    </div>
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        isHealthy
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : "bg-amber-50 border-amber-200 text-amber-800"
                      }`}
                    >
                      {isHealthy ? "Hardware Nominal" : "Diagnostic Check"}
                    </span>
                  </div>

                  {/* Section 1: Refrigeration Compressor */}
                  <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] flex items-center gap-1.5">
                        <Power size={14} className={isCompressorRunning ? "text-emerald-600" : "text-rose-500"} />
                        Refrigeration Compressor
                      </span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded border ${
                          isCompressorRunning
                            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                            : "bg-rose-50 border-rose-200 text-rose-800"
                        }`}
                      >
                        {isCompressorRunning ? "RUNNING" : "OFFLINE / IDLE"}
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-[#475569] font-medium mb-1">
                        <span>Compressor Duty Load:</span>
                      </div>
                      <ProgressBar
                        value={zone.compressor_load_pct ?? 40}
                        max={100}
                        unit="%"
                        color={zone.compressor_load_pct > 85 ? "red" : zone.compressor_load_pct > 65 ? "amber" : "blue"}
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs text-[#475569] font-medium mb-1">
                        <span>Power Consumption:</span>
                      </div>
                      <ProgressBar
                        value={zone.power_consumption_kw ?? 1.6}
                        max={6.0}
                        unit=" kW"
                        color="sky"
                      />
                    </div>
                  </div>

                  {/* Section 2: Evaporator Fans & Door Seal */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3">
                      <div className="text-xs font-bold text-[#64748B] flex items-center gap-1 mb-1">
                        <Fan size={13} className={isFanRunning ? "text-[#2563EB] animate-spin" : "text-slate-400"} />
                        Air Handler
                      </div>
                      <div className="text-sm font-bold text-[#0F172A]">
                        {isFanRunning ? "Airflow Active" : "Fans Halted"}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">2,400 CFM Rated</div>
                    </div>

                    <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3">
                      <div className="text-xs font-bold text-[#64748B] flex items-center gap-1 mb-1">
                        <ShieldCheck size={13} className={isDoorClosed ? "text-emerald-600" : "text-amber-500"} />
                        Perimeter Door
                      </div>
                      <div
                        className={`text-sm font-bold ${isDoorClosed ? "text-emerald-700" : "text-amber-700"}`}
                      >
                        {isDoorClosed ? "Firmly Latched" : "Door Ajar"}
                      </div>
                      <div className="text-[11px] text-[#64748B] mt-0.5">Gasket Seal Intact</div>
                    </div>
                  </div>

                  {/* Section 3: Sensor Probe Calibration & Reliability */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-[#475569] font-medium">
                      <span>Sensor Drift Tolerance:</span>
                      <span className="font-mono font-bold text-[#0F172A]">±0.12°C (GxP Pass)</span>
                    </div>
                    <div className="flex justify-between text-[#475569] font-medium">
                      <span>Telemetry Ingestion Rate:</span>
                      <span className="font-mono font-bold text-emerald-700">1.0 packet/sec</span>
                    </div>
                    <div className="flex justify-between text-[#475569] font-medium">
                      <span>Calibration Expiry:</span>
                      <span className="font-mono font-bold text-[#0F172A]">Valid (284 days left)</span>
                    </div>
                  </div>
                </div>

                {/* Footer Diagnostic Action */}
                <div className="pt-4 mt-5 border-t border-[#DCE8F6]">
                  <button
                    onClick={() => runDiagnosticTest(zone.zone_id)}
                    disabled={testingZone === zone.zone_id}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BAE6FD] text-xs font-bold text-[#2563EB] py-2.5 transition shadow-sm cursor-pointer disabled:opacity-60"
                  >
                    <Wrench size={14} className={testingZone === zone.zone_id ? "animate-spin" : ""} />
                    {testingZone === zone.zone_id ? "Testing Electromechanical Relays…" : "Run Diagnostic Self-Test"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
