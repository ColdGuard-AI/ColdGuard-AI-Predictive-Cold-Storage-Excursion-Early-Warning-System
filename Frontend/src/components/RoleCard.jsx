import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  ClipboardCheck, 
  ShoppingBag, 
  Check, 
  Key, 
  ArrowRight 
} from 'lucide-react';

const ICON_MAP = {
  ShieldCheck: ShieldCheck,
  Cpu: Cpu,
  ClipboardCheck: ClipboardCheck,
  ShoppingBag: ShoppingBag,
};

export default function RoleCard({ 
  role, 
  isSelected, 
  onSelect, 
  onQuickFill 
}) {
  const IconComponent = ICON_MAP[role.icon] || ShieldCheck;

  return (
    <div
      onClick={() => onSelect(role.id)}
      className={`relative p-3.5 sm:p-4 rounded-xl cursor-pointer transition-all duration-300 select-none text-left ${
        isSelected
          ? 'frost-panel-active bg-cyan-950/40 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
          : 'frost-panel bg-slate-900/60 border-slate-800/80 hover:border-cyan-500/40 hover:bg-slate-900/90'
      }`}
    >
      {/* Selection Glow Indicator */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center space-x-3">
          <div 
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              isSelected 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <IconComponent className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center space-x-1.5 m-0 p-0">
              <span>{role.title}</span>
            </h2>
            <span className="text-[10px] font-mono font-medium text-cyan-400 uppercase tracking-wider">
              {role.badge}
            </span>
          </div>
        </div>

        {/* Radio Pill */}
        <div 
          className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
            isSelected
              ? 'bg-cyan-400 text-[#0B1220] shadow-[0_0_8px_#22D3EE]'
              : 'border border-slate-600 bg-slate-900'
          }`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </div>
      </div>

      {/* Role Scope Description */}
      <p className="text-xs text-slate-400 mt-2.5 line-clamp-2 leading-relaxed">
        {role.description}
      </p>

      {/* Role Footer & 1-Click Demo Fill Action */}
      <div className="mt-3 pt-2.5 border-t border-slate-800/70 flex items-center justify-between text-[11px] font-mono">
        <span className="text-slate-400 text-[10px]">
          {role.clearance}
        </span>
        
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickFill(role);
          }}
          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 hover:bg-cyan-900/60 transition-all cursor-pointer shadow-sm"
          title="Auto-fill credentials for this role"
        >
          <Key className="w-2.5 h-2.5" />
          <span>Demo Fill</span>
        </button>
      </div>
    </div>
  );
}
