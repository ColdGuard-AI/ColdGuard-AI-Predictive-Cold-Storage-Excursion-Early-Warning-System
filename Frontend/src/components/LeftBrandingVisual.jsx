import React, { useState, useEffect } from 'react';
import { 
  Snowflake, 
  ShieldCheck, 
  Thermometer, 
  AlertTriangle, 
  Activity, 
  Layers, 
  Zap, 
  Radio, 
  CheckCircle2,
  Server
} from 'lucide-react';

export default function LeftBrandingVisual() {
  const [liveTemp, setLiveTemp] = useState(-24.8);
  const [compressorRpm, setCompressorRpm] = useState(3480);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulse(p => !p);
      setLiveTemp(prev => {
        const delta = (Math.random() - 0.5) * 0.15;
        return Number((prev + delta).toFixed(1));
      });
      setCompressorRpm(prev => {
        const delta = Math.floor((Math.random() - 0.5) * 40);
        return Math.max(3200, Math.min(3600, prev + delta));
      });
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative flex flex-col justify-between h-full min-h-[680px] p-8 lg:p-12 overflow-hidden bg-[#0B1220] border-r border-cyan-500/20">
      {/* Background Industrial Ambient Mesh and Glows */}
      <div className="absolute inset-0 bg-industrial-grid pointer-events-none opacity-40"></div>
      <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Branding Section */}
      <div className="relative z-10 space-y-4">
        {/* Brand Header */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 via-slate-900 to-navy-950 border border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
            <Snowflake className="w-6 h-6 text-cyan-300 animate-spin-slow" />
            <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0B1220] shadow-[0_0_8px_#10B981]"></div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-sans m-0 p-0">
                ColdGuard <span className="text-[#22D3EE] text-glow-cyan">AI</span>
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 uppercase tracking-widest">
                ENTERPRISE
              </span>
            </div>
            <p className="text-xs font-mono text-slate-400 tracking-wider uppercase mt-0.5">
              Predictive Cold Storage Excursion Early Warning System
            </p>
          </div>
        </div>

        {/* Tagline */}
        <div className="pt-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-cyan-500/30 backdrop-blur-sm">
            <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="text-sm lg:text-base font-semibold tracking-wider text-slate-200">
              <span className="text-[#22D3EE] font-bold">Predict.</span>{' '}
              <span className="text-slate-100 font-bold">Prevent.</span>{' '}
              <span className="text-[#10B981] font-bold">Preserve.</span>
            </span>
          </div>
        </div>
      </div>

      {/* Centerpiece: Cold-Storage Warehouse Visual with Interactive HUD */}
      <div className="relative z-10 my-6">
        <div className="relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)] group">
          {/* Warehouse Image */}
          <img 
            src="/cold_storage_warehouse.jpg" 
            alt="ColdGuard AI High-Tech Cold Storage Facility"
            className="w-full h-72 sm:h-80 lg:h-96 object-cover object-center transform group-hover:scale-105 transition-transform duration-700 filter brightness-95 contrast-105"
          />

          {/* Frost vignette & scanline overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-transparent to-slate-950/40 pointer-events-none"></div>
          <div className="absolute inset-0 bg-cyan-950/20 mix-blend-overlay pointer-events-none"></div>
          
          {/* Subtle Scanning Laser */}
          <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#22D3EE] to-transparent animate-scanline opacity-75 pointer-events-none"></div>

          {/* Corner High-Tech Crosshairs */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-400 pointer-events-none"></div>
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-400 pointer-events-none"></div>
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-400 pointer-events-none"></div>
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-400 pointer-events-none"></div>

          {/* Live HUD Floating Telemetry Badge 1: Top Left Chamber Setpoint */}
          <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md border border-cyan-500/30 rounded-lg p-2.5 font-mono shadow-lg text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] uppercase tracking-wider mb-1">
              <Server className="w-3 h-3 text-cyan-400" />
              <span>Chamber Core Bay-08</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-xl font-bold text-white tracking-tight">{liveTemp}°C</span>
              <span className="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 flex items-center">
                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> SAFE
              </span>
            </div>
            <div className="text-[9px] text-slate-400 mt-1 flex justify-between gap-2">
              <span>Target: -25.0°C</span>
              <span className="text-cyan-300">Tol: ±3.0°C</span>
            </div>
          </div>

          {/* Live HUD Floating Telemetry Badge 2: Top Right Predictive AI Forecast */}
          <div className="absolute top-4 right-4 bg-slate-950/85 backdrop-blur-md border border-emerald-500/30 rounded-lg p-2.5 font-mono shadow-lg text-xs">
            <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] uppercase tracking-wider mb-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Excursion Risk</span>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-lg font-bold text-emerald-400">0.8%</span>
              <span className="text-[10px] text-emerald-300 font-semibold uppercase">MINIMAL</span>
            </div>
            <div className="text-[9px] text-cyan-300 mt-1">
              Lead Time: +78 min
            </div>
          </div>

          {/* Bottom Telemetry HUD Bar */}
          <div className="absolute bottom-3 inset-x-3 bg-slate-950/90 backdrop-blur-md border border-cyan-500/20 rounded-xl p-3 font-mono">
            <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-800">
              <div>
                <span className="block text-[9px] text-slate-400 uppercase tracking-wider">Compressor Rack</span>
                <span className="text-xs font-bold text-cyan-300">{compressorRpm} RPM</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 uppercase tracking-wider">Relative Humidity</span>
                <span className="text-xs font-bold text-slate-200">59.2% RH</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 uppercase tracking-wider">Sensor Mesh</span>
                <span className="text-xs font-bold text-emerald-400 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  48/48 SAFE
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Capabilities & Compliance Highlights */}
      <div className="relative z-10 space-y-3 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-cyan-400 mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">AI Early Warning</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Thermal loss prediction up to 90 mins before setpoint boundary breach.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">FSMA 204 Ready</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Cryptographically verified cold-chain audit logs for HACCP & FDA inspectors.
            </p>
          </div>
        </div>

        {/* Prototype Environment Notice Pill */}
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-cyan-950/40 border border-cyan-500/20 text-slate-400 text-[11px] font-mono">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2 shadow-[0_0_8px_#10B981]"></span>
            Telemetry Protocol: IEEE 802.15.4 CryoMesh v2.4 (Simulated)
          </span>
          <span className="text-cyan-400 font-semibold">ONLINE</span>
        </div>
      </div>
    </div>
  );
}
