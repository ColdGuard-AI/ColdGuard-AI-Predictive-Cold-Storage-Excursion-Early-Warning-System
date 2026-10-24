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
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center text-[#2563EB] shadow-sm">
              <ShieldCheck size={22} className="animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] flex items-center gap-2">
                Blockchain Telemetry Integrity
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] font-semibold uppercase tracking-wider">
                  Cryptographic Ledger
                </span>
              </h1>
              <p className="text-xs text-[#475569] mt-0.5 font-medium">
                End-to-end telemetry provenance: deterministic SHA-256 canonicalization, hash-chain verification, Merkle tree batching, and Proof-of-Work blockchain anchoring.
              </p>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono font-medium shadow-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>21 CFR Part 11 Audit-Ready</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] text-[#2563EB] text-xs font-mono font-semibold shadow-arctic-card">
            <Cpu size={14} className="text-[#2563EB]" />
            <span>PoW Merkle Consensus</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] text-[#475569] text-xs font-mono shadow-arctic-card">
            <Radio size={14} className="text-[#38BDF8]" />
            <span>MQTT Bridge :1883</span>
          </div>
        </div>
      </div>

      {/* Visual Cryptographic Pipeline Explainer */}
      <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card">
        <div className="text-xs font-bold text-[#2563EB] uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
          <Zap size={14} />
          End-to-End Cryptographic Security Pipeline
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {/* Step 1 */}
          <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3.5 relative flex flex-col justify-between hover:border-[#38BDF8] transition">
            <div className="flex items-center justify-between text-xs text-[#475569] mb-1">
              <span className="font-mono text-[#2563EB] font-bold">01. Ingestion</span>
              <Radio size={14} className="text-[#2563EB]" />
            </div>
            <div className="text-sm font-semibold text-[#0F172A]">Edge Sensor Telemetry</div>
            <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
              ESP32 microcontrollers publish temperature, humidity, door, and sequence numbers over MQTT/TLS.
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3.5 relative flex flex-col justify-between hover:border-[#38BDF8] transition">
            <div className="flex items-center justify-between text-xs text-[#475569] mb-1">
              <span className="font-mono text-[#2563EB] font-bold">02. Canonicalize</span>
              <FileCheck2 size={14} className="text-[#2563EB]" />
            </div>
            <div className="text-sm font-semibold text-[#0F172A]">Deterministic JSON</div>
            <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
              Strict key sorting, invariant schema, and fixed floating-point precision prevent JSON serialization drift.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3.5 relative flex flex-col justify-between hover:border-[#38BDF8] transition">
            <div className="flex items-center justify-between text-xs text-[#475569] mb-1">
              <span className="font-mono text-[#2563EB] font-bold">03. Hash-Chain</span>
              <Link2 size={14} className="text-[#2563EB]" />
            </div>
            <div className="text-sm font-semibold text-[#0F172A]">SHA-256 Digest</div>
            <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
              Every packet links to <code className="text-[#2563EB] font-semibold">prev_hash</code>. Any retroactive database edit breaks the chain immediately.
            </p>
          </div>

          {/* Step 4 */}
          <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3.5 relative flex flex-col justify-between hover:border-[#38BDF8] transition">
            <div className="flex items-center justify-between text-xs text-[#475569] mb-1">
              <span className="font-mono text-[#2563EB] font-bold">04. Batching</span>
              <Layers size={14} className="text-[#2563EB]" />
            </div>
            <div className="text-sm font-semibold text-[#0F172A]">Binary Merkle Tree</div>
            <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
              Leaf hashes combine into root anchors, enabling lightweight O(log N) inclusion proofs for audits.
            </p>
          </div>

          {/* Step 5 */}
          <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3.5 relative flex flex-col justify-between hover:border-[#38BDF8] transition">
            <div className="flex items-center justify-between text-xs text-[#475569] mb-1">
              <span className="font-mono text-[#2563EB] font-bold">05. Blockchain</span>
              <Cpu size={14} className="text-[#2563EB]" />
            </div>
            <div className="text-sm font-semibold text-[#0F172A]">PoW Mined Blocks</div>
            <p className="text-[11px] text-[#475569] mt-1 leading-relaxed">
              Merkle roots are permanently anchored into chronological Proof-of-Work blocks with cryptographic nonces.
            </p>
          </div>
        </div>
      </div>

      {/* Main Interactive Blockchain Telemetry Integrity Console */}
      <TelemetryIntegrityPanel />

      {/* Governance & Compliance Documentation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card hover:shadow-arctic-hover transition">
          <div className="flex items-center gap-2.5 text-[#2563EB] font-bold text-sm mb-2">
            <Shield size={18} />
            <span>Anti-Tamper & Fraud Defense</span>
          </div>
          <p className="text-xs text-[#475569] leading-relaxed">
            In traditional cold storages, database records can be secretly modified after an excursion occurs to hide product spoilage. With ColdGuard AI's cryptographic ledger, altering even 0.01°C or a single timestamp invalidates the SHA-256 digest, triggers an automated fraud alarm, and permanently fails Merkle proof verification.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card hover:shadow-arctic-hover transition">
          <div className="flex items-center gap-2.5 text-emerald-700 font-bold text-sm mb-2">
            <CheckCircle2 size={18} />
            <span>FDA & GDP Regulatory Compliance</span>
          </div>
          <p className="text-xs text-[#475569] leading-relaxed">
            Meets strict FDA 21 CFR Part 11 requirements for electronic records, EU Annex 11, and WHO Good Distribution Practices (GDP). External inspectors and pharmaceutical clients can independently audit any batch without trusting central servers or accessing proprietary database internals.
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card hover:shadow-arctic-hover transition">
          <div className="flex items-center gap-2.5 text-[#2563EB] font-bold text-sm mb-2">
            <Database size={18} />
            <span>Zero MITM Ingestion Gate</span>
          </div>
          <p className="text-xs text-[#475569] leading-relaxed">
            Unverified, duplicate, or out-of-order packets published across the MQTT telemetry bridge are automatically quarantined into the security rejection log. Only 100% cryptographically authenticated sensor readings enter the physics digital twin and ML predictive excursion engines.
          </p>
        </div>
      </div>
    </div>
  );
}
