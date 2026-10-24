import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Radio,
  Hash,
  Database,
  Link2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Layers,
  ArrowRight,
  Zap,
  Info,
  X,
  RotateCcw,
  Cpu,
} from "lucide-react";
import { api } from "../services/api";
import type {
  IntegrityStatusResponse,
  VerificationRecord,
  AuditReadingResponse,
  TamperDemoResponse,
  BlockchainBlockItem,
} from "../types/api";

export function TelemetryIntegrityPanel() {
  const [status, setStatus] = useState<IntegrityStatusResponse | null>(null);
  const [verifications, setVerifications] = useState<VerificationRecord[]>([]);
  const [blocks, setBlocks] = useState<BlockchainBlockItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isTampering, setIsTampering] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditReadingResponse | null>(null);
  const [tamperDemo, setTamperDemo] = useState<TamperDemoResponse | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewMode, setViewMode] = useState<"summary" | "stream" | "blocks">("summary");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statusRes, verifsRes, blocksRes] = await Promise.all([
        api.integrityStatus(),
        api.integrityVerifications(15),
        api.blockchainBlocks(5),
      ]);
      setStatus(statusRes);
      setVerifications(verifsRes);
      setBlocks(blocksRes);
    } catch (err) {
      console.error("Failed to load telemetry integrity data", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleManualAnchor = async () => {
    setIsLoading(true);
    setActionMessage(null);
    try {
      const res = await api.anchorBatch();
      setActionMessage(res.message || "Batch successfully anchored to blockchain ledger!");
      await fetchData();
    } catch (err: any) {
      setActionMessage("Anchor failed: " + (err.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuditLatest = async () => {
    if (!verifications.length) return;
    const target = verifications.find((v) => v.reading_id != null) || verifications[0];
    if (!target.reading_id) return;

    setIsAuditing(true);
    setActionMessage(null);
    try {
      const audit = await api.auditReading(target.reading_id);
      setAuditResult(audit);
      setShowDetailModal(true);
    } catch (err: any) {
      setActionMessage("Audit failed: " + (err.message || String(err)));
    } finally {
      setIsAuditing(false);
    }
  };

  const handleSimulateTamper = async () => {
    setIsTampering(true);
    setActionMessage(null);
    try {
      const demo = await api.demonstrateTamper();
      setTamperDemo(demo);
      setAuditResult(demo.audit_result);
      setShowDetailModal(true);
      await fetchData();
    } catch (err: any) {
      setActionMessage("Tamper simulation failed: " + (err.message || String(err)));
    } finally {
      setIsTampering(false);
    }
  };

  const handleRestoreTamper = async () => {
    if (!tamperDemo) return;
    setIsLoading(true);
    try {
      await api.restoreReading(tamperDemo.reading_id, tamperDemo.original_temperature);
      setActionMessage(`Restored reading #${tamperDemo.reading_id} to authentic ${tamperDemo.original_temperature}°C.`);
      // Re-run audit to show it is verified again
      const refreshedAudit = await api.auditReading(tamperDemo.reading_id);
      setAuditResult(refreshedAudit);
      setTamperDemo(null);
      await fetchData();
    } catch (err: any) {
      setActionMessage("Restore failed: " + (err.message || String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  const metrics = status?.metrics;
  const mqtt = status?.mqtt;
  const blockchain = status?.blockchain;
  const isChainIntact = metrics?.hash_chain_status === "intact" && (metrics?.tampered_count ?? 0) === 0;

  return (
    <div className="rounded-2xl bg-[#080E1C]/95 border border-cyan-500/30 p-5 shadow-2xl backdrop-blur-xl transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <Lock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white uppercase font-mono">
                Blockchain Telemetry Integrity
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isChainIntact
                    ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/40"
                    : "bg-rose-950/80 text-rose-400 border border-rose-500/40 animate-pulse"
                }`}
              >
                {isChainIntact ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                {isChainIntact ? "Hash-Chain Verified" : "Tamper Alert / Anomaly"}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-sans mt-0.5">
              Canonical SHA-256 payload hashing, MQTT ingestion verification, & Merkle tree ledger anchoring
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggles */}
          <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setViewMode("summary")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "summary" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode("stream")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "stream" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Live Hashes ({verifications.length})
            </button>
            <button
              onClick={() => setViewMode("blocks")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "blocks" ? "bg-cyan-600 text-white font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              Blocks ({blocks.length})
            </button>
          </div>

          {/* Audit Button */}
          <button
            onClick={handleAuditLatest}
            disabled={isAuditing}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Cryptographically verify stored reading and Merkle proof"
          >
            <CheckCircle2 size={13} className={isAuditing ? "animate-spin" : ""} />
            <span>{isAuditing ? "Auditing..." : "Audit Telemetry"}</span>
          </button>

          {/* Simulate Tamper Attack Button */}
          <button
            onClick={handleSimulateTamper}
            disabled={isTampering}
            className="px-3 py-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/50 text-rose-300 font-mono text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Deliberately alter stored temperature in database and demonstrate immediate cryptographic rejection"
          >
            <AlertTriangle size={13} className={isTampering ? "animate-bounce" : ""} />
            <span>{isTampering ? "Injecting Attack..." : "Simulate Tamper Attack"}</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="mt-3 p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 font-mono flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-cyan-400 hover:text-white ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        {/* Card 1: MQTT Status */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>MQTT Ingestion</span>
            <Radio
              size={12}
              className={mqtt?.is_connected ? "text-emerald-400 animate-pulse" : "text-cyan-400"}
            />
          </div>
          <div className="mt-2">
            <div className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  mqtt?.is_connected ? "bg-emerald-400" : "bg-cyan-400"
                }`}
              />
              <span>{mqtt?.is_connected ? "Broker Connected" : "Internal Bridge"}</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate" title={mqtt?.topic}>
              {mqtt?.broker_host}:{mqtt?.broker_port}
            </div>
          </div>
        </div>

        {/* Card 2: Cryptographic Verifications */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Payload Verified</span>
            <CheckCircle2 size={12} className="text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold font-mono text-emerald-400 leading-none">
              {metrics?.verified_count ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              Of {metrics?.total_messages_received ?? 0} total packets
            </div>
          </div>
        </div>

        {/* Card 3: Rejected / Tampered */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
            (metrics?.tampered_count ?? 0) > 0 || (metrics?.duplicate_count ?? 0) > 0
              ? "bg-rose-950/30 border-rose-500/40"
              : "bg-slate-950/60 border-slate-800/80"
          }`}
        >
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Security Rejections</span>
            <ShieldAlert
              size={12}
              className={(metrics?.tampered_count ?? 0) > 0 ? "text-rose-400" : "text-slate-500"}
            />
          </div>
          <div className="mt-2">
            <div
              className={`text-lg font-bold font-mono leading-none ${
                (metrics?.tampered_count ?? 0) > 0 ? "text-rose-400" : "text-slate-400"
              }`}
            >
              {(metrics?.tampered_count ?? 0) + (metrics?.duplicate_count ?? 0) + (metrics?.sequence_anomaly_count ?? 0)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              {metrics?.tampered_count ?? 0} tamp / {metrics?.duplicate_count ?? 0} dup / {metrics?.sequence_anomaly_count ?? 0} gap
            </div>
          </div>
        </div>

        {/* Card 4: Blockchain Anchors */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Blockchain Blocks</span>
            <Layers size={12} className="text-cyan-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold font-mono text-cyan-300 leading-none">
              #{metrics?.latest_block_height ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              {metrics?.total_blocks_anchored ?? 0} total mined blocks
            </div>
          </div>
        </div>

        {/* Card 5: Anchored Readings */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Merkle Anchored</span>
            <Database size={12} className="text-indigo-400" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold font-mono text-indigo-300 leading-none">
              {metrics?.anchored_count ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              {metrics?.pending_anchor_count ?? 0} pending buffer
            </div>
          </div>
        </div>

        {/* Card 6: Latest Merkle Root / Manual Anchor */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-slate-400 font-bold flex items-center justify-between">
            <span>Ledger Anchor</span>
            <button
              onClick={handleManualAnchor}
              disabled={isLoading || (metrics?.pending_anchor_count ?? 0) === 0}
              className="text-cyan-400 hover:text-cyan-200 cursor-pointer disabled:opacity-30"
              title="Anchor pending batch to blockchain now"
            >
              <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="mt-2">
            <div className="text-xs font-mono font-bold text-white truncate" title={metrics?.latest_merkle_root || "Genesis"}>
              {metrics?.latest_merkle_root ? `${metrics.latest_merkle_root.slice(0, 8)}...` : "Genesis Root"}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-1">
              Diff: {blockchain?.difficulty ?? 1} | PoW Confirmed
            </div>
          </div>
        </div>
      </div>

      {/* View Mode: SUMMARY */}
      {viewMode === "summary" && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Left: Cryptographic Canonicalization Specs */}
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/90 space-y-2">
            <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase">
              <Hash size={13} />
              <span>SHA-256 Canonical Hashing Pipeline</span>
            </div>
            <div className="text-slate-300 text-[11px] font-sans leading-relaxed">
              Every sensor packet undergoes deterministic JSON canonicalization across key invariant fields:{" "}
              <code className="text-cyan-300 font-mono bg-slate-950 px-1 py-0.5 rounded">temperature</code>,{" "}
              <code className="text-cyan-300 font-mono bg-slate-950 px-1 py-0.5 rounded">humidity</code>,{" "}
              <code className="text-cyan-300 font-mono bg-slate-950 px-1 py-0.5 rounded">door_state</code>,{" "}
              <code className="text-cyan-300 font-mono bg-slate-950 px-1 py-0.5 rounded">compressor_status</code>,{" "}
              <code className="text-cyan-300 font-mono bg-slate-950 px-1 py-0.5 rounded">timestamp</code>,{" "}
              <code className="text-cyan-300 font-mono bg-slate-950 px-1 py-0.5 rounded">device_id</code>,{" "}
              <code className="text-cyan-300 font-mono bg-slate-950 px-1 py-0.5 rounded">sequence_number</code>, and{" "}
              <code className="text-cyan-300 font-mono bg-slate-950 px-1 py-0.5 rounded">prev_hash</code>.
            </div>
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
              <span>Trusted Pipeline Rule:</span>
              <span className="text-emerald-400 font-bold">Only 100% verified readings enter ML / Digital Twin</span>
            </div>
          </div>

          {/* Right: Blockchain Anchor Reference */}
          <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/90 space-y-2">
            <div className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase">
              <Link2 size={13} />
              <span>Local Blockchain Anchor Reference</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Current Block Height:</span>
                <span className="text-white font-bold">#{metrics?.latest_block_height ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Latest Block Hash:</span>
                <span className="text-cyan-300 truncate max-w-[200px]" title={metrics?.latest_block_hash || "None"}>
                  {metrics?.latest_block_hash || "Genesis Block"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Latest Merkle Root:</span>
                <span className="text-emerald-400 truncate max-w-[200px]" title={metrics?.latest_merkle_root || "None"}>
                  {metrics?.latest_merkle_root || "None"}
                </span>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
              <span>Consensus & Ledger:</span>
              <span className="text-cyan-300 font-semibold">{blockchain?.ledger_type || "Proof-of-Work Merkle Ledger"}</span>
            </div>
          </div>
        </div>
      )}

      {/* View Mode: STREAM */}
      {viewMode === "stream" && (
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="text-xs font-mono text-slate-400 mb-2 flex items-center justify-between">
            <span>Recent Ingested & Verified Telemetry Packets</span>
            <span className="text-[10px] text-cyan-400">Auto-refreshing every 3s</span>
          </div>
          <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-[11px] font-mono">
              <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="p-2">Seq</th>
                  <th className="p-2">Device</th>
                  <th className="p-2">Zone</th>
                  <th className="p-2">Temp / Hum</th>
                  <th className="p-2">SHA-256 Hash</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Anchor</th>
                  <th className="p-2 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                {verifications.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-900/40">
                    <td className="p-2 font-bold text-white">#{v.sequence_number}</td>
                    <td className="p-2 text-cyan-300">{v.device_id}</td>
                    <td className="p-2 uppercase text-slate-400">{v.zone_id}</td>
                    <td className="p-2 text-slate-200">
                      {v.current_temperature != null ? `${v.current_temperature.toFixed(1)}°C` : "-"} /{" "}
                      {v.current_humidity != null ? `${v.current_humidity.toFixed(0)}%` : "-"}
                    </td>
                    <td className="p-2 text-slate-400 truncate max-w-[120px]" title={v.payload_hash}>
                      {v.payload_hash.slice(0, 12)}...
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          v.verification_status === "verified"
                            ? "bg-emerald-950/80 text-emerald-400 border border-emerald-500/30"
                            : v.verification_status === "tampered"
                            ? "bg-rose-950/80 text-rose-400 border border-rose-500/30 animate-pulse"
                            : "bg-amber-950/80 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {v.verification_status}
                      </span>
                    </td>
                    <td className="p-2">
                      <span
                        className={`text-[10px] ${
                          v.anchor_status === "anchored" ? "text-cyan-400 font-bold" : "text-slate-500"
                        }`}
                      >
                        {v.anchor_status === "anchored" ? `Block #${v.block_height}` : "Pending"}
                      </span>
                    </td>
                    <td className="p-2 text-right">
                      {v.reading_id ? (
                        <button
                          onClick={async () => {
                            try {
                              const audit = await api.auditReading(v.reading_id!);
                              setAuditResult(audit);
                              setShowDetailModal(true);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] cursor-pointer"
                        >
                          Verify
                        </button>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Mode: BLOCKS */}
      {viewMode === "blocks" && (
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <div className="text-xs font-mono text-slate-400 mb-2 flex items-center justify-between">
            <span>Confirmed Blockchain Blocks & Merkle Roots</span>
            <span className="text-[10px] text-cyan-400">Total: {blocks.length}</span>
          </div>
          <div className="space-y-2">
            {blocks.map((b) => (
              <div
                key={b.block_height}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-bold">
                    #{b.block_height}
                  </div>
                  <div>
                    <div className="text-white font-bold flex items-center gap-2">
                      <span>Hash: {b.block_hash.slice(0, 16)}...</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                        {b.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-sm mt-0.5">
                      Merkle Root: <span className="text-cyan-300">{b.merkle_root}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400">
                  <div>Txs: <span className="text-white font-bold">{b.tx_count}</span> | Nonce: {b.nonce}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{b.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cryptographic Audit Inspection Modal */}
      {showDetailModal && auditResult && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#090F1E] border border-cyan-500/40 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    auditResult.tamper_detected
                      ? "bg-rose-950 text-rose-400 border border-rose-500/50"
                      : "bg-emerald-950 text-emerald-400 border border-emerald-500/50"
                  }`}
                >
                  {auditResult.tamper_detected ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <span>Cryptographic Telemetry Audit</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full uppercase ${
                        auditResult.tamper_detected
                          ? "bg-rose-900/60 text-rose-300 border border-rose-500"
                          : "bg-emerald-900/60 text-emerald-300 border border-emerald-500"
                      }`}
                    >
                      {auditResult.tamper_detected ? "TAMPER DETECTED" : "VERIFIED AUTHENTIC"}
                    </span>
                  </h3>
                  <div className="text-xs text-slate-400 font-sans">
                    Reading ID #{auditResult.reading_id} • Audited at {auditResult.audit_timestamp}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setTamperDemo(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tamper Alert Callout if tampered */}
            {auditResult.tamper_detected && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/60 text-rose-200 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-300 text-sm">
                  <AlertTriangle size={16} />
                  <span>ALERT: Cryptographic Hash Mismatch Detected!</span>
                </div>
                <div>
                  The physical database reading does not match its immutable SHA-256 digital signature recorded upon
                  gateway entry. This altered packet is strictly quarantine-blocked from entering the trusted ML
                  forecasting and Digital Twin analytics pipeline.
                </div>
                {tamperDemo && (
                  <div className="pt-2 border-t border-rose-800/40 flex items-center justify-between">
                    <span>Original: {tamperDemo.original_temperature}°C → Tampered: {tamperDemo.tampered_temperature}°C</span>
                    <button
                      onClick={handleRestoreTamper}
                      disabled={isLoading}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw size={12} />
                      <span>Restore Original Reading</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Current Reading Details */}
            {auditResult.current_reading && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="text-slate-400 font-bold uppercase text-[10px]">Database Reading Record:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Zone:</span> <span className="text-white font-bold">{auditResult.current_reading.zone_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Sensor:</span> <span className="text-cyan-300">{auditResult.current_reading.sensor_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Temp:</span>{" "}
                    <span className={auditResult.tamper_detected ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                      {auditResult.current_reading.temperature}°C
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Humidity:</span> <span className="text-white">{auditResult.current_reading.humidity}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cryptographic Comparison */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs font-mono">
              <div className="text-slate-400 font-bold uppercase text-[10px]">Cryptographic Proof Comparison:</div>

              <div className="space-y-1">
                <div className="text-slate-400 text-[11px]">Recorded Telemetry Hash (upon entry):</div>
                <div className="p-2 rounded bg-slate-950 text-cyan-300 text-[11px] break-all border border-slate-800">
                  {auditResult.cryptographic_audit.stored_hash}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-400 text-[11px]">Recomputed Hash from Current DB Content:</div>
                <div
                  className={`p-2 rounded text-[11px] break-all border ${
                    auditResult.cryptographic_audit.hash_match
                      ? "bg-slate-950 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-950/60 text-rose-300 border-rose-500"
                  }`}
                >
                  {auditResult.cryptographic_audit.recomputed_hash}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-slate-400">Hash Match Verification:</span>
                <span
                  className={`font-bold ${
                    auditResult.cryptographic_audit.hash_match ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {auditResult.cryptographic_audit.hash_match ? "MATCH CONFIRMED (100% Authentic)" : "MISMATCH (Altered Data)"}
                </span>
              </div>
            </div>

            {/* Blockchain Anchoring Status */}
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs font-mono">
              <div className="text-slate-400 font-bold uppercase text-[10px]">Blockchain Ledger Audit:</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500">Anchor Status:</span>{" "}
                  <span className="text-white font-bold">{auditResult.blockchain_audit.anchor_status}</span>
                </div>
                <div>
                  <span className="text-slate-500">Block Height:</span>{" "}
                  <span className="text-cyan-300">
                    {auditResult.blockchain_audit.block_height != null
                      ? `#${auditResult.blockchain_audit.block_height}`
                      : "Unanchored"}
                  </span>
                </div>
                <div className="col-span-2 truncate">
                  <span className="text-slate-500">Merkle Root:</span>{" "}
                  <span className="text-slate-300">{auditResult.blockchain_audit.merkle_root || "Pending Batch"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Merkle Proof Path:</span>{" "}
                  <span className="text-emerald-400 font-bold">
                    {auditResult.blockchain_audit.merkle_proof_valid
                      ? `Valid Merkle Proof (${auditResult.blockchain_audit.proof_steps_count} steps)`
                      : "Awaiting next batch anchor"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setTamperDemo(null);
                }}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
