import React from "react";
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
} from "lucide-react";
import { TelemetryIntegrityPanel } from "../components/TelemetryIntegrityPanel";

export default function BlockchainAudit() {
  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-cyan-500/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <ShieldCheck size={22} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Blockchain Telemetry Integrity
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-semibold uppercase tracking-wider">
                  Cryptographic Ledger
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                End-to-end telemetry provenance: deterministic SHA-256 canonicalization, hash-chain verification, Merkle tree batching, and Proof-of-Work blockchain anchoring.
              </p>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-medium shadow-[0_0_10px_rgba(16,185,129,0.15)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>21 CFR Part 11 Audit-Ready</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono">
            <Cpu size={14} className="text-cyan-400" />
            <span>PoW Merkle Consensus</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-mono">
            <Radio size={14} className="text-cyan-400" />
            <span>MQTT Bridge :1883</span>
          </div>
        </div>
      </div>

      {/* Visual Cryptographic Pipeline Explainer */}
      <div className="rounded-2xl bg-[#080E1C]/90 border border-cyan-500/20 p-5 shadow-xl backdrop-blur-md">
        <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
          <Zap size={14} />
          End-to-End Cryptographic Security Pipeline
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Step 1 */}
          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5 relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-mono text-cyan-400 font-bold">01. Ingestion</span>
              <Radio size={14} className="text-cyan-400" />
            </div>
            <div className="text-sm font-semibold text-white">Edge Sensor Telemetry</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              ESP32 microcontrollers publish temperature, humidity, door, and sequence numbers over MQTT/TLS.
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5 relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-mono text-cyan-400 font-bold">02. Canonicalize</span>
              <FileCheck2 size={14} className="text-cyan-400" />
            </div>
            <div className="text-sm font-semibold text-white">Deterministic JSON</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Strict key sorting, invariant schema, and fixed floating-point precision prevent JSON serialization drift.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5 relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-mono text-cyan-400 font-bold">03. Hash-Chain</span>
              <Link2 size={14} className="text-cyan-400" />
            </div>
            <div className="text-sm font-semibold text-white">SHA-256 Digest</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Every packet links to <code className="text-cyan-300">prev_hash</code>. Any retroactive database edit breaks the chain immediately.
            </p>
          </div>

          {/* Step 4 */}
          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5 relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-mono text-cyan-400 font-bold">04. Batching</span>
              <Layers size={14} className="text-cyan-400" />
            </div>
            <div className="text-sm font-semibold text-white">Binary Merkle Tree</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Leaf hashes combine into root anchors, enabling lightweight O(log N) inclusion proofs for audits.
            </p>
          </div>

          {/* Step 5 */}
          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-3.5 relative flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-mono text-cyan-400 font-bold">05. Blockchain</span>
              <Cpu size={14} className="text-cyan-400" />
            </div>
            <div className="text-sm font-semibold text-white">PoW Mined Blocks</div>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Merkle roots are permanently anchored into chronological Proof-of-Work blocks with cryptographic nonces.
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Blockchain Telemetry Integrity Console */}
      <TelemetryIntegrityPanel />

      {/* Governance & Compliance Documentation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-[#080E1C]/90 border border-slate-800/80 p-5 shadow-xl">
          <div className="flex items-center gap-2.5 text-cyan-400 font-bold text-sm mb-2">
            <Shield size={18} />
            <span>Anti-Tamper & Fraud Defense</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            In traditional cold storages, database records can be secretly modified after an excursion occurs to hide product spoilage. With ColdGuard AI's cryptographic ledger, altering even 0.01°C or a single timestamp invalidates the SHA-256 digest, triggers an automated fraud alarm, and permanently fails Merkle proof verification.
          </p>
        </div>

        <div className="rounded-2xl bg-[#080E1C]/90 border border-slate-800/80 p-5 shadow-xl">
          <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-sm mb-2">
            <CheckCircle2 size={18} />
            <span>FDA & GDP Regulatory Compliance</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Meets strict FDA 21 CFR Part 11 requirements for electronic records, EU Annex 11, and WHO Good Distribution Practices (GDP). External inspectors and pharmaceutical clients can independently audit any batch without trusting central servers or accessing proprietary database internals.
          </p>
        </div>

        <div className="rounded-2xl bg-[#080E1C]/90 border border-slate-800/80 p-5 shadow-xl">
          <div className="flex items-center gap-2.5 text-purple-400 font-bold text-sm mb-2">
            <Database size={18} />
            <span>Zero MITM Ingestion Gate</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Unverified, duplicate, or out-of-order packets published across the MQTT telemetry bridge are automatically quarantined into the security rejection log. Only 100% cryptographically authenticated sensor readings enter the physics digital twin and ML predictive excursion engines.
          </p>
        </div>
      </div>
    </div>
  );
}
