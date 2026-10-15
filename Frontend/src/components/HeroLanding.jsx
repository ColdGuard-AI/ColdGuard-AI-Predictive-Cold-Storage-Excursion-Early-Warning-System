import React from 'react';
import { Snowflake, ShieldCheck, ArrowRight, Building2 } from 'lucide-react';

export default function HeroLanding({ onSelectRoleClick, onOpenRegisterCompany }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-[#0B1220] select-none font-sans">
      
      {/* 1. Fullscreen Cold Storage Background Visual */}
      <div className="absolute inset-0 z-0">
        <img 
          src="/cold_storage_warehouse.jpg" 
          alt="Cold Storage Warehouse Interior"
          className="w-full h-full object-cover object-center filter brightness-[0.38] contrast-[1.1] scale-105"
        />
        
        {/* Dark Navy Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/75 to-[#0B1220]/80"></div>
        <div className="absolute inset-0 bg-radial-cold-glow opacity-70 pointer-events-none"></div>
        <div className="absolute inset-0 bg-industrial-grid opacity-25 pointer-events-none"></div>
      </div>

      {/* 2. Top Header */}
      <header className="relative z-10 w-full px-6 py-6 max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Crest */}
        <div className="flex items-center space-x-3.5">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-slate-950 border border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.25)]">
            <Snowflake className="w-6 h-6 text-cyan-300" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0B1220] shadow-[0_0_8px_#10B981]"></div>
          </div>
          <div>
            <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-white font-sans">
              ColdGuard <span className="text-[#22D3EE] text-glow-cyan">AI</span>
            </span>
            <p className="text-[11px] font-mono text-slate-400 tracking-wider uppercase mt-0.5">
              Predictive Cold Storage Intelligence
            </p>
          </div>
        </div>

        {/* Register Company Action */}
        <button
          onClick={onOpenRegisterCompany}
          className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white transition cursor-pointer"
        >
          <Building2 className="w-3.5 h-3.5 text-cyan-400" />
          <span>Register Company</span>
        </button>
      </header>

      {/* 3. CENTER HERO: Tagline & Overlapping "Select Role" Button */}
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-16 text-center flex flex-col items-center justify-center my-auto">
        
        {/* Tagline */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-tight mb-4 drop-shadow-2xl">
          <span className="text-cyan-400 text-glow-cyan">Predict.</span>{' '}
          <span className="text-slate-100">Prevent.</span>{' '}
          <span className="text-emerald-400 text-glow-green">Preserve.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto font-normal leading-relaxed mb-10 drop-shadow">
          Autonomous thermal excursion early warning system for high-bay cold storage facilities and perishable logistics.
        </p>

        {/* OVERLAPPING "SELECT ROLE" CTA BUTTON */}
        <div className="relative group">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 opacity-60 blur-xl group-hover:opacity-100 transition duration-300"></div>

          <button
            onClick={onSelectRoleClick}
            className="relative px-8 sm:px-12 py-4 sm:py-5 rounded-2xl bg-gradient-to-r from-cyan-400 via-cyan-300 to-cyan-500 hover:from-cyan-300 hover:to-cyan-400 text-slate-950 font-extrabold text-base sm:text-lg tracking-wide shadow-[0_0_35px_rgba(34,211,238,0.45)] transition-all duration-300 flex items-center space-x-3 cursor-pointer group-hover:scale-105 active:scale-95"
          >
            <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            <span>Select Role</span>
            <ArrowRight className="w-5 h-5 stroke-[2.5] transform group-hover:translate-x-1.5 transition-transform" />
          </button>
        </div>
      </div>

      {/* 4. Minimal Footer */}
      <footer className="relative z-10 w-full px-6 py-4 max-w-7xl mx-auto border-t border-cyan-500/10 text-center font-mono text-xs text-slate-400">
        ColdGuard AI — Enterprise Cold Storage Excursion Early Warning System
      </footer>

    </div>
  );
}
