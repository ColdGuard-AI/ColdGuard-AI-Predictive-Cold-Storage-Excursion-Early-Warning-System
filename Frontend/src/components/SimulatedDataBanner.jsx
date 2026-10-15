import React from 'react';

export default function SimulatedDataBanner() {
  return (
    <div className="w-full bg-[#0B1220]/90 border-b border-cyan-500/20 backdrop-blur-md z-50 text-[11px] font-mono text-slate-300">
      <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981] animate-pulse"></span>
          <span className="text-slate-400 uppercase tracking-wider text-[10px]">Environment:</span>
          <span className="text-cyan-300 font-semibold">Simulated Sensor Telemetry Active</span>
        </div>
        <span className="text-slate-400 text-[10px] hidden sm:inline">
          TimescaleDB & PostgreSQL Storage Ready
        </span>
      </div>
    </div>
  );
}
