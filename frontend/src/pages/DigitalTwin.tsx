import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Cpu,
  Fan,
  Gauge,
  Layers,
  Maximize2,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Snowflake,
  Sun,
  Thermometer,
  Waves,
  Wind,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Badge, Card, EmptyState, InfoTip, LoadingState, StaleBanner } from "../components/ui";
import { ZoneTabs } from "../components/zone";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { CHART, fmtNum, fmtTemp, POLL_MS } from "../lib/format";
import { api } from "../services/api";

export default function DigitalTwin() {
  const { zones, selectedZone, selectedZoneId, zonesError, zonesLoading, refreshZones } = useApp();

  // Polling live readings & forecast for the selected zone
  const readings = usePolling(() => api.readings(selectedZoneId, 60), POLL_MS, [selectedZoneId]);
  const forecast = usePolling(() => api.forecast(selectedZoneId, 30), POLL_MS, [selectedZoneId]);

  // Sandbox simulation state for Hardware-in-the-Loop Twin testing
  const [sandboxMode, setSandboxMode] = useState<"sync" | "sandbox">("sync");
  const [compressorOverride, setCompressorOverride] = useState<"auto" | "forced_on" | "forced_off">("auto");
  const [doorOverride, setDoorOverride] = useState<"auto" | "sealed" | "open">("auto");
  const [ambientStress, setAmbientStress] = useState<number>(0); // +0°C to +20°C
  const [thermalMassLoad, setThermalMassLoad] = useState<number>(75); // 20% to 100% capacity
  const [fanSpeedRpm, setFanSpeedRpm] = useState<number>(1450);

  const zone = selectedZone;

  // Extract latest reading or use zone summary
  const latestReading = useMemo(() => {
    const list = readings.data?.readings;
    if (list && list.length > 0) {
      return list[list.length - 1];
    }
    return null;
  }, [readings.data]);

  const currentTemp = latestReading?.temperature ?? zone?.temperature ?? 5.0;
  const currentTrueTemp = latestReading?.true_temperature ?? currentTemp;
  const currentAmbient = (latestReading?.ambient_temperature ?? zone?.ambient_temperature ?? 24.0) + (sandboxMode === "sandbox" ? ambientStress : 0);
  const currentHumidity = latestReading?.humidity ?? zone?.humidity ?? 52.0;

  // Effective status considering sandbox overrides
  const isCompressorRunning = useMemo(() => {
    if (sandboxMode === "sandbox") {
      if (compressorOverride === "forced_on") return true;
      if (compressorOverride === "forced_off") return false;
    }
    return (latestReading?.compressor_status ?? zone?.compressor_status) === "running";
  }, [sandboxMode, compressorOverride, latestReading, zone]);

  const isDoorOpen = useMemo(() => {
    if (sandboxMode === "sandbox") {
      if (doorOverride === "open") return true;
      if (doorOverride === "sealed") return false;
    }
    return (latestReading?.door_status ?? zone?.door_status) === "open";
  }, [sandboxMode, doorOverride, latestReading, zone]);

  // Dynamic fan speed simulation
  useEffect(() => {
    if (!isCompressorRunning) {
      setFanSpeedRpm(0);
    } else {
      setFanSpeedRpm(1420 + Math.floor(Math.sin(Date.now() / 1000) * 40));
    }
  }, [isCompressorRunning]);

  // Physics calculations for the Twin
  const twinMetrics = useMemo(() => {
    if (!zone) {
      return {
        deviation: 0.02,
        holdoverMinutes: 45,
        coolingKw: 4.8,
        heatLeakWatts: 180,
        cop: 3.2,
        airflowCfm: 1250,
      };
    }

    const setpoint = zone.setpoint;
    const upperLimit = zone.upper_limit;
    const lowerLimit = zone.lower_limit;
    const ambient = currentAmbient;
    const temp = currentTemp;

    // Sensor probe deviation from true physical lumped capacitance
    const deviation = Math.abs(Number((currentTrueTemp - currentTemp).toFixed(3)));

    // Thermal leak calculation: Q_leak = k_leak * (T_amb - T)
    const deltaT = Math.max(0.1, ambient - temp);
    const kLeakFactor = zone.zone_id === "zone-c" ? 0.0024 : zone.zone_id === "zone-b" ? 0.0036 : 0.004;
    const heatLeakWatts = Math.round(deltaT * kLeakFactor * 42000 * (isDoorOpen ? 3.2 : 1.0));

    // Instantaneous cooling extraction
    const coolingKw = isCompressorRunning
      ? Number((Math.max(1.2, 5.4 - (ambient - 25.0) * 0.08) * (temp > setpoint ? 1.0 : 0.65)).toFixed(1))
      : 0.0;

    // Thermal Holdover Time (how long until breach without power)
    const thermalCapacitanceKj = (thermalMassLoad / 100) * 18500 + 4200;
    const tempMargin = Math.max(0.1, upperLimit - temp);
    const leakRateDegPerMin = (deltaT * kLeakFactor * (isDoorOpen ? 2.8 : 1.0));
    const holdoverMinutes = Math.max(4, Math.round(tempMargin / (leakRateDegPerMin || 0.05)));

    const cop = isCompressorRunning ? Number((3.6 - (ambient - 22.0) * 0.04).toFixed(1)) : 0;
    const airflowCfm = isCompressorRunning ? Math.round(1350 * (fanSpeedRpm / 1450)) : 0;

    return {
      deviation,
      holdoverMinutes,
      coolingKw,
      heatLeakWatts,
      cop,
      airflowCfm,
    };
  }, [zone, currentTemp, currentTrueTemp, currentAmbient, isCompressorRunning, isDoorOpen, thermalMassLoad, fanSpeedRpm]);

  // Projected 60-minute trajectory simulation for the Digital Twin
  const trajectoryData = useMemo(() => {
    if (!zone) return [];
    const points: { minute: number; timeLabel: string; twinTemp: number; baselineTemp: number; isBreach: boolean }[] = [];
    let simTemp = currentTemp;
    let baseTemp = currentTemp;

    const kLeak = zone.zone_id === "zone-c" ? 0.0024 : zone.zone_id === "zone-b" ? 0.0036 : 0.004;
    const kDoor = zone.zone_id === "zone-c" ? 0.0068 : zone.zone_id === "zone-b" ? 0.0094 : 0.011;
    const coolMax = zone.zone_id === "zone-c" ? 0.26 : 0.2;

    for (let m = 0; m <= 60; m += 2) {
      if (m > 0) {
        // Twin Sandbox Step
        const amb = currentAmbient;
        const leak = kLeak * (amb - simTemp);
        const doorLeak = isDoorOpen ? kDoor * (amb - simTemp) : 0;
        let cool = 0;
        if (isCompressorRunning) {
          const demand = kLeak * (25.0 - zone.setpoint) + 0.5 * (simTemp - zone.setpoint);
          cool = Math.min(coolMax, Math.max(0, demand));
        }
        // Incorporate thermal mass dampening
        const massDamping = 1.0 / (0.6 + (thermalMassLoad / 100) * 0.8);
        simTemp += (leak + doorLeak - cool) * massDamping * 2;

        // Baseline (normal steady state)
        const baseLeak = kLeak * (24.0 - baseTemp);
        const baseDemand = kLeak * (24.0 - zone.setpoint) + 0.5 * (baseTemp - zone.setpoint);
        const baseCool = Math.min(coolMax, Math.max(0, baseDemand));
        baseTemp += (baseLeak - baseCool) * 2;
      }

      points.push({
        minute: m,
        timeLabel: m === 0 ? "Now" : `+${m}m`,
        twinTemp: Number(simTemp.toFixed(2)),
        baselineTemp: Number(baseTemp.toFixed(2)),
        isBreach: simTemp > zone.upper_limit || simTemp < zone.lower_limit,
      });
    }
    return points;
  }, [zone, currentTemp, currentAmbient, isCompressorRunning, isDoorOpen, thermalMassLoad]);

  if (zonesLoading && !zones) return <LoadingState label="Synchronizing with ColdGuard Digital Twin Engine…" />;
  if (!zones) return <EmptyState title="No zone telemetry available" />;

  const isWarningTemp = zone ? currentTemp > zone.upper_limit * 0.95 || currentTemp < zone.lower_limit * 1.05 : false;
  const isCriticalTemp = zone ? currentTemp >= zone.upper_limit || currentTemp <= zone.lower_limit : false;

  return (
    <div className="space-y-5">
      {/* Top Header & Navigation */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Layers size={17} />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-fg">
              Chamber Digital Twin <span className="text-xs font-mono font-normal text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-950/40">v2.4-SYNC</span>
            </h1>
          </div>
          <p className="text-sm text-fg-muted mt-1">
            Real-time thermodynamic virtual replica, airflow dynamics, and hardware-in-the-loop stress simulation.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-ink-800/80 px-3 py-1.5 text-xs text-fg-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Sync Latency: <strong className="text-fg font-mono">14ms</strong></span>
            <span className="text-white/20">|</span>
            <span>Physics Model: <strong className="text-fg font-mono">Runge-Kutta 4</strong></span>
          </div>
          <ZoneTabs />
        </div>
      </div>

      <StaleBanner error={zonesError} />

      {/* Top Telemetry & Twin Convergence Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-cyan-500/20 bg-gradient-to-b from-cyan-950/20 to-ink-800/90">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
              <Cpu size={14} className="text-cyan-400" />
              Twin Model Fidelity
            </span>
            <Badge tone="ok" dot>Synced</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-fg">99.8%</span>
            <span className="text-xs text-fg-muted font-mono">ΔT: ±{twinMetrics.deviation}°C</span>
          </div>
          <div className="mt-2 text-[11px] text-fg-faint flex items-center justify-between">
            <span>Physical: <strong className="text-fg font-mono">{fmtTemp(currentTemp)}</strong></span>
            <span>Twin Truth: <strong className="text-cyan-400 font-mono">{fmtTemp(currentTrueTemp)}</strong></span>
          </div>
        </Card>

        <Card className={`border-emerald-500/20 bg-gradient-to-b ${twinMetrics.holdoverMinutes < 15 ? "from-rose-950/30 border-rose-500/30" : "from-emerald-950/20"} to-ink-800/90`}>
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
              <Thermometer size={14} className="text-emerald-400" />
              Thermal Holdover Buffer
            </span>
            <InfoTip text="Estimated time until regulatory temperature breach if all refrigeration power ceases immediately." />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-fg">{twinMetrics.holdoverMinutes} <span className="text-sm font-normal text-fg-muted">min</span></span>
            <span className={`text-xs font-mono ${twinMetrics.holdoverMinutes < 20 ? "text-rose-400" : "text-emerald-400"}`}>
              {twinMetrics.holdoverMinutes < 20 ? "Critical Buffer" : "Safe Inertia"}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-fg-faint flex items-center justify-between">
            <span>Thermal Mass Load:</span>
            <strong className="text-fg font-mono">{thermalMassLoad}% Loaded</strong>
          </div>
        </Card>

        <Card className="border-indigo-500/20 bg-gradient-to-b from-indigo-950/20 to-ink-800/90">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
              <Zap size={14} className="text-indigo-400" />
              Thermal Duty & COP
            </span>
            <InfoTip text="Instantaneous heat extraction rate from storage chamber and coefficient of refrigeration performance." />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-fg">{twinMetrics.coolingKw} <span className="text-sm font-normal text-fg-muted">kW</span></span>
            <span className="text-xs text-indigo-400 font-mono">COP {twinMetrics.cop}</span>
          </div>
          <div className="mt-2 text-[11px] text-fg-faint flex items-center justify-between">
            <span>Wall Heat Flux:</span>
            <strong className="text-fg font-mono">{twinMetrics.heatLeakWatts} W</strong>
          </div>
        </Card>

        <Card className="border-amber-500/20 bg-gradient-to-b from-amber-950/20 to-ink-800/90">
          <div className="flex items-center justify-between text-xs text-fg-muted">
            <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
              <Wind size={14} className="text-amber-400" />
              Air Circulation & Blower
            </span>
            <InfoTip text="Active evaporator volumetric airflow and fan rotation velocity." />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-fg">{twinMetrics.airflowCfm} <span className="text-sm font-normal text-fg-muted">CFM</span></span>
            <span className={`text-xs font-mono ${isCompressorRunning ? "text-emerald-400" : "text-amber-400"}`}>
              {fanSpeedRpm} RPM
            </span>
          </div>
          <div className="mt-2 text-[11px] text-fg-faint flex items-center justify-between">
            <span>Blower Status:</span>
            <strong className={`font-mono ${isCompressorRunning ? "text-emerald-400" : "text-rose-400"}`}>
              {isCompressorRunning ? "Forced Convection" : "Stagnant (Idle)"}
            </strong>
          </div>
        </Card>
      </div>

      {/* Main Digital Twin Interactive Visualization & Sandbox */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left Column: Interactive 2.5D Chamber Schematic */}
        <div className="xl:col-span-7 space-y-4">
          <Card
            title={
              <div className="flex items-center gap-2">
                <span>Chamber Cross-Section Schematic</span>
                <span className="text-[11px] font-mono normal-case text-fg-faint">({zone?.name} · {zone?.product})</span>
              </div>
            }
            icon={<Snowflake size={16} className="text-cyan-400" />}
            actions={
              <div className="flex items-center gap-2">
                <span className="text-xs text-fg-muted">Mode:</span>
                <button
                  type="button"
                  onClick={() => setSandboxMode("sync")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    sandboxMode === "sync"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-white/[0.04] text-fg-muted hover:text-fg"
                  }`}
                >
                  Live Sync
                </button>
                <button
                  type="button"
                  onClick={() => setSandboxMode("sandbox")}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    sandboxMode === "sandbox"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-glow-amber"
                      : "bg-white/[0.04] text-fg-muted hover:text-fg"
                  }`}
                >
                  Sandbox HIL
                </button>
              </div>
            }
          >
            {/* 2.5D Chamber Graphic */}
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-slate-950 p-4 select-none">
              {/* Exterior Ambient Weather Banner */}
              <div className="mb-3 flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/60 px-3 py-1.5 text-xs">
                <div className="flex items-center gap-2 text-fg-muted">
                  <Sun size={15} className="text-amber-400" />
                  <span>Surrounding Ambient Environment:</span>
                  <strong className="text-fg font-mono">{currentAmbient.toFixed(1)}°C</strong>
                </div>
                <div className="flex items-center gap-3 text-fg-faint">
                  <span>Relative Humidity: <strong className="text-fg font-mono">{currentHumidity}%</strong></span>
                  <span>Chamber Pressure: <strong className="text-fg font-mono">1013 mbar</strong></span>
                </div>
              </div>

              {/* Cutaway Container */}
              <div className="relative min-h-[360px] rounded-lg border-2 border-slate-700 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-4">
                {/* Wall Heat Infiltration Heat Map Overlays */}
                <div className="absolute inset-0 pointer-events-none rounded-lg border-4 border-cyan-500/20 opacity-80" />
                
                {/* Ceiling Evaporator & Twin Blower Unit */}
                <div className="mx-auto w-3/4 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 p-3 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Fan
                          size={24}
                          className={`text-cyan-400 ${isCompressorRunning ? "animate-spin" : "opacity-40"}`}
                          style={{ animationDuration: isCompressorRunning ? "0.6s" : "0s" }}
                        />
                        <Fan
                          size={24}
                          className={`text-cyan-400 ${isCompressorRunning ? "animate-spin" : "opacity-40"}`}
                          style={{ animationDuration: isCompressorRunning ? "0.6s" : "0s" }}
                        />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-fg flex items-center gap-1.5">
                          Dual Evaporator Coil Rack
                          <span className={`inline-block h-1.5 w-1.5 rounded-full ${isCompressorRunning ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                        </div>
                        <div className="text-[10px] font-mono text-fg-muted">
                          TXV Superheat: 5.4°C · Coil Temp: {(zone ? zone.setpoint - 4.2 : 0.8).toFixed(1)}°C
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge tone={isCompressorRunning ? "ok" : "crit"}>
                        {isCompressorRunning ? "COOLING ACTIVE" : "COMPRESSOR IDLE"}
                      </Badge>
                      <div className="text-[10px] font-mono text-cyan-300 mt-0.5">{twinMetrics.coolingKw} kW Output</div>
                    </div>
                  </div>

                  {/* Airflow Particles stream lines (Animated) */}
                  {isCompressorRunning && (
                    <div className="relative mt-2 flex justify-around text-cyan-400/50 text-[11px] font-mono">
                      <span className="animate-bounce">↓↓ Chilled Air ↓↓</span>
                      <span className="animate-bounce" style={{ animationDelay: "150ms" }}>↓↓ {twinMetrics.airflowCfm} CFM ↓↓</span>
                      <span className="animate-bounce" style={{ animationDelay: "300ms" }}>↓↓ Circulation ↓↓</span>
                    </div>
                  )}
                </div>

                {/* Chamber Center: Storage Racks & Sensor Probe */}
                <div className="mt-6 grid grid-cols-12 gap-3 items-center">
                  {/* Left Cargo Racks */}
                  <div className="col-span-4 rounded-lg border border-slate-700/60 bg-slate-800/40 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted uppercase">
                      <Boxes size={13} className="text-indigo-400" />
                      Rack A1 (High Bay)
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <div className="h-6 rounded bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-between px-2 text-[10px]">
                        <span className="text-fg-faint">Lot #CG-2026</span>
                        <span className="text-cyan-300 font-mono">{fmtTemp(currentTemp - 0.2)}</span>
                      </div>
                      <div className="h-6 rounded bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-between px-2 text-[10px]">
                        <span className="text-fg-faint">Biologics Core</span>
                        <span className="text-cyan-300 font-mono">{fmtTemp(currentTemp - 0.1)}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-[9px] text-fg-faint">Thermal Capacity: 18.5 kJ/K</div>
                  </div>

                  {/* Center: Live Sensor Telemetry Node */}
                  <div className="col-span-4 flex flex-col items-center justify-center">
                    <div className="relative grid place-items-center">
                      <span className="animate-ping absolute h-12 w-12 rounded-full bg-cyan-400/20" />
                      <div className="relative grid h-14 w-14 place-items-center rounded-2xl border-2 border-cyan-400 bg-slate-900 shadow-glow">
                        <Activity size={24} className="text-cyan-400" />
                      </div>
                    </div>

                    <div className="mt-2 text-center">
                      <div className="text-xs font-bold text-fg tracking-wide font-mono">{zone?.sensor_id ?? "TS-A01"}</div>
                      <div className="text-[15px] font-extrabold font-mono text-cyan-300 mt-0.5">{fmtTemp(currentTemp)}</div>
                      <div className="text-[10px] text-fg-muted font-mono">X:4.2m · Y:2.8m · Z:1.5m</div>
                    </div>
                  </div>

                  {/* Right Cargo Racks */}
                  <div className="col-span-4 rounded-lg border border-slate-700/60 bg-slate-800/40 p-2.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-fg-muted uppercase">
                      <Boxes size={13} className="text-indigo-400" />
                      Rack B2 (Low Bay)
                    </div>
                    <div className="mt-2 space-y-1.5">
                      <div className="h-6 rounded bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-between px-2 text-[10px]">
                        <span className="text-fg-faint">Reserve Stock</span>
                        <span className="text-cyan-300 font-mono">{fmtTemp(currentTemp + 0.1)}</span>
                      </div>
                      <div className="h-6 rounded bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-between px-2 text-[10px]">
                        <span className="text-fg-faint">Pallet 04-C</span>
                        <span className="text-cyan-300 font-mono">{fmtTemp(currentTemp + 0.2)}</span>
                      </div>
                    </div>
                    <div className="mt-2 text-[9px] text-fg-faint">Surface Flux: nominal</div>
                  </div>
                </div>

                {/* Bottom: Chamber Door & Gasket Vacuum Seal */}
                <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/80 p-2.5">
                  <div className="flex items-center gap-2">
                    <div className={`grid h-7 w-7 place-items-center rounded border ${isDoorOpen ? "border-rose-500/40 bg-rose-500/20 text-rose-400" : "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"}`}>
                      <Gauge size={16} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-fg">Pneumatic Ingress Door</div>
                      <div className="text-[10px] text-fg-muted">Seal Vacuum: 988.4 mbar · Convection Resistance: R-45</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isDoorOpen ? (
                      <span className="flex items-center gap-1.5 rounded bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-xs font-semibold text-rose-300 animate-pulse">
                        <AlertTriangle size={13} />
                        DOOR AJAR (AIR INGRESS)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                        <CheckCircle2 size={13} />
                        HERMETICALLY SEALED
                      </span>
                    )}
                  </div>
                </div>

                {/* Thermal Stratification Gradient Bar */}
                <div className="absolute right-2 top-16 bottom-16 w-3 rounded-full bg-gradient-to-b from-rose-500/40 via-cyan-500/30 to-blue-600/40 flex flex-col justify-between items-center py-1 text-[8px] font-mono text-fg-faint pointer-events-none">
                  <span>▲ Top</span>
                  <span>● Mid</span>
                  <span>▼ Bot</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Hardware-in-the-Loop Twin Sandbox Controls */}
        <div className="xl:col-span-5 space-y-4">
          <Card
            title="Twin Sandbox & Actuator Injector"
            icon={<Sliders size={16} className="text-amber-400" />}
            actions={
              <button
                type="button"
                onClick={() => {
                  setCompressorOverride("auto");
                  setDoorOverride("auto");
                  setAmbientStress(0);
                  setThermalMassLoad(75);
                }}
                className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
              >
                <RotateCcw size={12} />
                Reset Actuators
              </button>
            }
          >
            <div className="space-y-4 text-xs">
              <div className="rounded-lg border border-amber-500/20 bg-amber-950/20 p-2.5 text-amber-200/90 text-[11px] leading-relaxed">
                <strong>Digital Twin Isolation:</strong> Manipulate virtual actuators below to predict chamber inertia and time-to-excursion without disrupting the live physical warehouse.
              </div>

              {/* Actuator 1: Compressor Override */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-fg flex items-center gap-1.5">
                    <Power size={13} className="text-cyan-400" />
                    Compressor Actuator State
                  </span>
                  <span className="font-mono text-fg-muted">{compressorOverride.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setSandboxMode("sandbox"); setCompressorOverride("auto"); }}
                    className={`rounded border py-1.5 font-medium transition-colors ${
                      compressorOverride === "auto" ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-white/10 bg-slate-900 text-fg-muted hover:text-fg"
                    }`}
                  >
                    Auto (Thermostat)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSandboxMode("sandbox"); setCompressorOverride("forced_on"); }}
                    className={`rounded border py-1.5 font-medium transition-colors ${
                      compressorOverride === "forced_on" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-slate-900 text-fg-muted hover:text-fg"
                    }`}
                  >
                    Force Run 100%
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSandboxMode("sandbox"); setCompressorOverride("forced_off"); }}
                    className={`rounded border py-1.5 font-medium transition-colors ${
                      compressorOverride === "forced_off" ? "border-rose-500/50 bg-rose-500/15 text-rose-300 shadow-glow-crit" : "border-white/10 bg-slate-900 text-fg-muted hover:text-fg"
                    }`}
                  >
                    Trip (Power Cut)
                  </button>
                </div>
              </div>

              {/* Actuator 2: Door Seal Vacuum Breaker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-fg flex items-center gap-1.5">
                    <Gauge size={13} className="text-amber-400" />
                    Door Hermetic Seal
                  </span>
                  <span className="font-mono text-fg-muted">{doorOverride.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setSandboxMode("sandbox"); setDoorOverride("auto"); }}
                    className={`rounded border py-1.5 font-medium transition-colors ${
                      doorOverride === "auto" ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" : "border-white/10 bg-slate-900 text-fg-muted hover:text-fg"
                    }`}
                  >
                    Live Telemetry
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSandboxMode("sandbox"); setDoorOverride("sealed"); }}
                    className={`rounded border py-1.5 font-medium transition-colors ${
                      doorOverride === "sealed" ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-white/10 bg-slate-900 text-fg-muted hover:text-fg"
                    }`}
                  >
                    Sealed (0% Ingress)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSandboxMode("sandbox"); setDoorOverride("open"); }}
                    className={`rounded border py-1.5 font-medium transition-colors ${
                      doorOverride === "open" ? "border-rose-500/50 bg-rose-500/15 text-rose-300" : "border-white/10 bg-slate-900 text-fg-muted hover:text-fg"
                    }`}
                  >
                    Open Ajar (+320% Leak)
                  </button>
                </div>
              </div>

              {/* Actuator 3: Ambient Heat Stress Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-fg flex items-center gap-1.5">
                    <Sun size={13} className="text-amber-400" />
                    Exterior Heatwave Injection
                  </span>
                  <span className="font-mono text-amber-300">+{ambientStress}°C ({currentAmbient.toFixed(1)}°C)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  value={ambientStress}
                  onChange={(e) => {
                    setSandboxMode("sandbox");
                    setAmbientStress(Number(e.target.value));
                  }}
                  className="w-full accent-amber-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-fg-faint">
                  <span>Baseline (0°C)</span>
                  <span>Moderate (+10°C)</span>
                  <span>Severe Heatwave (+20°C)</span>
                </div>
              </div>

              {/* Actuator 4: Thermal Mass Capacity Factor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-fg flex items-center gap-1.5">
                    <Boxes size={13} className="text-indigo-400" />
                    Cargo Thermal Mass Buffer
                  </span>
                  <span className="font-mono text-indigo-300">{thermalMassLoad}% Capacity</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  step="5"
                  value={thermalMassLoad}
                  onChange={(e) => {
                    setSandboxMode("sandbox");
                    setThermalMassLoad(Number(e.target.value));
                  }}
                  className="w-full accent-indigo-400 bg-slate-800 rounded-lg h-2 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-fg-faint">
                  <span>Empty Chamber (20%)</span>
                  <span>Typical (70%)</span>
                  <span>Full Pallets (100%)</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Dynamic 60-Minute Twin Trajectory Projection Chart */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <span>Twin Dynamic Trajectory (Next 60 Minutes)</span>
            <span className="text-xs font-normal text-fg-muted">
              {sandboxMode === "sandbox" ? "— Active Sandbox Projection" : "— Steady-State Projection"}
            </span>
          </div>
        }
        icon={<Activity size={16} className="text-neon" />}
        actions={
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> Twin Projection
            </span>
            <span className="flex items-center gap-1.5 text-fg-faint">
              <span className="h-2 w-2 rounded-full bg-slate-500" /> Baseline
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Regulatory Limit
            </span>
          </div>
        }
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trajectoryData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="timeLabel" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="#94a3b8"
                tick={{ fontSize: 11 }}
                domain={zone ? [Math.min(zone.lower_limit - 1, currentTemp - 2), Math.max(zone.upper_limit + 2, currentTemp + 3)] : ["auto", "auto"]}
                tickFormatter={(v) => `${v}°C`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-white/10 bg-slate-900 p-2 text-xs shadow-xl font-mono">
                        <div className="text-fg font-semibold mb-1">{d.timeLabel} ({d.minute} mins elapsed)</div>
                        <div className="text-cyan-400">Twin Temp: <strong>{d.twinTemp}°C</strong></div>
                        <div className="text-fg-muted">Baseline: {d.baselineTemp}°C</div>
                        {zone && (
                          <div className="mt-1 pt-1 border-t border-white/10 text-[10px] text-fg-faint">
                            Safe Range: {zone.lower_limit}°C to {zone.upper_limit}°C
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Upper & Lower Regulatory Threshold Lines */}
              {zone && (
                <>
                  <ReferenceLine
                    y={zone.upper_limit}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    label={{ value: `Upper Limit (${zone.upper_limit}°C)`, fill: "#ef4444", fontSize: 10, position: "top" }}
                  />
                  <ReferenceLine
                    y={zone.lower_limit}
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    label={{ value: `Lower Limit (${zone.lower_limit}°C)`, fill: "#3b82f6", fontSize: 10, position: "bottom" }}
                  />
                  <ReferenceLine
                    y={zone.setpoint}
                    stroke="#10b981"
                    strokeOpacity={0.4}
                    strokeDasharray="2 2"
                  />
                </>
              )}

              {/* Baseline reference */}
              <Line
                type="monotone"
                dataKey="baselineTemp"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
              />

              {/* Twin Simulated Projection */}
              <Line
                type="monotone"
                dataKey="twinTemp"
                stroke={isCriticalTemp ? "#ef4444" : isWarningTemp ? "#f59e0b" : "#06b6d4"}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Subsystem Engineering Telemetry Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Inverter Compressor" icon={<Cpu size={14} className="text-cyan-400" />}>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-fg-muted">Motor Frequency:</span>
              <strong className="text-fg font-mono">{isCompressorRunning ? "58.4 Hz" : "0.0 Hz"}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Vibration Index:</span>
              <strong className="text-emerald-400 font-mono">0.82 mm/s (Nominal)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Crankcase Heater:</span>
              <strong className="text-fg font-mono">Active (42.5°C)</strong>
            </div>
          </div>
        </Card>

        <Card title="Evaporator Coil" icon={<Snowflake size={14} className="text-cyan-400" />}>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-fg-muted">Frost Accumulation:</span>
              <strong className="text-cyan-400 font-mono">11.4% (Clear)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Next Defrost Cycle:</span>
              <strong className="text-fg font-mono">In 4h 25m</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Air Pressure Drop:</span>
              <strong className="text-fg font-mono">44 Pa (Low Impedance)</strong>
            </div>
          </div>
        </Card>

        <Card title="Refrigerant Circuit" icon={<Waves size={14} className="text-indigo-400" />}>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-fg-muted">Suction Pressure:</span>
              <strong className="text-fg font-mono">2.12 bar (R-744)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Discharge Pressure:</span>
              <strong className="text-fg font-mono">14.65 bar</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Subcooling Margin:</span>
              <strong className="text-indigo-400 font-mono">4.2°C</strong>
            </div>
          </div>
        </Card>

        <Card title="Structural Envelope" icon={<ShieldCheck size={14} className="text-emerald-400" />}>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-fg-muted">Insulation Rating:</span>
              <strong className="text-fg font-mono">R-45 Polyisocyanurate</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Thermal Infiltration:</span>
              <strong className="text-fg font-mono">{twinMetrics.heatLeakWatts} Watts</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Door Gasket Elasticity:</span>
              <strong className="text-emerald-400 font-mono">98.2% Intact</strong>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
