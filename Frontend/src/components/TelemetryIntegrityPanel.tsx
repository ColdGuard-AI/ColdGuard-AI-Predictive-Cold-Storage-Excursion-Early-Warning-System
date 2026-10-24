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
      setActionMessage(demo.message);
      const audit = await api.auditReading(demo.reading_id);
      setAuditResult(audit);
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
    setActionMessage(null);
    try {
      const res = await api.restoreReading(tamperDemo.reading_id, tamperDemo.original_temperature);
      setActionMessage(res.message);
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
    <div className="rounded-2xl bg-white border border-[#DCE8F6] p-5 shadow-arctic-card transition-all">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#DCE8F6]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center text-[#2563EB] shadow-sm">
            <Lock size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-[#0F172A] uppercase font-mono">
                Blockchain Telemetry Integrity
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 ${
                  isChainIntact
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200 animate-pulse"
                }`}
              >
                {isChainIntact ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                {isChainIntact ? "Hash-Chain Verified" : "Tamper Alert / Anomaly"}
              </span>
            </div>
            <div className="text-xs text-[#475569] font-sans mt-0.5">
              Canonical SHA-256 payload hashing, MQTT ingestion verification, & Merkle tree ledger anchoring
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggles */}
          <div className="flex items-center bg-[#F1F7FF] p-1 rounded-xl border border-[#DCE8F6] text-xs font-mono">
            <button
              onClick={() => setViewMode("summary")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "summary"
                  ? "bg-[#2563EB] text-white font-bold shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode("stream")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "stream"
                  ? "bg-[#2563EB] text-white font-bold shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Live Hashes ({verifications.length})
            </button>
            <button
              onClick={() => setViewMode("blocks")}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === "blocks"
                  ? "bg-[#2563EB] text-white font-bold shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Blocks ({blocks.length})
            </button>
          </div>

          {/* Audit Button */}
          <button
            onClick={handleAuditLatest}
            disabled={isAuditing}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F1F7FF] border border-[#DCE8F6] text-[#2563EB] font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Cryptographically verify stored reading and Merkle proof"
          >
            <CheckCircle2 size={13} className={isAuditing ? "animate-spin" : ""} />
            <span>{isAuditing ? "Auditing..." : "Audit Telemetry"}</span>
          </button>

          {/* Simulate Tamper Attack Button */}
          <button
            onClick={handleSimulateTamper}
            disabled={isTampering}
            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-mono text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Deliberately alter stored temperature in database and demonstrate immediate cryptographic rejection"
          >
            <AlertTriangle size={13} className={isTampering ? "animate-bounce" : ""} />
            <span>{isTampering ? "Injecting Attack..." : "Simulate Tamper Attack"}</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="mt-3 p-2.5 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-xs text-[#1E40AF] font-mono flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-[#2563EB] hover:text-[#1D4ED8] ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        {/* Card 1: MQTT Status */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-[#475569] font-bold flex items-center justify-between">
            <span>MQTT Ingestion</span>
            <Radio
              size={12}
              className={mqtt?.is_connected ? "text-emerald-500 animate-pulse" : "text-[#2563EB]"}
            />
          </div>
          <div className="mt-2">
            <div className="text-xs font-bold font-mono text-[#0F172A] flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  mqtt?.is_connected ? "bg-emerald-500" : "bg-[#2563EB]"
                }`}
              />
              <span>{mqtt?.is_connected ? "Broker Connected" : "Internal Bridge"}</span>
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-0.5 truncate" title={mqtt?.topic}>
              {mqtt?.broker_host}:{mqtt?.broker_port}
            </div>
          </div>
        </div>

        {/* Card 2: Cryptographic Verifications */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-[#475569] font-bold flex items-center justify-between">
            <span>Payload Verified</span>
            <CheckCircle2 size={12} className="text-emerald-500" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold font-mono text-emerald-600 leading-none">
              {metrics?.verified_count ?? 0}
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-1">
              Of {metrics?.total_messages_received ?? 0} total packets
            </div>
          </div>
        </div>

        {/* Card 3: Rejected / Tampered */}
        <div
          className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
            (metrics?.tampered_count ?? 0) > 0 || (metrics?.duplicate_count ?? 0) > 0
              ? "bg-rose-50 border-rose-200"
              : "bg-[#F8FAFC] border-[#DCE8F6]"
          }`}
        >
          <div className="text-[10px] font-mono uppercase text-[#475569] font-bold flex items-center justify-between">
            <span>Security Rejections</span>
            <ShieldAlert
              size={12}
              className={(metrics?.tampered_count ?? 0) > 0 ? "text-rose-600" : "text-[#475569]"}
            />
          </div>
          <div className="mt-2">
            <div
              className={`text-lg font-bold font-mono leading-none ${
                (metrics?.tampered_count ?? 0) > 0 ? "text-rose-600" : "text-[#0F172A]"
              }`}
            >
              {(metrics?.tampered_count ?? 0) +
                (metrics?.duplicate_count ?? 0) +
                (metrics?.sequence_anomaly_count ?? 0)}
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-1">
              {metrics?.tampered_count ?? 0} tamp / {metrics?.duplicate_count ?? 0} dup /{" "}
              {metrics?.sequence_anomaly_count ?? 0} gap
            </div>
          </div>
        </div>

        {/* Card 4: Blockchain Blocks */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-[#475569] font-bold flex items-center justify-between">
            <span>Blockchain Blocks</span>
            <Layers size={12} className="text-[#2563EB]" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold font-mono text-[#0F172A] leading-none">
              #{metrics?.latest_block_height ?? 0}
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-1">
              {metrics?.total_blocks_anchored ?? 0} total mined blocks
            </div>
          </div>
        </div>

        {/* Card 5: Anchored Readings */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-[#475569] font-bold flex items-center justify-between">
            <span>Merkle Anchored</span>
            <Database size={12} className="text-[#38BDF8]" />
          </div>
          <div className="mt-2">
            <div className="text-lg font-bold font-mono text-[#0F172A] leading-none">
              {metrics?.anchored_count ?? 0}
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-1">
              {metrics?.pending_anchor_count ?? 0} pending buffer
            </div>
          </div>
        </div>

        {/* Card 6: Latest Merkle Root / Manual Anchor */}
        <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] flex flex-col justify-between">
          <div className="text-[10px] font-mono uppercase text-[#475569] font-bold flex items-center justify-between">
            <span>Ledger Anchor</span>
            <button
              onClick={handleManualAnchor}
              disabled={isLoading || (metrics?.pending_anchor_count ?? 0) === 0}
              className="text-[#2563EB] hover:text-[#1D4ED8] cursor-pointer disabled:opacity-30"
              title="Anchor pending batch to blockchain now"
            >
              <RefreshCw size={11} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>
          <div className="mt-2">
            <div
              className="text-xs font-mono font-bold text-[#0F172A] truncate"
              title={metrics?.latest_merkle_root || "Genesis"}
            >
              {metrics?.latest_merkle_root ? `${metrics.latest_merkle_root.slice(0, 8)}...` : "Genesis Root"}
            </div>
            <div className="text-[10px] text-[#475569] font-mono mt-1">
              Diff: {blockchain?.difficulty ?? 1} | PoW Confirmed
            </div>
          </div>
        </div>
      </div>

      {/* View Mode: SUMMARY */}
      {viewMode === "summary" && (
        <div className="mt-4 pt-4 border-t border-[#DCE8F6] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          {/* Left: Cryptographic Canonicalization Specs */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-2">
            <div className="text-xs font-bold text-[#2563EB] flex items-center gap-1.5 uppercase">
              <Hash size={13} />
              <span>SHA-256 Canonical Hashing Pipeline</span>
            </div>
            <div className="text-[#475569] text-[11px] font-sans leading-relaxed">
              Every sensor packet undergoes deterministic JSON canonicalization across key invariant fields:{" "}
              <code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded border border-[#BAE6FD]">
                temperature
              </code>
              ,{" "}
              <code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded border border-[#BAE6FD]">
                humidity
              </code>
              ,{" "}
              <code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded border border-[#BAE6FD]">
                door_state
              </code>
              ,{" "}
              <code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded border border-[#BAE6FD]">
                compressor_status
              </code>
              ,{" "}
              <code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded border border-[#BAE6FD]">
                timestamp
              </code>
              ,{" "}
              <code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded border border-[#BAE6FD]">
                device_id
              </code>
              ,{" "}
              <code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded border border-[#BAE6FD]">
                sequence_number
              </code>
              , and{" "}
              <code className="text-[#2563EB] font-mono bg-[#EFF6FF] px-1 py-0.5 rounded border border-[#BAE6FD]">
                prev_hash
              </code>
              .
            </div>
            <div className="pt-2 flex items-center justify-between text-[11px] text-[#475569] border-t border-[#DCE8F6]">
              <span>Trusted Pipeline Rule:</span>
              <span className="text-emerald-700 font-bold">Only 100% verified readings enter ML / Digital Twin</span>
            </div>
          </div>

          {/* Right: Blockchain Anchor Reference */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-2">
            <div className="text-xs font-bold text-[#2563EB] flex items-center gap-1.5 uppercase">
              <Link2 size={13} />
              <span>Local Blockchain Anchor Reference</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Current Block Height:</span>
                <span className="text-[#0F172A] font-bold">#{metrics?.latest_block_height ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Latest Block Hash:</span>
                <span className="text-[#2563EB] truncate max-w-[200px]" title={metrics?.latest_block_hash || "None"}>
                  {metrics?.latest_block_hash || "Genesis Block"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569]">Latest Merkle Root:</span>
                <span className="text-emerald-700 truncate max-w-[200px]" title={metrics?.latest_merkle_root || "None"}>
                  {metrics?.latest_merkle_root || "None"}
                </span>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between text-[11px] text-[#475569] border-t border-[#DCE8F6]">
              <span>Consensus & Ledger:</span>
              <span className="text-[#2563EB] font-semibold">
                {blockchain?.ledger_type || "Proof-of-Work Merkle Ledger"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* View Mode: STREAM */}
      {viewMode === "stream" && (
        <div className="mt-4 pt-4 border-t border-[#DCE8F6]">
          <div className="text-xs font-mono text-[#475569] mb-2 flex items-center justify-between">
            <span>Recent Ingested & Verified Telemetry Packets</span>
            <span className="text-[10px] text-[#2563EB] font-semibold">Auto-refreshing every 3s</span>
          </div>
          <div className="overflow-x-auto max-h-56 overflow-y-auto rounded-xl border border-[#DCE8F6]">
            <table className="w-full text-left text-[11px] font-mono">
              <thead className="bg-[#EFF6FF] text-[#0F172A] uppercase text-[10px] sticky top-0 border-b border-[#DCE8F6]">
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
              <tbody className="divide-y divide-[#DCE8F6]/60 bg-white">
                {verifications.map((v) => (
                  <tr key={v.id} className="hover:bg-[#F1F7FF] transition">
                    <td className="p-2 font-bold text-[#0F172A]">#{v.sequence_number}</td>
                    <td className="p-2 text-[#2563EB] font-medium">{v.device_id}</td>
                    <td className="p-2 uppercase text-[#475569]">{v.zone_id}</td>
                    <td className="p-2 text-[#0F172A]">
                      {v.current_temperature != null ? `${v.current_temperature.toFixed(1)}°C` : "-"} /{" "}
                      {v.current_humidity != null ? `${v.current_humidity.toFixed(0)}%` : "-"}
                    </td>
                    <td className="p-2 text-[#475569] truncate max-w-[120px]" title={v.payload_hash}>
                      {v.payload_hash.slice(0, 12)}...
                    </td>
                    <td className="p-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          v.verification_status === "verified"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : v.verification_status === "tampered"
                            ? "bg-rose-50 text-rose-800 border border-rose-200 animate-pulse"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {v.verification_status}
                      </span>
                    </td>
                    <td className="p-2">
                      <span
                        className={`text-[10px] ${
                          v.anchor_status === "anchored" ? "text-[#2563EB] font-bold" : "text-[#475569]"
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
                          className="px-2 py-0.5 rounded bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#2563EB] border border-[#BAE6FD] text-[10px] font-bold cursor-pointer transition"
                        >
                          Verify
                        </button>
                      ) : (
                        <span className="text-[#475569]">-</span>
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
        <div className="mt-4 pt-4 border-t border-[#DCE8F6]">
          <div className="text-xs font-mono text-[#475569] mb-2 flex items-center justify-between">
            <span>Confirmed Blockchain Blocks & Merkle Roots</span>
            <span className="text-[10px] text-[#2563EB] font-semibold">Total: {blocks.length}</span>
          </div>
          <div className="space-y-2">
            {blocks.map((b) => (
              <div
                key={b.block_height}
                className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] flex flex-wrap items-center justify-between gap-3 text-xs font-mono hover:bg-[#F1F7FF] transition"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center font-bold">
                    #{b.block_height}
                  </div>
                  <div>
                    <div className="text-[#0F172A] font-bold flex items-center gap-2">
                      <span>Hash: {b.block_hash.slice(0, 16)}...</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {b.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#475569] truncate max-w-sm mt-0.5">
                      Merkle Root: <span className="text-[#2563EB] font-semibold">{b.merkle_root}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-[#475569]">
                  <div>
                    Txs: <span className="text-[#0F172A] font-bold">{b.tx_count}</span> | Nonce: {b.nonce}
                  </div>
                  <div className="text-[10px] text-[#475569] mt-0.5">{b.timestamp}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cryptographic Audit Inspection Modal */}
      {showDetailModal && auditResult && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    auditResult.tamper_detected
                      ? "bg-rose-50 text-rose-600 border border-rose-200"
                      : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                  }`}
                >
                  {auditResult.tamper_detected ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A] font-mono flex items-center gap-2">
                    <span>Cryptographic Telemetry Audit</span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full uppercase font-bold ${
                        auditResult.tamper_detected
                          ? "bg-rose-50 text-rose-800 border border-rose-200"
                          : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      }`}
                    >
                      {auditResult.tamper_detected ? "TAMPER DETECTED" : "VERIFIED AUTHENTIC"}
                    </span>
                  </h3>
                  <div className="text-xs text-[#475569] font-sans">
                    Reading ID #{auditResult.reading_id} • Audited at {auditResult.audit_timestamp}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setTamperDemo(null);
                }}
                className="text-[#475569] hover:text-[#0F172A] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tamper Alert Callout if tampered */}
            {auditResult.tamper_detected && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-mono space-y-2">
                <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                  <AlertTriangle size={16} />
                  <span>ALERT: Cryptographic Hash Mismatch Detected!</span>
                </div>
                <div className="leading-relaxed">
                  The physical database reading does not match its immutable SHA-256 digital signature recorded upon
                  gateway entry. This altered packet is strictly quarantine-blocked from entering the trusted ML
                  forecasting and Digital Twin analytics pipeline.
                </div>
                {tamperDemo && (
                  <div className="pt-2 border-t border-rose-200 flex items-center justify-between flex-wrap gap-2">
                    <span>
                      Original: {tamperDemo.original_temperature}°C → Tampered: {tamperDemo.tampered_temperature}°C
                    </span>
                    <button
                      onClick={handleRestoreTamper}
                      disabled={isLoading}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
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
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-1.5 text-xs font-mono">
                <div className="text-[#475569] font-bold uppercase text-[10px]">Database Reading Record:</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    <span className="text-[#475569]">Zone:</span>{" "}
                    <span className="text-[#0F172A] font-bold">{auditResult.current_reading.zone_id}</span>
                  </div>
                  <div>
                    <span className="text-[#475569]">Sensor:</span>{" "}
                    <span className="text-[#2563EB] font-bold">{auditResult.current_reading.sensor_id}</span>
                  </div>
                  <div>
                    <span className="text-[#475569]">Temp:</span>{" "}
                    <span
                      className={
                        auditResult.tamper_detected ? "text-rose-600 font-bold" : "text-emerald-700 font-bold"
                      }
                    >
                      {auditResult.current_reading.temperature}°C
                    </span>
                  </div>
                  <div>
                    <span className="text-[#475569]">Humidity:</span>{" "}
                    <span className="text-[#0F172A] font-bold">{auditResult.current_reading.humidity}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cryptographic Comparison */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-3 text-xs font-mono">
              <div className="text-[#475569] font-bold uppercase text-[10px]">Cryptographic Proof Comparison:</div>

              <div className="space-y-1">
                <div className="text-[#475569] text-[11px]">Recorded Telemetry Hash (upon entry):</div>
                <div className="p-2 rounded bg-white text-[#2563EB] text-[11px] break-all border border-[#DCE8F6] font-mono">
                  {auditResult.cryptographic_audit.stored_hash}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-[#475569] text-[11px]">Recomputed Hash from Current DB Content:</div>
                <div
                  className={`p-2 rounded text-[11px] break-all border font-mono ${
                    auditResult.cryptographic_audit.hash_match
                      ? "bg-white text-emerald-700 border-emerald-300"
                      : "bg-rose-50 text-rose-800 border-rose-300"
                  }`}
                >
                  {auditResult.cryptographic_audit.recomputed_hash}
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-[#475569]">Hash Match Verification:</span>
                <span
                  className={`font-bold ${
                    auditResult.cryptographic_audit.hash_match ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {auditResult.cryptographic_audit.hash_match
                    ? "MATCH CONFIRMED (100% Authentic)"
                    : "MISMATCH (Altered Data)"}
                </span>
              </div>
            </div>

            {/* Blockchain Anchoring Status */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-2 text-xs font-mono">
              <div className="text-[#475569] font-bold uppercase text-[10px]">Blockchain Ledger Audit:</div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-[#475569]">Anchor Status:</span>{" "}
                  <span className="text-[#0F172A] font-bold">{auditResult.blockchain_audit.anchor_status}</span>
                </div>
                <div>
                  <span className="text-[#475569]">Block Height:</span>{" "}
                  <span className="text-[#2563EB] font-bold">
                    {auditResult.blockchain_audit.block_height != null
                      ? `#${auditResult.blockchain_audit.block_height}`
                      : "Unanchored"}
                  </span>
                </div>
                <div className="col-span-2 truncate">
                  <span className="text-[#475569]">Merkle Root:</span>{" "}
                  <span className="text-[#0F172A]">{auditResult.blockchain_audit.merkle_root || "Pending Batch"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[#475569]">Merkle Proof Path:</span>{" "}
                  <span className="text-emerald-700 font-bold">
                    {auditResult.blockchain_audit.merkle_proof_valid
                      ? `Valid Merkle Proof (${auditResult.blockchain_audit.proof_steps_count} steps)`
                      : "Awaiting next batch anchor"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#DCE8F6]">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setTamperDemo(null);
                }}
                className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs cursor-pointer shadow-sm"
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
