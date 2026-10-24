import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Cpu,
  Layers,
  Link2,
  Database,
  Radio,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Zap,
  HelpCircle,
  Info,
} from "lucide-react";
import { TelemetryIntegrityPanel } from "../components/TelemetryIntegrityPanel";

export default function BlockchainAudit() {
  const [showGuide, setShowGuide] = useState(true);

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center text-[#2563EB] shadow-sm">
              <ShieldCheck size={22} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2">
                Blockchain Audit Trail & Anti-Tamper Ledger
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] font-semibold uppercase tracking-wider">
                  Cryptographic Proof
                </span>
              </h1>
              <p className="text-xs text-[#475569] mt-0.5 font-medium">
                Ensures cold storage temperature records are 100% genuine and have never been altered or falsified.
              </p>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-medium shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>FDA 21 CFR Part 11 Active</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] text-[#2563EB] text-xs font-mono font-semibold shadow-arctic-card">
            <Lock size={14} className="text-[#2563EB]" />
            <span>Tamper-Evident</span>
          </div>
        </div>
      </div>

      {/* Easy-to-Understand "Why Blockchain?" Guidance Card */}
      {showGuide && (
        <div className="rounded-2xl border-2 border-[#BAE6FD] bg-[#EFF6FF] p-5 shadow-sm text-[#0F172A] relative">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-[#2563EB] font-bold text-sm">
              <HelpCircle size={18} />
              <span>How This Works (Simple Explanation for Inspectors):</span>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="text-xs text-[#475569] hover:text-[#0F172A] font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>

          <div className="text-xs text-[#475569] leading-relaxed mb-4">
            In standard warehouses, when vaccines or food spoil during a power cut, staff might secretly change the database history to hide the mistake. <strong className="text-[#0F172A]">ColdGuard AI solves this:</strong> each sensor reading is stamped with a unique cryptographic fingerprint (SHA-256) and anchored into a blockchain block. If anyone ever changes a single number in the database later, the fingerprint breaks immediately and alerts you in bright RED.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-white border border-[#BAE6FD] shadow-sm">
              <div className="font-bold text-[#2563EB] mb-1">Step 1: Real Reading</div>
              <div className="text-[#475569] text-[11px]">Thermometers measure room temperature every minute.</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#BAE6FD] shadow-sm">
              <div className="font-bold text-[#2563EB] mb-1">Step 2: Digital Seal</div>
              <div className="text-[#475569] text-[11px]">A unique mathematical fingerprint is created for that exact reading.</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#BAE6FD] shadow-sm">
              <div className="font-bold text-[#2563EB] mb-1">Step 3: Blockchain Block</div>
              <div className="text-[#475569] text-[11px]">Readings are permanently chained together. You cannot rewrite history.</div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#BAE6FD] shadow-sm">
              <div className="font-bold text-emerald-700 mb-1">Step 4: Tamper Alarm</div>
              <div className="text-[#475569] text-[11px]">If someone alters a reading in the database, it turns RED instantly!</div>
            </div>
          </div>
        </div>
      )}

      {/* Main Interactive Blockchain Telemetry Integrity Console */}
      <TelemetryIntegrityPanel />

      {/* Regulatory Context Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card">
          <div className="flex items-center gap-2.5 text-[#2563EB] font-bold text-sm mb-2">
            <Shield size={18} />
            <span>Anti-Fraud Protection</span>
          </div>
          <p className="text-xs text-[#475569] leading-relaxed">
            Eliminates paper log tampering and backdated data entry. Government auditors can trust that displayed temperatures were recorded in real-time by calibrated sensors, not typed in after an excursion.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card">
          <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-sm mb-2">
            <CheckCircle2 size={18} />
            <span>FDA 21 CFR Part 11 Compliant</span>
          </div>
          <p className="text-xs text-[#475569] leading-relaxed">
            Satisfies federal guidelines for electronic batch records, tamper-evident audit trails, and automatic record retention. Accepted by health authorities worldwide for pharmaceutical distribution.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card">
          <div className="flex items-center gap-2.5 text-[#2563EB] font-bold text-sm mb-2">
            <Database size={18} />
            <span>Independent Verification</span>
          </div>
          <p className="text-xs text-[#475569] leading-relaxed">
            Auditors do not need to trust the warehouse management's word. The mathematical Merkle tree proofs allow any independent inspector to verify the integrity of the data in seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
