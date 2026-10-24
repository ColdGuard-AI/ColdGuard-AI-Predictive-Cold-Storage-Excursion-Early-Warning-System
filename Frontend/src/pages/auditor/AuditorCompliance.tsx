/* ─────────────────────────────────────────────────────────────────────────────
   Government / Quality Auditor — Compliance Overview (Arctic Blue Design System)
   Pulls from /api/zones, /api/alerts, /api/integrity/status
───────────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, RefreshCw, Shield, ShieldCheck, XCircle, AlertTriangle } from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";

function ComplianceCard({ label, value, status, note }: any) {
  const ok = status === "ok";
  const warn = status === "warn";
  return (
    <div
      className={`rounded-2xl border p-6 bg-white shadow-arctic-card hover:shadow-arctic-hover transition-all duration-200 ${
        ok ? "border-emerald-200" : warn ? "border-amber-200" : "border-rose-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm sm:text-base font-bold text-[#475569]">{label}</span>
        {ok ? (
          <CheckCircle2 size={22} className="text-emerald-600" />
        ) : warn ? (
          <AlertTriangle size={22} className="text-amber-500" />
        ) : (
          <XCircle size={22} className="text-rose-600" />
        )}
      </div>
      <div
        className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
          ok ? "text-[#0F172A]" : warn ? "text-amber-900" : "text-rose-900"
        }`}
      >
        {value}
      </div>
      {note && <div className="text-xs sm:text-sm font-medium text-[#475569] mt-1">{note}</div>}
    </div>
  );
}

export default function AuditorCompliance() {
  const { zones, zonesLoading } = useApp();
  const [integrity, setIntegrity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const integ = await api.integrityStatus().catch(() => null);
      setIntegrity(integ);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const totalReadings = integrity?.total_readings ?? 0;
  const verifiedPct = integrity ? Math.round(((integrity.verified ?? 0) / Math.max(1, totalReadings)) * 100) : 0;
  const excursionZones = zones?.filter((z: any) => (z.risk_score ?? 0) >= 60) ?? [];
  const allNominal = excursionZones.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <ShieldCheck size={28} className="text-[#2563EB]" /> Regulatory Compliance & Audit Overview
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">
            Independent compliance verification, cryptographic Merkle audit status, and cold-chain integrity.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white px-4 py-2.5 text-sm font-bold text-[#0F172A] hover:bg-[#F1F7FF] transition shadow-arctic-card cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Compliance cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <ComplianceCard
          label="Facility Compliance"
          value={allNominal ? "COMPLIANT" : "AUDIT FLAGGED"}
          status={allNominal ? "ok" : "warn"}
          note="Real-time excursion thresholds"
        />
        <ComplianceCard
          label="Blockchain Audit Integrity"
          value={`${verifiedPct}%`}
          status={verifiedPct >= 95 ? "ok" : verifiedPct >= 80 ? "warn" : "fail"}
          note={`${integrity?.verified ?? 0} of ${totalReadings} blocks verified`}
        />
        <ComplianceCard
          label="Monitored Cold Rooms"
          value={zones?.length ?? "—"}
          status="ok"
          note="Continuous telemetry active"
        />
        <ComplianceCard
          label="Excursion Breaches"
          value={excursionZones.length}
          status={excursionZones.length === 0 ? "ok" : "warn"}
          note="Critical / Warning zones"
        />
      </div>

      {/* Zone compliance table */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center gap-2.5">
          <ClipboardCheck size={20} className="text-[#2563EB]" />
          <h2 className="text-lg font-bold text-[#0F172A]">Cold Storage Zone Regulatory Audit</h2>
        </div>
        {zonesLoading ? (
          <div className="py-12 text-center text-base font-medium text-[#475569]">Loading compliance data…</div>
        ) : !zones?.length ? (
          <div className="py-12 text-center text-base font-medium text-[#475569]">
            No zone telemetry available for audit.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#EFF6FF] text-xs sm:text-sm font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#DCE8F6]">
                <tr>
                  <th className="py-3.5 px-5">Cold Room</th>
                  <th className="py-3.5 px-5">Temperature</th>
                  <th className="py-3.5 px-5">Mandated Range</th>
                  <th className="py-3.5 px-5">Risk Score</th>
                  <th className="py-3.5 px-5">Risk Assessment</th>
                  <th className="py-3.5 px-5">Audit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8F6]/60">
                {zones.map((z: any) => {
                  const risk = z.risk_score ?? 0;
                  const compliant = risk < 40 && z.temperature_status !== "critical";
                  return (
                    <tr key={z.zone_id} className="hover:bg-[#F1F7FF] transition">
                      <td className="py-4 px-5 font-bold text-[#0F172A] text-base">{z.name}</td>
                      <td className="py-4 px-5 text-base font-mono font-bold text-[#0F172A]">
                        {z.temperature?.toFixed(2) ?? "—"}°C
                      </td>
                      <td className="py-4 px-5 text-sm font-semibold text-[#475569]">
                        {z.safe_temp_min != null ? `${z.safe_temp_min}°C to ${z.safe_temp_max}°C` : "Standard Cold Chain"}
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`text-base font-extrabold ${
                            risk >= 70 ? "text-rose-600" : risk >= 40 ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          {risk}%
                        </span>
                      </td>
                      <td className="py-4 px-5 text-base font-medium text-[#475569]">
                        {z.excursion_risk_label ?? (risk >= 70 ? "High Risk" : risk >= 40 ? "Moderate" : "Nominal")}
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`text-xs font-bold uppercase rounded-full px-3 py-1 border ${
                            compliant
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-amber-50 border-amber-200 text-amber-800"
                          }`}
                        >
                          {compliant ? "Compliant" : "Review Required"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Integrity summary */}
      {integrity && (
        <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card p-6">
          <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2.5 mb-4">
            <Shield size={20} className="text-[#2563EB]" /> Blockchain Cryptographic Proofs & Telemetry Verification
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
              <div className="text-[#475569] text-xs font-semibold uppercase tracking-wider">
                Total Indexed Telemetry
              </div>
              <div className="text-2xl font-extrabold text-[#0F172A] mt-1">{totalReadings.toLocaleString()}</div>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-emerald-800 text-xs font-semibold uppercase tracking-wider">
                Cryptographically Verified
              </div>
              <div className="text-2xl font-extrabold text-emerald-900 mt-1">
                {(integrity.verified ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200">
              <div className="text-rose-800 text-xs font-semibold uppercase tracking-wider">Tampered Records</div>
              <div
                className={`text-2xl font-extrabold ${
                  (integrity.tampered ?? 0) > 0 ? "text-rose-700" : "text-[#0F172A]"
                } mt-1`}
              >
                {integrity.tampered ?? 0}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD]">
              <div className="text-[#1E40AF] text-xs font-semibold uppercase tracking-wider">
                Merkle Blockchain Blocks
              </div>
              <div className="text-2xl font-extrabold text-[#0F172A] mt-1">{integrity.block_count ?? 0}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
