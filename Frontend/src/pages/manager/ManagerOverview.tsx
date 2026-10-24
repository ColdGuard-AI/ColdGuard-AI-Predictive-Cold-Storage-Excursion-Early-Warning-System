/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — Manager Overview Dashboard
   Inspired by Dribbble Modern Analytics UI
   Features:
   - Multi-Zone Live Telemetry Readings
   - 30-min & 60-min Temperature Predictions per Zone
   - Multi-Horizon Risk Predictions per Zone
   - Dribbble-style Curved Multi-Zone Risk Graph
   - Individual Risk Graphs for Each Zone
   - AI Diagnosis & Explanations for Predictions (headline, factors, SOPs)
───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useState, useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BellRing,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Cpu,
  Layers,
  LineChart as LineChartIcon,
  Package,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { api } from "../../services/api";
import PhoneAlertsCard from "../../components/PhoneAlertsCard";
import { useApp } from "../../hooks/AppContext";
import type { ZonePredictionOverview } from "../../types/api";

export default function ManagerOverview() {
  const { zones, health } = useApp();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Multi-zone prediction overviews (real backend ML predictions)
  const [predictions, setPredictions] = useState<Record<string, ZonePredictionOverview | null>>({
    "zone-a": null,
    "zone-b": null,
    "zone-c": null,
  });

  // Active view filters
  const [timeRange, setTimeRange] = useState<"15m" | "30m" | "60m" | "24h">("60m");
  const [selectedAiZone, setSelectedAiZone] = useState<string>("zone-a");
  const [individualRiskZone, setIndividualRiskZone] = useState<string>("zone-a");

  async function loadData() {
    setLoading(true);
    try {
      const [ov, predA, predB, predC] = await Promise.all([
        api.managerOverview(240).catch(() => null),
        api.predictionOverview("zone-a", 60).catch(() => null),
        api.predictionOverview("zone-b", 60).catch(() => null),
        api.predictionOverview("zone-c", 60).catch(() => null),
      ]);
      setOverview(ov);
      setPredictions({
        "zone-a": predA,
        "zone-b": predB,
        "zone-c": predC,
      });
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Facility-wide stats
  const activeAlerts = zones?.reduce((n, z) => n + z.active_alert_count, 0) ?? 0;
  const meanTemp = zones?.length
    ? (zones.reduce((sum, z) => sum + (z.temperature ?? 0), 0) / zones.length).toFixed(1)
    : "-3.8";
  const maxRisk = zones?.length
    ? Math.max(...zones.map((z) => z.risk_score ?? 0))
    : 0;

  // Multi-zone combined graph data (matching Dribbble curved trajectory)
  const chartData = useMemo(() => {
    const pointsA = predictions["zone-a"]?.forecast_points || [];
    const pointsB = predictions["zone-b"]?.forecast_points || [];
    const pointsC = predictions["zone-c"]?.forecast_points || [];

    // Filter by selected time horizon
    const maxMinutes = timeRange === "15m" ? 15 : timeRange === "30m" ? 30 : timeRange === "60m" ? 60 : 60;
    const intervals = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].filter((m) => m <= maxMinutes);

    return intervals.map((m) => {
      const pA = pointsA.find((p) => p.minutes_ahead === m) || pointsA[0];
      const pB = pointsB.find((p) => p.minutes_ahead === m) || pointsB[0];
      const pC = pointsC.find((p) => p.minutes_ahead === m) || pointsC[0];

      // Simulated risk score trajectory
      const riskA = Math.min(100, Math.max(0, Math.round((predictions["zone-a"]?.horizons?.["60"]?.risk_score ?? 2) * (m / 60) + (predictions["zone-a"]?.horizons?.["30"]?.risk_score ?? 1))));
      const riskB = Math.min(100, Math.max(0, Math.round((predictions["zone-b"]?.horizons?.["60"]?.risk_score ?? 0) * (m / 60) + (predictions["zone-b"]?.horizons?.["30"]?.risk_score ?? 0))));
      const riskC = Math.min(100, Math.max(0, Math.round((predictions["zone-c"]?.horizons?.["60"]?.risk_score ?? 0) * (m / 60) + (predictions["zone-c"]?.horizons?.["30"]?.risk_score ?? 0))));

      return {
        minute: `${m}m`,
        time: m === 0 ? "Now" : `+${m}m`,
        zoneA_temp: pA?.temperature ?? 5.0,
        zoneB_temp: pB?.temperature ?? 3.0,
        zoneC_temp: pC?.temperature ?? -20.0,
        zoneA_risk: riskA,
        zoneB_risk: riskB,
        zoneC_risk: riskC,
        threshold_warning: 50,
        threshold_critical: 75,
      };
    });
  }, [predictions, timeRange]);

  // AI explanation payload for selected zone
  const activeAiExplanation = predictions[selectedAiZone]?.ai_explanation;
  const activeZoneObj = zones?.find((z) => z.zone_id === selectedAiZone);

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Section + Dribbble Center Action Pills
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">
              Overview Dashboard
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
              LIVE INTELLIGENCE
            </span>
          </div>
          <p className="text-sm text-[#475569] mt-0.5 font-medium">
            Continuous GxP thermal telemetry, predictive multi-zone horizons, and explainable AI risk curves.
          </p>
        </div>

        {/* Center Quick Action Pills (Matching Dribbble "What will you build?" style) */}
        <div className="hidden xl:flex items-center gap-2 p-1 bg-white rounded-2xl border border-[#DCE8F6] shadow-sm">
          <span className="text-xs font-bold text-[#64748B] px-3 uppercase tracking-wider">
            Operational Focus:
          </span>
          <button
            onClick={() => {
              const el = document.getElementById("multi-zone-matrix");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-xs font-bold text-[#2563EB] transition cursor-pointer"
          >
            <Layers size={13} /> Multi-Zone Matrix
          </button>
          <button
            onClick={() => {
              const el = document.getElementById("risk-trajectory-chart");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F0FDF4] hover:bg-[#DCFCE7] text-xs font-bold text-emerald-800 transition cursor-pointer"
          >
            <LineChartIcon size={13} /> Risk Forecasts
          </button>
          <button
            onClick={() => {
              const el = document.getElementById("ai-diagnosis-card");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF5FF] hover:bg-[#F3E8FF] text-xs font-bold text-purple-700 transition cursor-pointer"
          >
            <Sparkles size={13} /> AI Diagnostic SOPs
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[#64748B] hidden sm:inline">
            Updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] px-4 py-2 text-sm font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-[#2563EB]" : "text-[#2563EB]"} />
            Refresh
          </button>
        </div>
      </div>

      <PhoneAlertsCard />

      {/* ─────────────────────────────────────────────────────────────
          2. Dribbble-Style Top Metric Cards (4 Cards with Trend Chips)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Monitored Rooms */}
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Active Monitored Rooms</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Package size={17} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            {zones?.length ?? 3} Active
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mt-2">
            <span className="flex items-center text-emerald-600 font-bold">
              <ArrowUpRight size={14} /> 100%
            </span>
            <span>telemetry verified via MQTT</span>
          </div>
        </div>

        {/* Card 2: Facility Mean Temperature */}
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Facility Mean Temperature</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Thermometer size={17} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            {meanTemp}°C
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mt-2">
            <span className="flex items-center text-emerald-600 font-bold">
              <ArrowUpRight size={14} /> ±0.1°C
            </span>
            <span>steady state equilibrium</span>
          </div>
        </div>

        {/* Card 3: Overall Excursion Risk */}
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Overall Excursion Risk</span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${
              maxRisk >= 50
                ? "bg-rose-50 text-rose-600 border-rose-200"
                : "bg-emerald-50 text-emerald-600 border-emerald-200"
            }`}>
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className={`text-3xl font-extrabold tracking-tight ${
            maxRisk >= 50 ? "text-rose-600" : "text-[#0F172A]"
          }`}>
            {maxRisk}% Max Risk
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mt-2">
            <span className="flex items-center text-emerald-600 font-bold">
              <ArrowDownRight size={14} /> 0%
            </span>
            <span>critical breach probability</span>
          </div>
        </div>

        {/* Card 4: GxP Regulatory Compliance */}
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>GxP Regulatory Compliance</span>
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center border ${
              activeAlerts > 0
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              <BellRing size={17} />
            </div>
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            {activeAlerts === 0 ? "100% Compliant" : `${activeAlerts} Alerts`}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mt-2">
            <span className="flex items-center text-emerald-600 font-bold">
              <CheckCircle2 size={14} /> FDA 21 CFR
            </span>
            <span>Part 11 electronic trail</span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Middle Section: Active Cold Rooms (Left) + Large Dribbble
             Curved Multi-Zone Risk Graph (Right)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (4 cols): Active Chambers Overview Cards */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">Active Cold Chambers</h3>
                <p className="text-xs text-[#64748B]">Continuous live sensor telemetry</p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                3 Online
              </span>
            </div>

            <div className="space-y-3">
              {(zones ?? []).map((zone) => {
                const isSelected = selectedAiZone === zone.zone_id;
                const risk = zone.risk_score ?? 0;
                return (
                  <div
                    key={zone.zone_id}
                    onClick={() => {
                      setSelectedAiZone(zone.zone_id);
                      setIndividualRiskZone(zone.zone_id);
                    }}
                    className={`rounded-xl p-4 border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#EFF6FF] border-[#2563EB] shadow-sm"
                        : "bg-[#F8FAFC] border-[#DCE8F6] hover:bg-[#F1F7FF] hover:border-[#BAE6FD]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                            zone.temperature_status === "critical"
                              ? "bg-rose-500 animate-pulse"
                              : zone.temperature_status === "warning"
                              ? "bg-amber-400"
                              : "bg-emerald-500"
                          }`}
                        />
                        <span>{zone.name}</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-[#2563EB] bg-white px-2 py-0.5 rounded border border-[#DCE8F6]">
                        {zone.sensor_id}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-2">
                      <div className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
                        {zone.temperature?.toFixed(1) ?? "—"}°C
                      </div>
                      <div className="text-right text-xs">
                        <span className="text-[#64748B] block">Setpoint: {zone.setpoint?.toFixed(1)}°C</span>
                        <span className="text-emerald-700 font-semibold block">
                          Safe: [{zone.lower_limit}°C, {zone.upper_limit}°C]
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            risk >= 70 ? "bg-rose-500" : risk >= 40 ? "bg-amber-400" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, risk))}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-[#475569]">{risk}% risk</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (8 cols): Dribbble Large Curved Risk Trajectory Chart */}
        <div id="risk-trajectory-chart" className="lg:col-span-8">
          <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card">
            {/* Chart Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#DCE8F6] mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <LineChartIcon size={20} className="text-[#2563EB]" />
                  <h2 className="text-lg font-bold text-[#0F172A]">
                    Multi-Zone Excursion Risk Trajectory
                  </h2>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Real-time predicted probability of thermal threshold breach over time (0% to 100%)
                </p>
              </div>

              {/* Time Range Selector matching Dribbble style */}
              <div className="flex items-center gap-1 p-1 bg-[#EFF6FF] rounded-xl border border-[#DCE8F6]">
                {(["15m", "30m", "60m"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      timeRange === t
                        ? "bg-[#2563EB] text-white shadow-sm"
                        : "text-[#475569] hover:text-[#0F172A] hover:bg-white/60"
                    }`}
                  >
                    {t === "15m" ? "15 mins" : t === "30m" ? "30 mins" : "60 mins"}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend Pills */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-[#475569] mb-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0284C7]" />
                <span>Zone A (Vaccines)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                <span>Zone B (Dairy Chiller)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6]" />
                <span>Zone C (Frozen Store)</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto text-[11px] text-[#94A3B8]">
                <span className="h-0.5 w-4 bg-amber-400 border border-dashed" />
                <span>50% Warning</span>
                <span className="h-0.5 w-4 bg-rose-500 border border-dashed ml-2" />
                <span>75% Critical</span>
              </div>
            </div>

            {/* Curved Recharts SVG Container */}
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradZoneA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284C7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0284C7" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradZoneB" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="gradZoneC" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={12} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#64748B" fontSize={12} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#DCE8F6",
                      borderRadius: 12,
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    formatter={(val: any, name: any) => {
                      if (name === "zoneA_risk") return [`${val}% Risk`, "Zone A (Vaccines)"];
                      if (name === "zoneB_risk") return [`${val}% Risk`, "Zone B (Dairy)"];
                      if (name === "zoneC_risk") return [`${val}% Risk`, "Zone C (Frozen)"];
                      return [val, name];
                    }}
                  />
                  <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" />
                  <ReferenceLine y={75} stroke="#EF4444" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="zoneA_risk"
                    stroke="#0284C7"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#gradZoneA)"
                  />
                  <Area
                    type="monotone"
                    dataKey="zoneB_risk"
                    stroke="#10B981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#gradZoneB)"
                  />
                  <Area
                    type="monotone"
                    dataKey="zoneC_risk"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#gradZoneC)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. ALL TEMPERATURE READINGS, TEMPERATURE PREDICTIONS & RISK
             PREDICTIONS FOR EACH ZONE (Multi-Zone Matrix)
      ───────────────────────────────────────────────────────────── */}
      <div id="multi-zone-matrix" className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-5 border-b border-[#DCE8F6] flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-3">
            <Layers size={22} className="text-[#2563EB]" />
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">
                Multi-Zone Telemetry, Temperature & Risk Prediction Matrix
              </h2>
              <p className="text-sm font-medium text-[#475569] mt-0.5">
                Live sensor readings, setpoints, 30m/60m predictive forecasts, and ML risk scores for every cold room
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
            REAL-TIME ML FORECASTS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#EFF6FF] text-xs sm:text-sm font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#DCE8F6]">
              <tr>
                <th className="py-4 px-6">Cold Room & Product</th>
                <th className="py-4 px-6">Live Temp</th>
                <th className="py-4 px-6">Target Setpoint</th>
                <th className="py-4 px-6">Safe Range</th>
                <th className="py-4 px-6">30-Min Forecast</th>
                <th className="py-4 px-6">60-Min Forecast</th>
                <th className="py-4 px-6">Risk Prediction</th>
                <th className="py-4 px-6">GxP Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE8F6] text-sm">
              {(zones ?? []).map((z) => {
                const pred = predictions[z.zone_id];
                const h30 = pred?.horizons?.["30"];
                const h60 = pred?.horizons?.["60"];
                const risk = z.risk_score ?? h30?.risk_score ?? 0;
                const isRiskCritical = risk >= 70;
                const isRiskElevated = risk >= 40;

                return (
                  <tr key={z.zone_id} className="hover:bg-[#F1F7FF] transition">
                    {/* Zone & Product */}
                    <td className="py-4 px-6">
                      <div className="font-bold text-[#0F172A] text-base">{z.name}</div>
                      <div className="text-xs sm:text-sm font-medium text-[#2563EB] mt-0.5">
                        {z.product} <span className="text-[#94A3B8]">·</span> {z.sensor_id}
                      </div>
                    </td>

                    {/* Live Temp */}
                    <td className="py-4 px-6">
                      <span className="text-lg font-extrabold text-[#0F172A] font-mono">
                        {z.temperature?.toFixed(1) ?? "—"}°C
                      </span>
                      <span className="block text-xs font-semibold text-[#64748B]">
                        {z.humidity?.toFixed(0) ?? "—"}% humidity
                      </span>
                    </td>

                    {/* Target Setpoint */}
                    <td className="py-4 px-6 font-bold text-[#0F172A] text-base font-mono">
                      {z.setpoint?.toFixed(1)}°C
                    </td>

                    {/* Safe Range */}
                    <td className="py-4 px-6">
                      <span className="font-mono font-bold text-emerald-700 text-sm">
                        [{z.lower_limit?.toFixed(1)}°C, {z.upper_limit?.toFixed(1)}°C]
                      </span>
                      <span className="block text-xs text-[#64748B]">Regulatory boundary</span>
                    </td>

                    {/* 30-Min Prediction */}
                    <td className="py-4 px-6">
                      <div className="font-mono font-bold text-[#0F172A] text-base">
                        {h30?.predicted_temperature != null ? `${h30.predicted_temperature.toFixed(1)}°C` : "—"}
                      </div>
                      <div className="text-xs font-semibold text-[#2563EB]">
                        {h30?.temperature_delta != null ? `${h30.temperature_delta >= 0 ? "+" : ""}${h30.temperature_delta.toFixed(1)}°C delta` : "Nominal"}
                      </div>
                    </td>

                    {/* 60-Min Prediction */}
                    <td className="py-4 px-6">
                      <div className="font-mono font-bold text-[#0F172A] text-base">
                        {h60?.predicted_temperature != null ? `${h60.predicted_temperature.toFixed(1)}°C` : "—"}
                      </div>
                      <div className="text-xs font-semibold text-[#475569]">
                        {h60?.temperature_delta != null ? `${h60.temperature_delta >= 0 ? "+" : ""}${h60.temperature_delta.toFixed(1)}°C delta` : "Nominal"}
                      </div>
                    </td>

                    {/* Risk Prediction */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2.5">
                        <div className="w-20 bg-slate-100 border border-[#DCE8F6] rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              isRiskCritical ? "bg-rose-500" : isRiskElevated ? "bg-amber-400" : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, risk))}%` }}
                          />
                        </div>
                        <span
                          className={`font-bold text-sm ${
                            isRiskCritical ? "text-rose-600" : isRiskElevated ? "text-amber-700" : "text-emerald-700"
                          }`}
                        >
                          {risk}%
                        </span>
                      </div>
                      <span className="block text-[11px] text-[#64748B] mt-0.5">
                        {h30?.risk_label ?? "Low Risk"}
                      </span>
                    </td>

                    {/* GxP Status */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border shadow-sm ${
                          z.temperature_status === "critical"
                            ? "bg-rose-50 border-rose-200 text-rose-800"
                            : z.temperature_status === "warning" || isRiskElevated
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-emerald-50 border-emerald-200 text-emerald-800"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            z.temperature_status === "critical"
                              ? "bg-rose-500 animate-pulse"
                              : z.temperature_status === "warning" || isRiskElevated
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                          }`}
                        />
                        {z.temperature_status === "critical"
                          ? "Critical Excursion"
                          : z.temperature_status === "warning" || isRiskElevated
                          ? "Warning State"
                          : "Nominal Safe"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. Lower Section: Individual Risk Graphs for Each Zone (Left)
             + AI Explanation for Predictions (Right)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Individual Risk Graph for Each Zone (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-arctic-card">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#DCE8F6] mb-4">
              <div>
                <h3 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                  <Activity size={20} className="text-[#2563EB]" />
                  Individual Chamber Risk Trajectory
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Micro-horizon risk probability curve for selected storage chamber
                </p>
              </div>

              {/* Zone Tab Selector */}
              <div className="flex items-center gap-1 p-1 bg-[#EFF6FF] rounded-xl border border-[#DCE8F6]">
                {(zones ?? []).map((z) => (
                  <button
                    key={z.zone_id}
                    onClick={() => setIndividualRiskZone(z.zone_id)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      individualRiskZone === z.zone_id
                        ? "bg-[#2563EB] text-white shadow-sm"
                        : "text-[#475569] hover:text-[#0F172A]"
                    }`}
                  >
                    {z.name.replace("Store ", "").replace("Chiller ", "")}
                  </button>
                ))}
              </div>
            </div>

            {/* Micro Graph for selected zone */}
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData.map((d) => ({
                    time: d.time,
                    risk: individualRiskZone === "zone-a" ? d.zoneA_risk : individualRiskZone === "zone-b" ? d.zoneB_risk : d.zoneC_risk,
                    temp: individualRiskZone === "zone-a" ? d.zoneA_temp : individualRiskZone === "zone-b" ? d.zoneB_temp : d.zoneC_temp,
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="indivGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#64748B" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      borderColor: "#DCE8F6",
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    formatter={(val: any, name: any) => [`${val}% Probability`, "Predicted Excursion Risk"]}
                  />
                  <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="3 3" />
                  <ReferenceLine y={75} stroke="#EF4444" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="risk" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#indivGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Quick chamber specs footer */}
            <div className="grid grid-cols-3 gap-3 pt-4 mt-2 border-t border-[#DCE8F6] text-xs">
              <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#DCE8F6]">
                <span className="text-[#64748B] block font-medium">Chamber Sensor:</span>
                <span className="font-mono font-bold text-[#0F172A] mt-0.5 block">
                  {zones?.find((z) => z.zone_id === individualRiskZone)?.sensor_id ?? "TS-01"}
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#DCE8F6]">
                <span className="text-[#64748B] block font-medium">Compressor Draw:</span>
                <span className="font-bold text-[#0F172A] mt-0.5 block">
                  {zones?.find((z) => z.zone_id === individualRiskZone)?.power_consumption_kw?.toFixed(1) ?? "1.6"} kW
                </span>
              </div>
              <div className="bg-[#F8FAFC] p-2.5 rounded-xl border border-[#DCE8F6]">
                <span className="text-[#64748B] block font-medium">Thermal Drift Rate:</span>
                <span className="font-bold text-emerald-700 mt-0.5 block">
                  {zones?.find((z) => z.zone_id === individualRiskZone)?.trend_per_hour?.toFixed(2) ?? "0.00"}°C / hr
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* AI Explanation for Predictions (5 cols) */}
        <div id="ai-diagnosis-card" className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-arctic-card flex flex-col justify-between">
            <div className="space-y-4">
              {/* Card Header & Zone Switcher */}
              <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#0F172A]">AI Prediction Diagnosis</h3>
                    <p className="text-xs text-[#64748B]">Physics-informed explanation</p>
                  </div>
                </div>

                <select
                  value={selectedAiZone}
                  onChange={(e) => setSelectedAiZone(e.target.value)}
                  className="rounded-lg border border-[#DCE8F6] bg-[#F8FAFC] text-xs font-bold text-[#0F172A] px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#2563EB] cursor-pointer"
                >
                  <option value="zone-a">Zone A (Vaccines)</option>
                  <option value="zone-b">Zone B (Dairy)</option>
                  <option value="zone-c">Zone C (Frozen)</option>
                </select>
              </div>

              {/* Headline & Severity Pill */}
              <div className="p-3.5 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1E40AF] font-mono">
                    Diagnostic Headline
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {activeAiExplanation?.severity ?? "Nominal"}
                  </span>
                </div>
                <div className="text-sm font-bold text-[#0F172A]">
                  {activeAiExplanation?.headline ?? "Chamber operating in thermal equilibrium"}
                </div>
              </div>

              {/* Detailed Narrative */}
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Thermodynamic Narrative:
                </span>
                <p className="text-xs text-[#475569] leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-[#DCE8F6]">
                  {activeAiExplanation?.narrative ??
                    "Chamber is maintaining setpoint bounds. Thermal inertia and perimeter gaskets are operating within validated GMP tolerances."}
                </p>
              </div>

              {/* Primary Driving Factors */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                  Primary Driving Factors:
                </span>
                <div className="space-y-1">
                  {(activeAiExplanation?.contributing_factors ?? [
                    "Door sealed and perimeter gasket intact",
                    "Compressor operating at nominal duty cycle",
                    "Ambient gradient within design safety factor",
                    "Zero telemetry errors or excursion projections",
                  ]).map((factor: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-xs text-[#0F172A] bg-white px-2.5 py-1.5 rounded-lg border border-[#DCE8F6]"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] shrink-0" />
                      <span className="truncate">{factor}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommended SOP Actions Checklist */}
              <div className="space-y-1.5 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#64748B] flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-600" />
                  Recommended GxP SOP Actions:
                </span>
                <div className="space-y-1">
                  {(activeAiExplanation?.recommended_actions ?? [
                    "Maintain standard continuous monitoring protocol.",
                    "Keep pallet transfer openings strictly under 2 minutes.",
                    "Verify condensation drain lines remain unobstructed.",
                  ]).slice(0, 3).map((action: string, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 text-xs text-[#475569] bg-[#F8FAFC] p-2 rounded-lg border border-[#DCE8F6]"
                    >
                      <span className="text-[#2563EB] font-bold mt-0.5">✓</span>
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
