/* ─────────────────────────────────────────────────────────────────────────────
   Government / Quality Auditor — Compliance Overview (Arctic Blue Design System)
   Intuitive, plain-English regulatory dashboard with instant Pass/Fail clarity
───────────────────────────────────────────────────────────────────────────── */
import { useEffect, useState, useMemo } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  XCircle,
  AlertTriangle,
  FileCheck2,
  Lock,
  Layers,
  Thermometer,
  Cpu,
  Info,
  X,
  ExternalLink,
  Filter,
  HelpCircle,
  Check,
  RotateCcw,
} from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";
import { fmtTemp } from "../../lib/format";

export default function AuditorCompliance() {
  const { zones, zonesLoading } = useApp();
  const [integrity, setIntegrity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRestoring, setIsRestoring] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedZoneModal, setSelectedZoneModal] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [showExplainer, setShowExplainer] = useState<boolean>(true);

  async function handleRestoreTamper() {
    setIsRestoring(true);
    try {
      await api.restoreReading();
      await load();
    } finally {
      setIsRestoring(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const integ = await api.integrityStatus().catch(() => null);
      setIntegrity(integ);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  // Map accurate properties from backend integrity API
  const metrics = integrity?.metrics || integrity?.stats || {};
  const blockchain = integrity?.blockchain || {};
  const totalReadings = metrics.total_messages_received ?? 0;
  const verifiedCount = metrics.verified_count ?? 0;
  const tamperedCount = metrics.tampered_count ?? 0;
  const totalBlocks = blockchain.total_blocks ?? metrics.total_blocks_anchored ?? 0;
  const isChainIntact = blockchain.chain_valid ?? (metrics.hash_chain_status === "intact");
  const verifiedPct = totalReadings > 0 ? Math.round((verifiedCount / totalReadings) * 100) : 100;

  const excursionZones = zones?.filter((z: any) => (z.risk_score ?? 0) >= 60 || z.temperature_status === "critical") ?? [];
  const allNominal = excursionZones.length === 0;

  // Filtered zones list
  const filteredZones = useMemo(() => {
    if (!zones) return [];
    if (statusFilter === "compliant") {
      return zones.filter((z) => (z.risk_score ?? 0) < 40 && z.temperature_status !== "critical");
    }
    if (statusFilter === "flagged") {
      return zones.filter((z) => (z.risk_score ?? 0) >= 40 || z.temperature_status === "critical");
    }
    return zones;
  }, [zones, statusFilter]);

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* 1. Header with Plain-English Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center text-[#2563EB] shadow-sm">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-2.5">
                <span>Government Auditor Inspection Portal</span>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800">
                  Official Audit
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-[#475569] mt-0.5 font-medium">
                Independent regulatory inspection: cold chain health, temperature compliance, and anti-tamper verification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#475569] cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-[#DCE8F6] text-[#2563EB] focus:ring-[#2563EB]"
            />
            <span>Auto-Refresh (5s)</span>
          </label>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white px-3.5 py-2 text-xs font-bold text-[#0F172A] hover:bg-[#F1F7FF] transition shadow-arctic-card cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#2563EB]" : "text-[#2563EB]"} />
            <span>Refresh Audit</span>
          </button>
        </div>
      </div>

      {/* 2. Plain-English "Auditor 3-Point Verdict" Card */}
      <div className="rounded-2xl border-2 border-[#BAE6FD] bg-gradient-to-r from-[#EFF6FF] via-white to-[#F0FDF4] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <span
              className={`text-sm sm:text-base font-extrabold px-3 py-1 rounded-xl shadow-sm uppercase tracking-wide flex items-center gap-1.5 ${
                allNominal && isChainIntact
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-600 text-white"
              }`}
            >
              {allNominal && isChainIntact ? "✓ GRADE A : FULLY COMPLIANT" : "⚠️ AUDIT ACTION REQUIRED"}
            </span>
            <span className="text-xs font-bold text-[#475569]">
              Evaluated: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={() => setShowExplainer(!showExplainer)}
            className="text-xs text-[#2563EB] hover:underline font-bold flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle size={14} />
            <span>{showExplainer ? "Hide Guidance Guide" : "How to read this audit?"}</span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#0F172A] font-medium leading-relaxed mb-4">
          {allNominal && isChainIntact
            ? "Facility passes all regulatory health standards. All cold storage rooms are currently within safe temperature limits, and all digital records are cryptographically sealed with zero signs of alteration or fraud."
            : "One or more cold storage chambers require review. Either a chamber is warming up towards its allowable limit or an alert has been flagged for technician inspection."}
        </p>

        {/* 3 Quick Checks in Plain Words */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white border border-[#DCE8F6] shadow-sm flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#0F172A]">1. Room Temperatures</div>
              <div className="text-[11px] text-[#475569] mt-0.5">
                {allNominal ? "All rooms inside safe bands" : `${excursionZones.length} room(s) near threshold`}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#DCE8F6] shadow-sm flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#0F172A]">2. Data Honesty (Anti-Tamper)</div>
              <div className="text-[11px] text-[#475569] mt-0.5">
                {tamperedCount === 0 ? "0 altered records (100% genuine)" : `${tamperedCount} altered records caught!`}
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white border border-[#DCE8F6] shadow-sm flex items-start gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-bold text-[#0F172A]">3. Sensor Continuity</div>
              <div className="text-[11px] text-[#475569] mt-0.5">
                {verifiedCount.toLocaleString()} continuous sensor checks verified
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explainer Box for Inspectors */}
      {showExplainer && (
        <div className="rounded-2xl bg-white border border-[#BAE6FD] p-5 shadow-sm text-xs text-[#0F172A] relative">
          <button
            onClick={() => setShowExplainer(false)}
            className="absolute right-3.5 top-3.5 text-[#475569] hover:text-[#0F172A] p-1 cursor-pointer"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-2 font-bold text-sm text-[#2563EB] mb-2">
            <Info size={16} />
            <span>Auditor Quick Reference Guide — What to Look For:</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] text-[#475569] leading-relaxed">
            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
              <span className="font-bold text-[#0F172A] block mb-1">Cold Room Table (Below)</span>
              Check that every room's temperature stays within the "Safe Band" column. If a chamber breaches this limit, its status turns from <span className="text-emerald-700 font-bold">Compliant</span> to <span className="text-rose-600 font-bold">Review Required</span>.
            </div>
            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
              <span className="font-bold text-[#0F172A] block mb-1">Anti-Tamper Digital Seals</span>
              In ordinary databases, staff can edit old numbers after vaccines spoil. In ColdGuard, every reading is hashed into a blockchain block. If anyone alters even 0.1°C, the record is flagged.
            </div>
            <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
              <span className="font-bold text-[#0F172A] block mb-1">Exporting Proof for Records</span>
              Click on the "Reports & Inspection" tab at any time to export official signed PDF inspection certificates and CSV raw logs for government record-keeping.
            </div>
          </div>
        </div>
      )}

      {/* 3. Four Simplified Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="p-5 rounded-2xl bg-white border border-emerald-200 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase">Health Department Status</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-800">
              {allNominal ? "PASSED (Safe)" : "ATTENTION"}
            </div>
            <div className="text-xs text-[#475569] mt-1">
              {allNominal ? `All ${zones?.length ?? 0} chambers within safe temperature bounds` : `${excursionZones.length} of ${zones?.length ?? 0} chambers near threshold`}
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-5 rounded-2xl bg-white border border-blue-200 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase">Data Authenticity</span>
            <div className="h-8 w-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center">
              <Lock size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#0F172A] font-mono">
              {verifiedPct}% Genuine
            </div>
            <div className="text-xs text-[#475569] mt-1 font-mono">
              {verifiedCount.toLocaleString()} verified readings
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-5 rounded-2xl bg-white border border-purple-200 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase">Tamper Detections</span>
            <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Shield size={18} />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-extrabold ${tamperedCount === 0 ? "text-emerald-700" : "text-rose-700"}`}>
              {tamperedCount === 0 ? "0 Alterations" : `${tamperedCount} Caught`}
            </div>
            <div className="text-xs text-[#475569] mt-1">
              {tamperedCount === 0 ? "Zero database manipulation" : "Database discrepancy flagged"}
            </div>
            {tamperedCount > 0 && metrics?.latest_tampered_detail && (
              <div className="mt-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] font-mono text-rose-950 space-y-1">
                <div>
                  <span className="font-bold text-[#475569]">Tampered Data:</span>{" "}
                  <span className="text-rose-700 font-bold">
                    {metrics.latest_tampered_detail.original_temperature != null ? `${metrics.latest_tampered_detail.original_temperature}°C` : "Baseline"} → {metrics.latest_tampered_detail.tampered_temperature}°C
                  </span>
                </div>
                <div>
                  <span className="font-bold text-[#475569]">From:</span>{" "}
                  <span>Zone {metrics.latest_tampered_detail.zone_id?.toUpperCase()} · Sensor {metrics.latest_tampered_detail.device_id}</span>
                </div>
                <div>
                  <span className="font-bold text-[#475569]">Timestamp:</span>{" "}
                  <span className="text-slate-600 truncate block">{metrics.latest_tampered_detail.timestamp}</span>
                </div>
              </div>
            )}
            {tamperedCount > 0 && (
              <button
                onClick={handleRestoreTamper}
                disabled={isRestoring}
                className="mt-2.5 w-full py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-50"
                title="Restore all tampered database records back to their verified baseline"
              >
                <RotateCcw size={12} className={isRestoring ? "animate-spin text-emerald-600" : "text-emerald-600"} />
                <span>{isRestoring ? "Restoring..." : "Restore Baseline"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Card 4 */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-arctic-card flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase">Digital Seal Blocks</span>
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-[#475569] flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-[#0F172A] font-mono">
              {totalBlocks.toLocaleString()} Blocks
            </div>
            <div className="text-xs text-[#475569] mt-1 font-mono">
              Chain state: {isChainIntact ? "Intact ✓" : "Broken ✗"}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Chamber Inspection Table with Visual Comfort Bands */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <ClipboardCheck size={18} className="text-[#2563EB]" />
              <span>Cold Storage Chambers — Real-Time Temperature Inspection</span>
            </h2>
            <p className="text-xs text-[#475569] mt-0.5">
              Live checks comparing actual chamber thermometer against legally mandated safe bands.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-[#475569]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#F8FAFC] border border-[#DCE8F6] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#0F172A] cursor-pointer focus:outline-none focus:border-[#2563EB]"
            >
              <option value="all">All Chambers ({zones?.length ?? 0})</option>
              <option value="compliant">Safe & Compliant Only</option>
              <option value="flagged">Needs Review Only</option>
            </select>
          </div>
        </div>

        {zonesLoading ? (
          <div className="py-12 text-center text-sm font-medium text-[#475569]">Loading live room inspection telemetry…</div>
        ) : !filteredZones?.length ? (
          <div className="py-12 text-center text-sm font-medium text-[#475569]">
            No chambers found matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#EFF6FF] font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#DCE8F6] font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-5">Chamber / Cold Room</th>
                  <th className="py-3 px-5">Stored Item</th>
                  <th className="py-3 px-5">Current Reading</th>
                  <th className="py-3 px-5">Legally Mandated Safe Range</th>
                  <th className="py-3 px-5">Door & Equipment</th>
                  <th className="py-3 px-5">Audit Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8F6]/60">
                {filteredZones.map((z: any) => {
                  const risk = z.risk_score ?? 0;
                  const isDoor = z.door_status === "open";
                  const isCrit = z.temperature_status === "critical";
                  const isSafe = risk < 40 && !isCrit;

                  return (
                    <tr key={z.zone_id} className="hover:bg-[#F1F7FF] transition">
                      <td className="py-3.5 px-5 font-bold text-[#0F172A] text-sm">
                        {z.name}
                        <div className="text-[10px] font-mono text-[#475569]">{z.zone_id}</div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-semibold text-[#2563EB] text-xs px-2 py-0.5 rounded-lg bg-[#EFF6FF] border border-[#BAE6FD]">
                          {z.product}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-mono font-bold text-base text-[#0F172A]">
                          {z.temperature != null ? fmtTemp(z.temperature) : "—"}
                        </div>
                        <div className="text-[10px] text-[#475569]">
                          Target Setpoint: {z.setpoint != null ? `${z.setpoint}°C` : "—"}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs font-semibold text-[#475569]">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#0F172A] font-bold">
                            {z.lower_limit != null && z.upper_limit != null
                              ? `${z.lower_limit}°C to ${z.upper_limit}°C`
                              : "Defined Band"}
                          </span>
                        </div>
                        <div className="text-[10px] text-emerald-700">
                          {z.lower_limit != null && z.upper_limit != null ? "Safe Band Approved" : "Continuous Monitoring"}
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#475569]">
                        <div className="flex items-center gap-2">
                          <span className={isDoor ? "text-rose-600 font-bold" : "text-[#0F172A]"}>
                            Door: {isDoor ? "OPEN ⚠️" : "Closed ✓"}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#475569]">
                          Cooling: <span className="font-semibold text-[#0F172A]">{z.compressor_status || "Nominal"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span
                          className={`text-xs font-bold rounded-full px-3 py-1 border flex items-center gap-1.5 w-fit ${
                            isSafe
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${isSafe ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}
                          />
                          <span>{isSafe ? "Compliant ✓" : "Review Required"}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => setSelectedZoneModal(z)}
                          className="px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] hover:bg-[#EFF6FF] text-[#2563EB] font-bold text-xs shadow-sm transition cursor-pointer"
                        >
                          View Inspection Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Regulatory Frameworks Explained in Human Words */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card p-6">
        <div className="pb-3 border-b border-[#DCE8F6] mb-4">
          <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
            <FileCheck2 size={18} className="text-[#2563EB]" />
            <span>Auditor Compliance Checklist — Recognized Regulatory Standards</span>
          </h2>
          <p className="text-xs text-[#475569] mt-0.5">
            Automatic evaluation against official health, food, and pharmaceutical rules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              name: "FDA 21 CFR Part 11",
              label: "Anti-Tampering Record Keeping",
              rule: "Electronic sensor records cannot be deleted, edited, or faked without cryptographic detection.",
              verdict: isChainIntact && tamperedCount === 0 ? "PASSED (100% Genuine)" : `REJECTED (${tamperedCount} altered)`,
              isPass: isChainIntact && tamperedCount === 0,
              detail: `${verifiedCount.toLocaleString()} verified hashes • Chain: ${isChainIntact ? "Valid" : "Broken"}`,
            },
            {
              name: "WHO Good Distribution",
              label: "Continuous Sensor Telemetry",
              rule: "Cold rooms must stream continuous sensor measurements without unrecorded blind spots.",
              verdict: verifiedPct >= 95 ? `PASSED (${verifiedPct}%)` : `FLAGGED (${verifiedPct}%)`,
              isPass: verifiedPct >= 95,
              detail: `${verifiedCount.toLocaleString()} of ${totalReadings.toLocaleString()} telemetry packets confirmed`,
            },
            {
              name: "EU GDP Guidelines",
              label: "Chamber Thermal Integrity",
              rule: "Chambers must operate within narrow validated temperature bands without unaddressed drift.",
              verdict: allNominal ? `PASSED (${zones?.length ?? 0}/${zones?.length ?? 0} nominal)` : `WARNING (${excursionZones.length} at risk)`,
              isPass: allNominal,
              detail: `${(zones?.length ?? 0) - excursionZones.length} of ${zones?.length ?? 0} storage envelopes in compliant zone`,
            },
            {
              name: "HACCP Food Safety",
              label: "Critical Control Point (CCP-1)",
              rule: "Perishable inventories must prevent thermal degradation caused by prolonged door exposure.",
              verdict: zones?.every((z: any) => z.door_status !== "open" && (z.risk_score ?? 0) < 60) ? "PASSED (Doors Sealed)" : "REVIEW (Door Open / Alert)",
              isPass: (zones?.every((z: any) => z.door_status !== "open" && (z.risk_score ?? 0) < 60)) ?? false,
              detail: `${zones?.filter((z: any) => z.door_status === "open").length ?? 0} door open • ${zones?.filter((z: any) => (z.risk_score ?? 0) >= 60).length ?? 0} high risk zones`,
            },
          ].map((std) => (
            <div key={std.name} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <span className="font-bold text-xs text-[#0F172A]">{std.name}</span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      std.isPass
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {std.verdict}
                  </span>
                </div>
                <div className="text-xs font-semibold text-[#2563EB] mb-1">{std.label}</div>
                <p className="text-[11px] text-[#475569] leading-relaxed">{std.rule}</p>
                <div className="mt-2 text-[10px] font-mono text-[#0F172A] bg-white px-2 py-1 rounded border border-[#DCE8F6]">
                  {std.detail}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-[#DCE8F6] flex items-center justify-between text-[11px]">
                <span className="text-[#475569]">Audit Finding:</span>
                <span className={`font-bold ${std.isPass ? "text-emerald-700" : "text-amber-700"}`}>
                  {std.isPass ? "✓ Certified Compliant" : "⚠️ Action Required"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Chamber Inspection Detail Modal */}
      {selectedZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/50 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
                  <ClipboardCheck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Auditor Inspection Report: {selectedZoneModal.name}
                  </h3>
                  <p className="text-xs text-[#475569]">Product: {selectedZoneModal.product} • Zone ID: {selectedZoneModal.zone_id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedZoneModal(null)}
                className="text-[#475569] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-[#F1F7FF] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto my-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                  <span className="text-[#475569]">Measured Thermometer Temp</span>
                  <div className="text-2xl font-extrabold text-[#0F172A] font-mono mt-1">
                    {selectedZoneModal.temperature != null ? fmtTemp(selectedZoneModal.temperature) : "—"}
                  </div>
                  <div className="text-[11px] text-[#475569] mt-0.5">
                    Safe Allowed: {selectedZoneModal.lower_limit}°C to {selectedZoneModal.upper_limit}°C
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                  <span className="text-[#475569]">Excursion Risk Probability</span>
                  <div className="text-2xl font-extrabold text-[#2563EB] font-mono mt-1">
                    {Math.round(selectedZoneModal.risk_score ?? 0)}%
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    {selectedZoneModal.risk_score < 40 ? "Low / Nominal Risk" : "Elevated Risk Detected"}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-2">
                <div className="font-bold text-[#0F172A]">Live Telemetry & Chamber Diagnostics:</div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-[#475569]">
                  <div>Sensor Probe ID: <span className="font-bold font-mono text-[#0F172A]">{selectedZoneModal.sensor_id || selectedZoneModal.zone_id}</span></div>
                  <div>
                    Calibration Status:{" "}
                    {selectedZoneModal.sensor_status === "normal" && (!selectedZoneModal.sensor_issues || selectedZoneModal.sensor_issues.length === 0) ? (
                      <span className="font-bold text-emerald-700">Certified & Nominal</span>
                    ) : (
                      <span className="font-bold text-rose-600">
                        {selectedZoneModal.sensor_issues?.map((i: any) => i.detail).join("; ") || selectedZoneModal.sensor_status}
                      </span>
                    )}
                  </div>
                  <div>Door State: <span className={`font-bold ${selectedZoneModal.door_status === "open" ? "text-rose-600" : "text-[#0F172A]"}`}>{selectedZoneModal.door_status === "open" ? "OPEN ⚠️" : "CLOSED ✓"}</span></div>
                  <div>Compressor Status: <span className="font-bold text-[#0F172A]">{selectedZoneModal.compressor_status || "Nominal"}</span></div>
                  <div>Power Consumption: <span className="font-bold text-[#0F172A]">{selectedZoneModal.power_consumption_kw != null ? `${selectedZoneModal.power_consumption_kw.toFixed(2)} kW` : "—"}</span></div>
                  <div>Chamber Humidity: <span className="font-bold text-[#0F172A]">{selectedZoneModal.humidity != null ? `${Math.round(selectedZoneModal.humidity)}% RH` : "—"}</span></div>
                  <div>Temperature Trend: <span className="font-bold font-mono text-[#0F172A]">{selectedZoneModal.trend_per_hour != null ? `${selectedZoneModal.trend_per_hour > 0 ? "+" : ""}${selectedZoneModal.trend_per_hour.toFixed(2)}°C/hr` : "0.00°C/hr"}</span></div>
                  <div>Active Alerts: <span className={`font-bold font-mono ${(selectedZoneModal.active_alert_count ?? 0) > 0 ? "text-rose-600" : "text-emerald-700"}`}>{selectedZoneModal.active_alert_count ?? 0} active</span></div>
                </div>
              </div>

              {(() => {
                const isModalCompliant = (selectedZoneModal.risk_score ?? 0) < 40 && selectedZoneModal.temperature_status !== "critical" && selectedZoneModal.door_status !== "open";
                return (
                  <div className={`p-3 rounded-xl border text-xs leading-relaxed ${isModalCompliant ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                    <div className="font-bold mb-1 flex items-center gap-1.5">
                      {isModalCompliant ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertTriangle size={15} className="text-amber-600" />}
                      <span>Official Regulatory Compliance Assessment:</span>
                    </div>
                    <div>
                      {isModalCompliant
                        ? `Cold room ${selectedZoneModal.name} (${selectedZoneModal.zone_id}) conforms with GxP & FDA temperature guidelines. Current thermometer reading (${selectedZoneModal.temperature != null ? fmtTemp(selectedZoneModal.temperature) : "—"}) is maintained within designated limits (${selectedZoneModal.lower_limit}°C to ${selectedZoneModal.upper_limit}°C) with zero cryptographic integrity violations.`
                        : `AUDIT NOTICE: Cold room ${selectedZoneModal.name} requires inspector attention. Current temperature trend is ${selectedZoneModal.trend_per_hour > 0 ? "+" : ""}${selectedZoneModal.trend_per_hour?.toFixed(2) ?? "0.00"}°C/hr with an excursion probability of ${Math.round(selectedZoneModal.risk_score ?? 0)}%. ${selectedZoneModal.door_status === "open" ? "Door is currently OPEN. " : ""}Remedial cooling intervention requested.`}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="pt-3 border-t border-[#DCE8F6] flex items-center justify-end">
              <button
                onClick={() => setSelectedZoneModal(null)}
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white font-bold text-xs hover:bg-[#1D4ED8] cursor-pointer shadow-sm"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
