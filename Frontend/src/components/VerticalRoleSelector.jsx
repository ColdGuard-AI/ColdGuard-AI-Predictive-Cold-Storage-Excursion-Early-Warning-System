import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  ClipboardCheck, 
  ShoppingBag, 
  ArrowRight, 
  ArrowUp, 
  Snowflake 
} from 'lucide-react';
import { ROLES } from '../data/mockData';

const ICON_MAP = {
  ShieldCheck: ShieldCheck,
  Cpu: Cpu,
  ClipboardCheck: ClipboardCheck,
  ShoppingBag: ShoppingBag,
};

export default function VerticalRoleSelector({ onSelectRole, onBack }) {
  const [roles, setRoles] = useState(ROLES);

  // Dynamically load roles from backend API
  useEffect(() => {
    fetch('/api/roles')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setRoles(data);
        }
      })
      .catch(() => {
        // Fallback to default roles if offline
      });
  }, []);

  return (
    <section 
      id="roles-section"
      className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-[#0B1220] select-none font-sans py-6 px-4 sm:px-6 lg:px-8"
    >
      {/* 1. Fullscreen Cold Storage Background Visual */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img 
          src="/cold_storage_roles_bg.jpg" 
          alt="Cold Storage Facility with Evaporators and Produce"
          className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-[1.15] scale-105"
        />
        {/* Dark Navy Gradient & Cold Glow Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/65 to-[#0B1220]/75"></div>
        <div className="absolute inset-0 bg-radial-cold-glow opacity-60 pointer-events-none"></div>
        <div className="absolute inset-0 bg-industrial-grid opacity-20 pointer-events-none"></div>
        {/* Cold Ambient Laser Line */}
        <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#22D3EE] to-transparent animate-scanline opacity-40 pointer-events-none"></div>
      </div>

      {/* 2. Top Header Navigation */}
      <header className="relative z-10 w-full max-w-5xl mx-auto flex items-center justify-between pb-2">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-slate-950 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.25)]">
            <Snowflake className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              ColdGuard <span className="text-[#22D3EE] text-glow-cyan">AI</span>
            </span>
          </div>
        </div>

        <button
          onClick={onBack}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-cyan-500/30 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>Back to Top</span>
        </button>
      </header>

      {/* 3. Center: Title & 4 Roles in 2x2 Grid */}
      <div className="relative z-10 max-w-5xl w-full mx-auto my-auto py-6 flex flex-col justify-center">
        
        {/* Clean Title */}
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight drop-shadow m-0 p-0">
            Select Your Role
          </h2>
        </div>

        {/* 4 ROLES SIDE-BY-SIDE (2x2 Grid: [ . . ] / [ . . ]) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full">
          {roles.map((role) => {
            const Icon = ICON_MAP[role.icon] || ShieldCheck;

            return (
              <div
                key={role.id}
                onClick={() => onSelectRole(role.id)}
                className="group relative p-5 sm:p-6 rounded-2xl frost-panel bg-slate-950/75 border border-cyan-500/25 hover:border-cyan-400 hover:bg-slate-900/90 backdrop-blur-xl transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] flex items-center justify-between gap-4 hover:scale-[1.015] active:scale-[0.99]"
              >
                {/* Role Icon & Title */}
                <div className="flex items-center space-x-4 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-700 group-hover:border-cyan-400/70 flex items-center justify-center text-cyan-300 group-hover:text-cyan-200 transition-all shadow-[0_0_12px_rgba(34,211,238,0.15)] group-hover:shadow-[0_0_16px_rgba(34,211,238,0.35)] shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-200 transition-colors m-0 p-0">
                    {role.title}
                  </h3>
                </div>

                {/* Action Button */}
                <div className="px-4 py-2 rounded-xl bg-slate-900 group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-cyan-300 text-cyan-300 group-hover:text-slate-950 font-bold text-xs font-mono transition-all duration-300 border border-cyan-500/30 group-hover:border-transparent flex items-center space-x-1.5 shrink-0 shadow-sm group-hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]">
                  <span>Select Role</span>
                  <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Bottom Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto pt-2 border-t border-cyan-500/10 text-center font-mono text-[11px] text-slate-500">
        ColdGuard AI
      </footer>

    </section>
  );
}
