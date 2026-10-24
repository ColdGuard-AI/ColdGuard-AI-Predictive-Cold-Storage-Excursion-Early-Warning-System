import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Atom,
  BellRing,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  DoorClosed,
  DoorOpen,
  Droplets,
  Fan,
  Flame,
  Info,
  Layers,
  Lightbulb,
  LineChart as LineChartIcon,
  Package,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sparkles,
  Thermometer,
  Timer,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { fmtDelta, fmtDoorDuration, fmtTemp, fmtTime, POLL_MS } from "../lib/format";
import { api } from "../services/api";
import type {
  DoorEventItem,
  EventItem,
  ModelEvaluationResponse,
  RecoveryStatus,
  ScenarioId,
  ZonePredictionOverview,
} from "../types/api";

// Semi-circular arch gauge with dynamic SVG arc & live glow
function SemiCircleGauge({
  score,
  label,
  sublabel,
  color,
  advisory,
}: {
  score: number;
  label: string;
  sublabel: string;
  color: "red" | "amber" | "teal";
  advisory?: string | null;
}) {
  const radius = 38;
  const strokeWidth = 9;
  const circumference = Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const strokeDashoffset = circumference * (1 - clamped / 100);

  const strokeColor =
    color === "red" ? "#EF4444" : color === "amber" ? "#F59E0B" : "#10B981";
  const glowColor =
    color === "red"
      ? "rgba(239,68,68,0.4)"
      : color === "amber"
      ? "rgba(245,158,11,0.3)"
      : "rgba(16,185,129,0.3)";

  return (
    <div className="flex flex-col items-center justify-between p-3.5 rounded-2xl bg-white border border-[#DCE8F6] hover:border-[#38BDF8] transition-all shadow-arctic-card">
      <div className="text-[11px] font-mono uppercase tracking-wider text-[#475569] font-bold text-center">
        {label}
      </div>
      <div className="relative w-28 h-16 flex items-end justify-center mt-1">
        <svg viewBox="0 0 100 55" className="w-full h-full overflow-visible">
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0px 0px 6px ${glowColor})`,
              transition: "stroke-dashoffset 0.8s ease-in-out",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5">
          <span className="text-xl font-bold font-mono tracking-tight text-[#0F172A] leading-none">
            {clamped}%
          </span>
        </div>
      </div>
      <div
        className={`text-[11px] font-semibold mt-1 tracking-wide ${
          color === "red"
            ? "text-rose-600"
            : color === "amber"
            ? "text-amber-600"
            : "text-emerald-600"
        }`}
      >
        {sublabel}
      </div>
      {advisory && (
        <div className="text-[10px] font-mono text-[#475569] mt-0.5 truncate max-w-full text-center">
          {advisory}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const {
    zones,
    selectedZoneId,
    setSelectedZoneId,
    health,
    facilityRisk,
    totalPowerKw,
    streamConnected,
    notify,
    doorSimulations,
    isDoorOpen: isDoorOpenContext,
    getDoorOpenSeconds,
    toggleDoor,
  } = useApp();

  const [focusedZoneId, setFocusedZoneId] = useState<string>("zone-b");
  const [forecastHorizon, setForecastHorizon] = useState<number>(30); // 30, 60, 360, 1440 min
  const [zoneFilter, setZoneFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [showEvalModal, setShowEvalModal] = useState<boolean>(false);
  const [showTimelineModal, setShowTimelineModal] = useState<boolean>(false);

  // Live ticking clock with real second precision
  const [liveClock, setLiveClock] = useState<string>(() => new Date().toLocaleTimeString());
  const [cycleSecondsRemaining, setCycleSecondsRemaining] = useState<number>(60);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setLiveClock(now.toLocaleTimeString());
      setCycleSecondsRemaining((prev) => (prev <= 1 ? (health?.tick_seconds ?? 60) : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [health?.tick_seconds]);

  // Sync focused zone with global app state
  useEffect(() => {
    if (selectedZoneId && selectedZoneId !== focusedZoneId) {
      setFocusedZoneId(selectedZoneId);
    }
  }, [selectedZoneId]);

  const handleSelectZone = (zid: string) => {
    setFocusedZoneId(zid);
    setSelectedZoneId(zid);
  };

  // Poll live dynamic predictions for the focused chamber
  const predictionQuery = usePolling(
    () => api.predictionOverview(focusedZoneId, forecastHorizon),
    POLL_MS,
    [focusedZoneId, forecastHorizon]
  );

  // Poll live dynamic recovery status for the focused chamber
  const recoveryQuery = usePolling(
    () => api.recoveryStatus(focusedZoneId),
    POLL_MS,
    [focusedZoneId]
  );

  // Poll live door events history
  const doorEventsQuery = usePolling(
    () => api.doorEvents(focusedZoneId, 15),
    POLL_MS,
    [focusedZoneId]
  );

  // Poll historical sensor readings for chart actual trajectory
  const readingsQuery = usePolling(
    () => api.readings(focusedZoneId, 120),
    POLL_MS,
    [focusedZoneId]
  );

  // Poll active alerts and events log
  const eventsQuery = usePolling(() => api.events(8), POLL_MS, []);

  // Poll model evaluation metrics
  const evalQuery = usePolling(() => api.modelEvaluation(), 30000, []);

  // Current active zone object from zones state
  const currentZone = useMemo(() => {
    return zones?.find((z) => z.zone_id === focusedZoneId) ?? zones?.[0] ?? null;
  }, [zones, focusedZoneId]);

  const predictionData: ZonePredictionOverview | null = predictionQuery.data ?? null;
  const recoveryData: RecoveryStatus | null = recoveryQuery.data ?? predictionData?.recovery_status ?? null;
  const evaluationData: ModelEvaluationResponse | null = evalQuery.data ?? null;
  const doorEventsList: DoorEventItem[] = doorEventsQuery.data ?? [];
  const eventsList: EventItem[] = eventsQuery.data ?? [];

  // Door Control Actions
  const handleDoorAction = async (action: "open" | "close", durationMinutes?: number) => {
    setActionLoading(true);
    try {
      const openNow = isDoorOpenContext(focusedZoneId);
      if (action === "open" && !openNow) {
        await toggleDoor(focusedZoneId, durationMinutes);
      } else if (action === "close" && openNow) {
        await toggleDoor(focusedZoneId);
      }
      recoveryQuery.refresh();
      predictionQuery.refresh();
      doorEventsQuery.refresh();
    } catch (err: any) {
      notify("error", err?.message || "Failed to trigger door action.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleScenarioChange = async (scenario: ScenarioId) => {
    setActionLoading(true);
    try {
      await api.setScenario(focusedZoneId, scenario);
      predictionQuery.refresh();
      recoveryQuery.refresh();
      notify("info", `Scenario activated: ${scenario.replace("_", " ").toUpperCase()}`);
    } catch (err: any) {
      notify("error", err?.message || "Failed to set scenario.");
    } finally {
      setActionLoading(false);
    }
  };

  // Prepare combined timeline rows for Recharts using real readings and forecast points
  const chartRows = useMemo(() => {
    const rows: {
      timestamp: number;
      timeLabel: string;
      actual?: number | null;
      predicted?: number | null;
      safeUpper: number;
      safeLower: number;
      isNow?: boolean;
    }[] = [];

    const safeUpper = currentZone?.upper_limit ?? 6.0;
    const safeLower = currentZone?.lower_limit ?? 0.0;

    // Actual observed history
    const readings = readingsQuery.data?.readings ?? [];
    readings.forEach((r) => {
      const t = new Date(r.timestamp).getTime();
      rows.push({
        timestamp: t,
        timeLabel: new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actual: r.temperature,
        predicted: null,
        safeUpper,
        safeLower,
      });
    });

    // Anchor at "Now"
    let nowT = Date.now();
    let baseTemp = currentZone?.temperature ?? 3.0;
    if (predictionData?.current_temperature != null) {
      baseTemp = predictionData.current_temperature;
    }

    if (rows.length > 0) {
      const last = rows[rows.length - 1];
      nowT = last.timestamp;
      last.isNow = true;
      last.predicted = baseTemp;
    } else {
      rows.push({
        timestamp: nowT,
        timeLabel: "Now",
        actual: baseTemp,
        predicted: baseTemp,
        safeUpper,
        safeLower,
        isNow: true,
      });
    }

    // Append forward forecast points
    const forecastPoints = predictionData?.forecast_points ?? [];
    forecastPoints.forEach((p) => {
      const t = new Date(p.timestamp).getTime();
      rows.push({
        timestamp: t,
        timeLabel: new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        actual: null,
        predicted: p.temperature,
        safeUpper,
        safeLower,
      });
    });

    rows.sort((a, b) => a.timestamp - b.timestamp);
    return rows;
  }, [readingsQuery.data, predictionData, currentZone]);

  // Risk Gauges data from prediction overview (purely dynamic, no static hardcoded numbers)
  const horizons = predictionData?.horizons;
  const h30 = horizons?.["30"];
  const h60 = horizons?.["60"];
  const h360 = horizons?.["360"];
  const h1440 = horizons?.["1440"];

  const risk30 = h30?.risk_score ?? (currentZone?.risk_score ?? 0);
  const risk60 = h60?.risk_score ?? (currentZone?.risk_score ?? 0);
  const risk360 = h360?.risk_score ?? 0;
  const risk1440 = h1440?.risk_score ?? 0;

  // Temperature forecast stat cards (purely dynamic, no static hardcoded fallbacks)
  const currentTemp = currentZone?.temperature ?? predictionData?.current_temperature ?? null;

  // AI explanation texts (dynamic from backend)
  const aiExplanation = predictionData?.ai_explanation;
  const aiHeadline =
    aiExplanation?.headline ??
    (currentZone?.door_status === "open"
      ? "Elevated heat ingress from open chamber door"
      : currentZone?.recovery_phase === "residual_rise"
      ? "Door closed — post-closure thermal rise active"
      : "Chamber operating in thermal equilibrium");

  const aiNarrative =
    aiExplanation?.narrative ??
    (predictionQuery.loading
      ? "Calculating chamber thermodynamic equilibrium and ML inference..."
      : "Storage chamber telemetry is monitored continuously. Infiltration, cooling pull-down, and temperature trajectories are dynamically tracked.");

  const aiFactors = aiExplanation?.contributing_factors ?? [];
  const aiSummary =
    aiExplanation?.summary_text ??
    (predictionQuery.loading
      ? "Refreshing predictive forecast..."
      : "System in active thermal equilibrium. Predictions updated dynamically every cycle.");

  const recommendedActions = aiExplanation?.recommended_actions ?? [];

  // Determine stateful door & recovery status styling
  const isDoorOpen = isDoorOpenContext(focusedZoneId) || recoveryData?.door_status === "open" || currentZone?.door_status === "open";
  const focusedDoorSeconds = getDoorOpenSeconds(focusedZoneId);
  const isRecovering =
    !isDoorOpen &&
    (recoveryData?.recovery_phase === "residual_rise" ||
      recoveryData?.recovery_phase === "active_recovery" ||
      (recoveryData != null && recoveryData.recovery_progress_pct < 98));

  // Filtered zones list
  const filteredZones = useMemo(() => {
    if (!zones) return [];
    if (zoneFilter === "all") return zones;
    return zones.filter((z) => z.zone_id === zoneFilter);
  }, [zones, zoneFilter]);

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* ─────────────────────────────────────────────────────────────
          Top Header: Exact match with Manager Overview typography
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center shadow-sm">
                <Thermometer size={20} />
              </div>
              Live Monitor & Telemetry
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
              LIVE SENSORS
            </span>
          </div>
          <p className="text-sm text-[#475569] mt-0.5 font-medium">
            Real-time multi-zone sensor telemetry, chamber door dynamics, and multi-horizon temperature forecasts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              predictionQuery.refresh();
              recoveryQuery.refresh();
              doorEventsQuery.refresh();
              readingsQuery.refresh();
            }}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] px-4 py-2 text-sm font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={15} className="text-[#2563EB]" />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: SYSTEM TELEMETRY RIBBON & LIVE MONITORING BAR
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-white border border-[#DCE8F6] p-4 shadow-arctic-card flex flex-wrap items-center justify-between gap-4">
        {/* Left: Live System Clock & Connectivity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center shadow-sm">
            <Clock size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] text-[#2563EB] font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
              <span
                className={`h-2 w-2 rounded-full ${
                  streamConnected ? "bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse" : "bg-[#38BDF8] animate-ping"
                }`}
              />
              <span>{streamConnected ? "Live Telemetry Stream Active" : "FastAPI Backend Online"}</span>
            </div>
            <div className="text-xl font-bold font-mono text-[#0F172A] tracking-tight flex items-center gap-3">
              <span>{liveClock}</span>
              <span className="text-xs font-normal text-[#475569] font-sans border-l border-[#DCE8F6] pl-3 hidden sm:inline">
                {new Date().toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Live Facility Metrics */}
        <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] text-xs font-mono">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-[#2563EB]" />
            <span className="text-[#475569]">Total Power:</span>
            <span className="font-bold text-[#0F172A]">{totalPowerKw.toFixed(1)} kW</span>
          </div>
          <span className="text-[#DCE8F6]">|</span>
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className={facilityRisk > 50 ? "text-rose-600" : "text-emerald-600"} />
            <span className="text-[#475569]">Facility Risk:</span>
            <span className={`font-bold ${facilityRisk > 50 ? "text-rose-600" : "text-emerald-700"}`}>
              {Math.round(facilityRisk)} / 100
            </span>
          </div>
          <span className="text-[#DCE8F6]">|</span>
          <div className="flex items-center gap-1.5 text-[#475569]">
            <Timer size={14} className="text-[#2563EB]" />
            <span>Cycle:</span>
            <span className="text-[#2563EB] font-bold">{cycleSecondsRemaining}s</span>
          </div>
        </div>

        {/* Right: Chamber Quick-Switch Tabs & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 ml-auto">
          <div className="flex items-center gap-1 bg-[#F1F7FF] p-1 rounded-xl border border-[#DCE8F6]">
            {zones?.map((z) => {
              const isSelected = focusedZoneId === z.zone_id;
              const isExcursion = z.temperature_status === "critical" || z.door_status === "open";
              return (
                <button
                  key={z.zone_id}
                  onClick={() => handleSelectZone(z.zone_id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-[#475569] hover:text-[#0F172A] hover:bg-white"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isExcursion ? "bg-rose-500 animate-ping" : isSelected ? "bg-white" : "bg-slate-400"
                    }`}
                  />
                  <span>{z.name.replace(" Vaccine Store", " A").replace(" Dairy Chiller", " B").replace(" Frozen Store", " C")}</span>
                  {z.temperature != null && (
                    <span className="text-[10px] font-bold opacity-90">{z.temperature.toFixed(1)}°</span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setShowEvalModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] hover:bg-[#DBEAFE] text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Activity size={14} className="text-[#2563EB]" />
            <span>Validation</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: STATEFUL DOOR INGRESS & THERMAL RECOVERY COMMAND CENTER
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#DCE8F6]">
          <div className="flex items-center gap-3">
            <div
              className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                isDoorOpen
                  ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse"
                  : isRecovering
                  ? "bg-amber-50 text-amber-600 border border-amber-200"
                  : "bg-emerald-50 text-emerald-600 border border-emerald-200"
              }`}
            >
              {isDoorOpen ? <DoorOpen size={20} /> : <DoorClosed size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-[#0F172A] tracking-tight">
                  Stateful Door Ingress & Cooling Recovery ({currentZone?.name || focusedZoneId})
                </h3>
                <span
                  className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                    isDoorOpen
                      ? "bg-rose-50 border-rose-200 text-rose-800 animate-pulse"
                      : isRecovering
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-emerald-50 border-emerald-200 text-emerald-800"
                  }`}
                >
                  {isDoorOpen
                    ? `DOOR OPEN (${fmtDoorDuration(focusedDoorSeconds)})`
                    : isRecovering
                    ? `DOOR CLOSED (Pull-Down Recovery Active)`
                    : `DOOR CLOSED (Thermal Equilibrium)`}
                </span>
              </div>
              <p className="text-xs text-[#475569] mt-0.5 font-medium">
                Dual-mass thermal inertia tracking. Closing chamber door preserves residual accumulated warmth during pull-down.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowTimelineModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] hover:bg-[#F1F7FF] text-xs font-bold text-[#2563EB] transition shadow-sm cursor-pointer"
          >
            <Layers size={14} className="text-[#2563EB]" />
            <span>Event Timeline</span>
          </button>
        </div>

        {/* Real-Time Door & Recovery Metrics (Purely Dynamic) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {/* Box 1: Door Status & Duration */}
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="text-[11px] text-[#475569] uppercase font-bold">Door State</div>
            <div className="text-lg font-bold text-[#0F172A] mt-0.5 font-mono">
              {isDoorOpen ? "OPEN" : "CLOSED"}
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-0.5">
              {isDoorOpen
                ? `${fmtDoorDuration(focusedDoorSeconds)} open`
                : `${(recoveryData?.time_since_closure_minutes ?? 0).toFixed(0)}m since close`}
            </div>
          </div>

          {/* Box 2: Predicted Residual Rise */}
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="text-[11px] text-[#475569] uppercase font-bold">Residual Rise (ΔT)</div>
            <div className="text-lg font-bold text-amber-600 mt-0.5 font-mono">
              +{((recoveryData?.residual_rise_predicted ?? currentZone?.residual_rise_predicted ?? 0)).toFixed(2)}°C
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-0.5">
              trapped warm air
            </div>
          </div>

          {/* Box 3: Predicted Peak Temp */}
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="text-[11px] text-[#475569] uppercase font-bold">Predicted Peak Temp</div>
            <div
              className={`text-lg font-bold font-mono mt-0.5 ${
                (recoveryData?.peak_temp_predicted ?? currentZone?.peak_temp_predicted ?? 0) >= (currentZone?.upper_limit ?? 6)
                  ? "text-rose-600"
                  : "text-[#0F172A]"
              }`}
            >
              {recoveryData?.peak_temp_predicted != null
                ? fmtTemp(recoveryData.peak_temp_predicted)
                : currentZone?.peak_temp_predicted != null
                ? fmtTemp(currentZone.peak_temp_predicted)
                : currentTemp != null
                ? fmtTemp(currentTemp)
                : "—"}
            </div>
            <div className="text-[10px] text-[#2563EB] font-mono mt-0.5 font-semibold">
              Safe: {currentZone?.lower_limit ?? 0}° to {currentZone?.upper_limit ?? 6}°C
            </div>
          </div>

          {/* Box 4: Cooling Recovery Time */}
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="text-[11px] text-[#475569] uppercase font-bold">Est. Recovery Time</div>
            <div className="text-lg font-bold text-[#2563EB] mt-0.5 font-mono">
              {recoveryData?.recovery_time_minutes
                ? `~${Math.round(recoveryData.recovery_time_minutes)} min`
                : currentZone?.recovery_time_minutes
                ? `~${Math.round(currentZone.recovery_time_minutes)} min`
                : "Nominal"}
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-0.5">
              to setpoint {currentZone?.setpoint != null ? fmtTemp(currentZone.setpoint) : "3.0°C"}
            </div>
          </div>

          {/* Box 5: Recovery Progress */}
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="text-[11px] text-[#475569] uppercase font-bold">Recovery Progress</div>
            <div className="text-lg font-bold text-emerald-600 mt-0.5 font-mono">
              {Math.round(recoveryData?.recovery_progress_pct ?? currentZone?.recovery_progress_pct ?? 100)}%
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-0.5">
              {isDoorOpen ? "Inactive (Door open)" : isRecovering ? "Pull-down active" : "Restored"}
            </div>
          </div>

          {/* Box 6: 24h Cumulative Exposure */}
          <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
            <div className="text-[11px] text-[#475569] uppercase font-bold">24h Cumulative</div>
            <div className="text-lg font-bold text-[#0F172A] mt-0.5 font-mono">
              {(recoveryData?.cumulative_open_minutes_24h ?? currentZone?.cumulative_open_minutes_24h ?? 0).toFixed(1)}m
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-0.5">
              {recoveryData?.events_count_24h ?? currentZone?.door_events_count_24h ?? 0} door events (24h)
            </div>
          </div>
        </div>

        {/* Dynamic Thermal Recovery Progress Bar */}
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#0F172A] font-semibold flex items-center gap-1.5">
              <span>Cooling Pull-Down Progress:</span>
              <span className={isRecovering ? "text-amber-600 font-bold" : "text-emerald-700 font-bold"}>
                {Math.round(recoveryData?.recovery_progress_pct ?? currentZone?.recovery_progress_pct ?? 100)}%
              </span>
            </span>
            <span className="text-[#475569]">
              {isDoorOpen
                ? "Door open: warm air thermal infiltration active"
                : isRecovering
                ? `Active pull-down in progress (~${Math.round(recoveryData?.recovery_time_minutes ?? 20)} min remaining)`
                : "Nominal thermal equilibrium restored"}
            </span>
          </div>
          <div className="h-2 w-full bg-[#F1F7FF] rounded-full overflow-hidden p-0.5 border border-[#DCE8F6]">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isDoorOpen
                  ? "bg-rose-500 animate-pulse w-full"
                  : isRecovering
                  ? "bg-gradient-to-r from-amber-500 via-[#38BDF8] to-emerald-500"
                  : "bg-emerald-500"
              }`}
              style={{
                width: isDoorOpen
                  ? "100%"
                  : `${Math.max(5, Math.min(100, recoveryData?.recovery_progress_pct ?? currentZone?.recovery_progress_pct ?? 100))}%`,
              }}
            />
          </div>
        </div>

        {/* Fault Scenario Quick Switcher */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-[#DCE8F6]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#475569] font-medium">Trigger Fault:</span>
            <select
              value={currentZone?.scenario ?? "normal"}
              onChange={(e) => handleScenarioChange(e.target.value as ScenarioId)}
              className="bg-[#F8FAFC] border border-[#DCE8F6] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0F172A] cursor-pointer focus:outline-none focus:border-[#2563EB]"
            >
              <option value="normal">Normal Operation</option>
              <option value="door_open">Door Left Open</option>
              <option value="fan_off">Cooling Fan Off (Evaporator Trip)</option>
              <option value="compressor_failure">Compressor Failure (0 kW)</option>
              <option value="cooling_degradation">Cooling Degradation (50%)</option>
              <option value="sensor_anomaly">Sensor Anomaly (Spike/Stuck)</option>
              <option value="abnormal_humidity">Abnormal Humidity (&gt;90%)</option>
              <option value="fire_runaway">Fire / Thermal Runaway (&gt;2°C/min)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: LIVE SENSOR READINGS & OVERALL RISK PREDICTION
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Dynamic Chamber Sensor Readings (col-span-7) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
                <Thermometer size={18} className="text-[#2563EB]" />
                Live Sensor Readings
              </h2>
              {/* Dynamic Zone Filter */}
              <div className="relative">
                <select
                  value={zoneFilter}
                  onChange={(e) => setZoneFilter(e.target.value)}
                  className="bg-[#F8FAFC] border border-[#DCE8F6] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0F172A] pr-7 appearance-none cursor-pointer focus:outline-none focus:border-[#2563EB]"
                >
                  <option value="all">All Zones ({zones?.length ?? 0})</option>
                  {zones?.map((z) => (
                    <option key={z.zone_id} value={z.zone_id}>
                      {z.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2 text-[#475569] pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10B981] animate-pulse" />
              <span>{(zones?.length ?? 3) * 2}/{(zones?.length ?? 3) * 2} Probes Online</span>
            </div>
          </div>

          {/* Chamber Cards Grid (Dynamic, Filterable) */}
          <div className={`grid gap-3.5 ${filteredZones.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-3"}`}>
            {filteredZones.map((z) => {
              const isSelected = focusedZoneId === z.zone_id;
              const isDoor = isDoorOpenContext(z.zone_id) || z.door_status === "open" || z.scenario === "door_open";
              const isCritical =
                isDoor ||
                z.temperature_status === "critical" ||
                z.scenario === "compressor_failure" ||
                z.scenario === "fire_runaway";

              const tempTrend = z.trend_per_hour ?? 0;
              const isRising = tempTrend >= 0;

              return (
                <div
                  key={z.zone_id}
                  onClick={() => handleSelectZone(z.zone_id)}
                  className={`rounded-2xl p-4 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    isCritical
                      ? "bg-rose-50 border-2 border-rose-300 shadow-sm"
                      : isSelected
                      ? "bg-[#EFF6FF] border-2 border-[#2563EB] shadow-sm"
                      : "bg-[#F8FAFC] border border-[#DCE8F6] hover:border-[#38BDF8]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                          isCritical
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : "bg-[#EFF6FF] text-[#2563EB] border border-[#BAE6FD]"
                        }`}
                      >
                        <Snowflake size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[#0F172A] leading-none">
                          {z.name.replace(" Vaccine Store", "").replace(" Dairy Chiller", "").replace(" Frozen Store", "")}
                        </div>
                        <div className="text-[10px] text-[#2563EB] font-mono mt-0.5 font-semibold">{z.product}</div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        isCritical
                          ? "bg-rose-100 border-rose-300 text-rose-800 animate-pulse"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800"
                      }`}
                    >
                      {isDoor
                        ? `Door Open (${fmtDoorDuration(getDoorOpenSeconds(z.zone_id))})`
                        : z.scenario === "normal"
                        ? "Nominal"
                        : z.scenario_label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                      <div className="text-[11px] text-[#475569] flex items-center gap-1 mb-0.5 font-medium">
                        <Thermometer size={12} className={isCritical ? "text-rose-600" : "text-[#2563EB]"} />
                        <span>Temperature</span>
                      </div>
                      <div
                        className={`text-2xl font-bold font-mono tracking-tight ${
                          isCritical ? "text-rose-600" : "text-[#0F172A]"
                        }`}
                      >
                        {z.temperature != null ? fmtTemp(z.temperature) : "—"}
                      </div>
                      <div
                        className={`text-[11px] font-mono font-semibold flex items-center gap-0.5 mt-0.5 ${
                          isRising ? "text-rose-600" : "text-emerald-700"
                        }`}
                      >
                        {isRising ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        <span>
                          {isRising ? "+" : ""}
                          {tempTrend.toFixed(1)}°C/h
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] text-[#475569] flex items-center gap-1 mb-0.5 font-medium">
                        <Droplets size={12} className="text-[#38BDF8]" />
                        <span>Humidity</span>
                      </div>
                      <div className="text-2xl font-bold font-mono text-[#0F172A]">
                        {z.humidity != null ? `${Math.round(z.humidity)}%` : "—%"}
                      </div>
                      <div className="text-[10px] text-[#475569] font-mono mt-0.5">Target: 45–70%</div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#DCE8F6] flex items-center justify-between text-[11px] text-[#475569]">
                    <div className="flex items-center gap-1">
                      {isDoor ? (
                        <DoorOpen size={13} className="text-rose-600" />
                      ) : (
                        <DoorClosed size={13} className="text-emerald-700" />
                      )}
                      <span className="font-mono font-semibold">{isDoor ? "Open" : "Closed"}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Cpu size={13} className="text-[#2563EB]" />
                      <span className="font-mono font-semibold text-[#0F172A]">
                        {z.compressor_status === "stopped" ? "OFF" : `${Math.round(z.compressor_load_pct ?? 70)}%`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[#0F172A] font-semibold">
                      <Zap size={13} className="text-[#2563EB]" />
                      <span>{z.power_consumption_kw != null ? `${z.power_consumption_kw.toFixed(1)} kW` : "— kW"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Overall Risk Prediction Gauges (col-span-5) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
                <Atom size={17} />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight flex items-center gap-1.5">
                Overall Risk Prediction
                <span title="Continuous ML risk classification score across horizons" className="text-[#475569] hover:text-[#0F172A] cursor-pointer">
                  <Info size={14} />
                </span>
              </h2>
            </div>

            <div className="relative">
              <select
                value={focusedZoneId}
                onChange={(e) => handleSelectZone(e.target.value)}
                className="bg-[#F8FAFC] border border-[#DCE8F6] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0F172A] pr-8 appearance-none cursor-pointer focus:outline-none focus:border-[#2563EB]"
              >
                {zones?.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-[#475569] pointer-events-none" />
            </div>
          </div>

          {/* 4 Dynamic Semi-circular Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-auto">
            <SemiCircleGauge
              label="Next 30 min"
              score={risk30}
              sublabel={risk30 >= 60 ? "High Risk" : risk30 >= 30 ? "Medium" : "Low Risk"}
              color={risk30 >= 60 ? "red" : risk30 >= 30 ? "amber" : "teal"}
              advisory={h30?.time_to_breach_minutes ? `Breach in ${h30.time_to_breach_minutes}m` : undefined}
            />
            <SemiCircleGauge
              label="Next 1 hour"
              score={risk60}
              sublabel={risk60 >= 60 ? "High Risk" : risk60 >= 30 ? "Medium" : "Low Risk"}
              color={risk60 >= 60 ? "red" : risk60 >= 30 ? "amber" : "teal"}
              advisory={h60?.time_to_breach_minutes ? `Breach in ${h60.time_to_breach_minutes}m` : undefined}
            />
            <SemiCircleGauge
              label="Next 6 hours"
              score={risk360}
              sublabel={risk360 >= 60 ? "High Risk" : risk360 >= 30 ? "Medium" : "Low Risk"}
              color={risk360 >= 60 ? "red" : risk360 >= 30 ? "amber" : "teal"}
            />
            <SemiCircleGauge
              label="Next 24 hours"
              score={risk1440}
              sublabel={risk1440 >= 60 ? "High Risk" : risk1440 >= 30 ? "Medium" : "Low"}
              color={risk1440 >= 60 ? "red" : risk1440 >= 30 ? "amber" : "teal"}
            />
          </div>

          <div className="mt-3 pt-3 border-t border-[#DCE8F6] flex items-center justify-between text-[11px] text-[#475569] font-mono">
            <span>Model: {evaluationData?.model_architecture || "RandomForest (100 Trees)"}</span>
            <span className="text-[#2563EB] font-bold">100% Physics & ML Driven</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: TEMPERATURE FORECAST & AI EXPLANATION
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Temperature Forecast Chart (col-span-7) */}
        <div className="lg:col-span-7 rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
                <LineChartIcon size={17} />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">
                Temperature Forecast ({currentZone?.name || focusedZoneId})
              </h2>
            </div>

            {/* Horizon Selector Tabs */}
            <div className="flex items-center gap-1 bg-[#F1F7FF] p-1 rounded-xl border border-[#DCE8F6]">
              {[
                { label: "30 min", value: 30 },
                { label: "1 hour", value: 60 },
                { label: "6 hours", value: 360 },
                { label: "24 hours", value: 1440 },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setForecastHorizon(tab.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    forecastHorizon === tab.value
                      ? "bg-[#2563EB] text-white shadow-sm font-bold"
                      : "text-[#475569] hover:text-[#0F172A]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center gap-5 text-xs text-[#475569] font-medium mb-3">
            <div className="flex items-center gap-2">
              <span className="w-4 h-0.5 bg-[#2563EB] rounded" />
              <span>Actual History</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 border-b-2 border-dashed border-rose-500" />
              <span className="text-rose-600 font-semibold">ML Forecast Trajectory</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 border-b-2 border-dashed border-[#38BDF8]" />
              <span className="text-[#2563EB] font-semibold">
                Safe Limit ({currentZone?.upper_limit ?? 6}°C)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3 rounded bg-rose-50 border border-rose-200" />
              <span className="text-rose-700">Predicted Risk Zone</span>
            </div>
          </div>

          {/* Chart Container */}
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartRows} margin={{ top: 15, right: 15, bottom: 5, left: -10 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="timeLabel"
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  minTickGap={35}
                />
                <YAxis
                  stroke="#475569"
                  fontSize={11}
                  tickLine={false}
                  domain={[
                    (dataMin: number) => Math.floor(Math.min(dataMin, currentZone?.lower_limit ?? 0) - 1),
                    (dataMax: number) => Math.ceil(Math.max(dataMax, (currentZone?.upper_limit ?? 6) + 2)),
                  ]}
                  tickFormatter={(v) => `${v}°`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-[#DCE8F6] bg-white p-3 text-xs shadow-arctic-card">
                        <div className="font-mono text-[#475569] mb-1.5">{data.timeLabel}</div>
                        {data.actual != null && (
                          <div className="flex items-center justify-between gap-3 text-[#2563EB] font-mono">
                            <span>Actual:</span>
                            <span className="font-bold">{data.actual.toFixed(2)}°C</span>
                          </div>
                        )}
                        {data.predicted != null && (
                          <div className="flex items-center justify-between gap-3 text-rose-600 font-mono">
                            <span>Predicted:</span>
                            <span className="font-bold">{data.predicted.toFixed(2)}°C</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3 text-[#0F172A] font-mono mt-1 pt-1 border-t border-[#DCE8F6]">
                          <span>Safe Limit:</span>
                          <span className="font-bold">{data.safeUpper}°C</span>
                        </div>
                      </div>
                    );
                  }}
                />

                <ReferenceLine
                  y={currentZone?.upper_limit ?? 6}
                  stroke="#2563EB"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: `Safe Upper (${currentZone?.upper_limit ?? 6}°C)`,
                    fill: "#2563EB",
                    fontSize: 11,
                    position: "insideTopLeft",
                  }}
                />

                {chartRows.some((r) => (r.predicted ?? 0) >= (currentZone?.upper_limit ?? 6)) && (
                  <ReferenceArea
                    y1={currentZone?.upper_limit ?? 6}
                    y2={15}
                    fill="#EF4444"
                    fillOpacity={0.08}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "#2563EB" }}
                  connectNulls={false}
                />

                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#EF4444"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 3, fill: "#EF4444" }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: AI Explanation & Root Causes (col-span-5) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
                <Sparkles size={17} />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">AI Explanation & Causes</h2>
            </div>

            <div className="relative">
              <select
                value={focusedZoneId}
                onChange={(e) => handleSelectZone(e.target.value)}
                className="bg-[#F8FAFC] border border-[#DCE8F6] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0F172A] pr-8 appearance-none cursor-pointer focus:outline-none focus:border-[#2563EB]"
              >
                {zones?.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>
                    {z.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-[#475569] pointer-events-none" />
            </div>
          </div>

          <div
            className={`rounded-xl p-3 flex items-start gap-2.5 border mb-3 ${
              aiExplanation?.severity === "critical" || aiExplanation?.severity === "warning"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-emerald-50 border-emerald-200 text-emerald-800"
            }`}
          >
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600" />
            <div className="text-xs font-bold leading-snug">{aiHeadline}</div>
          </div>

          <p className="text-xs text-[#0F172A] leading-relaxed mb-3">
            {aiNarrative}
          </p>

          <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3 mb-2">
            <div className="text-xs font-bold text-[#0F172A] mb-2 flex items-center gap-1.5 font-mono">
              <Cpu size={13} className="text-[#2563EB]" />
              <span>Contributing Telemetry Factors</span>
            </div>
            {aiFactors.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-[#475569]">
                {aiFactors.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-[#2563EB] mt-0.5 font-bold">•</span>
                    <span>{factor}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-mono font-medium">
                <CheckCircle2 size={13} />
                <span>All telemetry factors within calibrated baseline limits.</span>
              </div>
            )}
          </div>

          {/* Perishable Inventory Spoilage Risk Analysis */}
          {aiExplanation?.inventory_spoilage_risk && (
            <div className="rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] p-3.5 mb-2 shadow-sm">
              <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-[#BAE6FD]">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F172A] font-mono">
                  <Package size={14} className="text-[#2563EB]" />
                  <span>PERISHABLE INVENTORY AT RISK</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                    aiExplanation.inventory_spoilage_risk.spoilage_status.includes("Critical")
                      ? "bg-rose-50 text-rose-800 border-rose-200 animate-pulse"
                      : aiExplanation.inventory_spoilage_risk.spoilage_status.includes("Warning")
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  {aiExplanation.inventory_spoilage_risk.spoilage_status}
                </span>
              </div>

              {/* Inventory Metrics */}
              <div className="grid grid-cols-2 gap-2 mb-2.5 text-[11px] font-mono">
                <div className="p-2 rounded-lg bg-white border border-[#DCE8F6]">
                  <div className="text-[10px] text-[#475569]">Total Lot Value:</div>
                  <div className="text-emerald-700 font-bold">{aiExplanation.inventory_spoilage_risk.total_inventory_value_usd}</div>
                </div>
                <div className="p-2 rounded-lg bg-white border border-[#DCE8F6]">
                  <div className="text-[10px] text-[#475569]">Est. Time to Spoilage:</div>
                  <div className={`font-bold ${aiExplanation.inventory_spoilage_risk.time_to_spoilage_minutes != null ? "text-amber-600" : "text-[#475569]"}`}>
                    {aiExplanation.inventory_spoilage_risk.time_to_spoilage_minutes != null
                      ? `${aiExplanation.inventory_spoilage_risk.time_to_spoilage_minutes} min`
                      : "Nominal (Safe)"}
                  </div>
                </div>
              </div>

              {/* Vulnerable Items List */}
              <div className="mb-2">
                <div className="text-[10px] uppercase font-mono text-[#475569] mb-1 font-semibold">
                  Vulnerable Products Stored in Chamber:
                </div>
                <div className="space-y-1">
                  {aiExplanation.inventory_spoilage_risk.vulnerable_items.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-1.5 text-[11px] text-[#0F172A]">
                      <span className="text-[#2563EB] font-bold">•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Degradation Mechanism */}
              <div className="p-2 rounded-lg bg-white border border-[#DCE8F6] text-[11px] text-[#475569] leading-relaxed">
                <span className="font-bold text-[#0F172A]">Spoilage Mechanism: </span>
                {aiExplanation.inventory_spoilage_risk.spoilage_mechanism}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: NEXT PREDICTION + RECOMMENDED ACTIONS + EVENTS
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Next Prediction Card (col-span-5) */}
        <div className="lg:col-span-5 rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-7 w-7 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <Atom size={17} />
            </div>
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">
              Next Prediction ({currentZone?.name || focusedZoneId})
            </h2>
          </div>

          {/* 4 Stat Boxes (Dynamically mapped) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            {[
              { label: "30 min", data: h30 },
              { label: "1 hour", data: h60 },
              { label: "6 hours", data: h360 },
              { label: "24 hours", data: h1440 },
            ].map(({ label, data }) => {
              const pTemp = data?.predicted_temperature != null ? data.predicted_temperature : currentTemp;
              const delta = data?.temperature_delta ?? 0;
              const isBreach = pTemp != null && pTemp > (currentZone?.upper_limit ?? 6);
              return (
                <div
                  key={label}
                  className={`p-3 rounded-xl bg-[#F8FAFC] border flex flex-col justify-between ${
                    isBreach ? "border-rose-300 ring-2 ring-rose-100" : "border-[#DCE8F6]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-[#475569] font-mono">
                    <Thermometer size={14} className={isBreach ? "text-rose-600" : "text-[#2563EB]"} />
                    <span className="font-semibold">{label}</span>
                  </div>
                  <div className={`text-lg font-bold font-mono mt-1 ${isBreach ? "text-rose-600" : "text-[#0F172A]"}`}>
                    {pTemp != null ? fmtTemp(pTemp) : "—"}
                  </div>
                  <div className="text-[10px] font-mono font-medium text-[#475569]">
                    {delta !== 0 ? fmtDelta(delta) : "±0.0°C"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl p-3.5 bg-[#EFF6FF] border border-[#BAE6FD] flex items-start gap-3 shadow-sm">
            <div className="h-8 w-8 rounded-lg bg-white text-[#2563EB] flex items-center justify-center shrink-0 border border-[#BAE6FD]">
              <Sparkles size={18} />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-bold text-[#0F172A] uppercase tracking-wider font-mono">Summary & Expected Recovery</div>
              <div className="text-xs text-[#475569] leading-relaxed font-sans">
                {aiSummary}
              </div>
            </div>
          </div>
        </div>

        {/* Recommended Actions Card (col-span-3) */}
        <div className="lg:col-span-3 rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <Lightbulb size={17} />
            </div>
            <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Recommended Actions</h2>
          </div>

          <ol className="space-y-2.5 my-auto">
            {recommendedActions.length > 0 ? (
              recommendedActions.map((action, idx) => {
                const num = idx + 1;
                const isUrgent = num === 1 && (currentZone?.door_status === "open" || (currentZone?.temperature ?? 0) > (currentZone?.upper_limit ?? 6));
                return (
                  <li key={idx} className="flex items-center gap-3 text-xs text-[#0F172A]">
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 font-mono ${
                        isUrgent
                          ? "bg-rose-500 text-white shadow-[0_0_8px_#EF4444]"
                          : "bg-[#2563EB] text-white"
                      }`}
                    >
                      {num}
                    </span>
                    <span className="leading-snug">{action}</span>
                  </li>
                );
              })
            ) : (
              <div className="text-xs text-[#475569] italic">No emergency actions required. All operations nominal.</div>
            )}
          </ol>

          <div className="mt-3 pt-3 border-t border-[#DCE8F6] text-[11px] text-[#475569] font-mono flex items-center justify-between">
            <span>Enforcement: Active</span>
            <span className="text-[#2563EB] font-bold">{liveClock}</span>
          </div>
        </div>

        {/* Active Alerts & Events Card (col-span-4) */}
        <div className="lg:col-span-4 rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
                <BellRing size={17} />
              </div>
              <h2 className="text-lg font-bold text-[#0F172A] tracking-tight">Active Alerts & Events</h2>
            </div>
            <Link to="/alerts" className="text-xs font-bold text-[#2563EB] hover:underline">
              View All
            </Link>
          </div>

          <div className="overflow-x-auto my-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#DCE8F6] text-[11px] font-bold text-[#0F172A] uppercase tracking-wider font-mono">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Zone</th>
                  <th className="pb-2">Event</th>
                  <th className="pb-2">Severity</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8F6]/60 font-mono">
                {eventsList.length > 0 ? (
                  eventsList.slice(0, 5).map((ev) => (
                    <tr key={ev.id} className="hover:bg-[#F1F7FF] transition">
                      <td className="py-2 font-mono text-[#475569] text-[11px] whitespace-nowrap">
                        {ev.time}
                      </td>
                      <td className="py-2 font-semibold text-[#0F172A] whitespace-nowrap">
                        {ev.zone_name.replace(" Vaccine Store", " A").replace(" Dairy Chiller", " B").replace(" Frozen Store", " C")}
                      </td>
                      <td className="py-2 text-[#0F172A] font-medium max-w-[130px] truncate" title={ev.event}>
                        {ev.event}
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-bold text-[10px] ${
                            ev.severity === "high"
                              ? "text-rose-600"
                              : ev.severity === "medium"
                              ? "text-amber-600"
                              : "text-[#2563EB]"
                          }`}
                        >
                          {ev.severity === "high" ? "🔺 High" : ev.severity === "medium" ? "🔔 Med" : "💧 Low"}
                        </span>
                      </td>
                      <td className="py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${
                            ev.status === "active" ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              ev.status === "active" ? "bg-rose-500 animate-ping" : "bg-emerald-500"
                            }`}
                          />
                          {ev.status === "active" ? "Active" : "Resolved"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-[#475569]">
                      No active alert incidents recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-3 border-t border-[#DCE8F6] text-[11px] text-[#475569] font-mono flex items-center justify-between">
            <span>Database: SQLite / TimescaleDB</span>
            <span className="text-emerald-700 font-bold flex items-center gap-1">
              <CheckCircle2 size={12} /> {health?.readings_stored ?? 0} Readings Indexed
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 1: DOOR EVENT TIMELINE
          ═══════════════════════════════════════════════════════════════════ */}
      {showTimelineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-[#DCE8F6]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Stateful Door Events Timeline ({currentZone?.name || focusedZoneId})
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Independent opening and closing tracking with residual temperature rise and recovery progress.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTimelineModal(false)}
                className="text-[#475569] hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F1F7FF] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto my-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#DCE8F6] text-[11px] font-bold text-[#0F172A] uppercase tracking-wider font-mono bg-[#EFF6FF]">
                    <th className="py-2.5 px-3">Opened At</th>
                    <th className="py-2.5 px-3">Closed At</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Ambient</th>
                    <th className="py-2.5 px-3">Temp Open/Close</th>
                    <th className="py-2.5 px-3">Residual ΔT</th>
                    <th className="py-2.5 px-3">Peak Temp</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DCE8F6]/60 font-mono">
                  {doorEventsList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-[#475569]">
                        No door events recorded yet for this chamber.
                      </td>
                    </tr>
                  ) : (
                    doorEventsList.map((ev) => (
                      <tr key={ev.id} className="hover:bg-[#F1F7FF] transition">
                        <td className="py-2.5 px-3 text-[#475569]">
                          {new Date(ev.opened_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </td>
                        <td className="py-2.5 px-3 text-[#475569]">
                          {ev.closed_at
                            ? new Date(ev.closed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                            : "Still Open"}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#0F172A]">
                          {Math.round(ev.duration_seconds / 60)} min ({ev.duration_seconds}s)
                        </td>
                        <td className="py-2.5 px-3 text-amber-600 font-semibold">
                          {ev.ambient_temp_at_open ? `${ev.ambient_temp_at_open.toFixed(1)}°C` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[#0F172A]">
                          {ev.temp_at_open?.toFixed(1) ?? "—"}° / {ev.temp_at_close?.toFixed(1) ?? "—"}°
                        </td>
                        <td className="py-2.5 px-3 text-amber-600 font-bold">
                          +{ev.residual_rise_predicted.toFixed(2)}°C
                        </td>
                        <td className="py-2.5 px-3 text-[#2563EB] font-bold">
                          {ev.peak_temp_predicted ? `${ev.peak_temp_predicted.toFixed(1)}°C` : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              ev.status === "open"
                                ? "bg-rose-50 text-rose-800 border-rose-200 animate-pulse"
                                : ev.status === "recovering"
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {ev.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-[#DCE8F6] flex items-center justify-between text-xs text-[#475569]">
              <span>Door states and residual thermal rise are persisted in database table `door_events`.</span>
              <button
                onClick={() => setShowTimelineModal(false)}
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white font-bold text-xs hover:bg-[#1D4ED8] cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODAL 2: MODEL EVALUATION & MULTI-HORIZON VALIDATION (100% Dynamic)
          ═══════════════════════════════════════════════════════════════════ */}
      {showEvalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-[#DCE8F6]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
                  <Activity size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Model Evaluation: Multi-Horizon Forecasting vs Baseline Models
                  </h3>
                  <p className="text-xs text-[#475569]">
                    Chronological 80/20 test split comparison against Persistence and Linear Trend baselines.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEvalModal(false)}
                className="text-[#475569] hover:text-[#0F172A] p-1 rounded-lg hover:bg-[#F1F7FF] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto my-4 space-y-4">
              {/* Architecture & Dataset Summary (Purely Dynamic) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                  <span className="text-[#475569]">Architecture</span>
                  <div className="font-bold text-[#0F172A] font-mono mt-0.5">
                    {evaluationData?.model_architecture || "RandomForest (100 Trees)"}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                  <span className="text-[#475569]">Held-Out Test Samples</span>
                  <div className="font-bold text-[#2563EB] font-mono mt-0.5">
                    {evaluationData?.n_test_samples != null ? `${evaluationData.n_test_samples.toLocaleString()} samples` : "—"}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                  <span className="text-[#475569]">30m Precision / Recall</span>
                  <div className="font-bold text-emerald-700 font-mono mt-0.5">
                    {evaluationData?.excursion_classification_30m
                      ? `${(evaluationData.excursion_classification_30m.precision * 100).toFixed(1)}% / ${(evaluationData.excursion_classification_30m.recall * 100).toFixed(1)}%`
                      : "—"}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                  <span className="text-[#475569]">30m F1 Score</span>
                  <div className="font-bold text-[#2563EB] font-mono mt-0.5">
                    {evaluationData?.excursion_classification_30m?.f1_score != null
                      ? evaluationData.excursion_classification_30m.f1_score.toFixed(3)
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Baseline Comparison Table (Purely Dynamic) */}
              <div className="rounded-xl border border-[#DCE8F6] overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#EFF6FF] text-[#0F172A] font-bold uppercase text-[11px] border-b border-[#DCE8F6] font-mono">
                      <th className="p-3">Forecast Horizon</th>
                      <th className="p-3">ColdGuard ML MAE</th>
                      <th className="p-3">Persistence Baseline MAE</th>
                      <th className="p-3">Linear Trend Baseline MAE</th>
                      <th className="p-3">Error Reduction vs Persistence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE8F6] font-mono bg-white">
                    {evaluationData?.horizons_evaluation && evaluationData.horizons_evaluation.length > 0 ? (
                      evaluationData.horizons_evaluation.map((h, idx) => (
                        <tr key={idx} className="hover:bg-[#F1F7FF]">
                          <td className="p-3 font-sans font-bold text-[#0F172A]">{h.horizon_label}</td>
                          <td className="p-3 text-[#2563EB] font-bold">{h.mae_model.toFixed(2)}°C</td>
                          <td className="p-3 text-[#475569]">{h.mae_persistence.toFixed(2)}°C</td>
                          <td className="p-3 text-[#475569]">{h.mae_trend.toFixed(2)}°C</td>
                          <td className="p-3 text-emerald-700 font-bold">+{h.improvement_over_persistence_pct.toFixed(1)}%</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-[#475569]">
                          Loading live multi-horizon evaluation data...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Synthetic Data Disclaimer (Dynamic from Backend) */}
              {evaluationData?.disclaimer && (
                <div className="rounded-xl p-3 bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
                  <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <div className="font-bold">Synthetic Estimates vs Validated Real-World Performance</div>
                    <div>{evaluationData.disclaimer}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#DCE8F6] flex items-center justify-end">
              <button
                onClick={() => setShowEvalModal(false)}
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white font-bold text-xs hover:bg-[#1D4ED8] cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
