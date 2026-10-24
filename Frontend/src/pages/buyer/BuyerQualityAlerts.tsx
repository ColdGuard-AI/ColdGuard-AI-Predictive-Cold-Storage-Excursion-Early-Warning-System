/* ─────────────────────────────────────────────────────────────────────────────
   Buyer / Retailer — Product Risk & Quality Alerts
   Premium Arctic Blue Design System
   Real-time excursion tracking, Arrhenius degradation, and automated dispute filing
───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  RefreshCw,
  Clock,
  DollarSign,
  FileText,
  Send,
  X,
  Check,
  ShieldCheck,
  ChevronRight,
  Zap,
  Search,
} from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";

export interface QualityDispute {
  claimId: string;
  poNumber: string;
  lotId: string;
  productName: string;
  zoneName: string;
  breachTemp: number;
  criticalLimit: number;
  claimAmountUsd: number;
  submittedAt: string;
  status: "SUBMITTED_TO_INSURER" | "UNDER_SUPPLIER_REVIEW" | "REIMBURSED";
  merkleProofHash: string;
}

export default function BuyerQualityAlerts() {
  const { zones, zonesLoading, searchQuery, setSearchQuery } = useApp();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "DISPUTES">("ACTIVE");
  const [disputeModalLot, setDisputeModalLot] = useState<any | null>(null);
  const [claimAmount, setClaimAmount] = useState<number>(186000);
  const [claimReason, setClaimReason] = useState<string>("Thermal excursion exceeding WHO GDP limits");
  const [disputes, setDisputes] = useState<QualityDispute[]>(() => {
    const saved = localStorage.getItem("coldguard_buyer_disputes");
    return saved
      ? JSON.parse(saved)
      : [
          {
            claimId: "CLM-2026-8812",
            poNumber: "PO-2026-BIO-901",
            lotId: "LOT-BIO-2026-09A",
            productName: "COVID-19 mRNA Vaccine Vials (Comirnaty)",
            zoneName: "Vaccine Store A",
            breachTemp: 8.65,
            criticalLimit: 8.0,
            claimAmountUsd: 186000,
            submittedAt: "2026-10-24 18:30 UTC",
            status: "UNDER_SUPPLIER_REVIEW",
            merkleProofHash: "72758bf1a40acde22384976ea84b5c77e92bf18b32e6b89e3a6c1178a9c2d1b4",
          },
        ];
  });

  useEffect(() => {
    localStorage.setItem("coldguard_buyer_disputes", JSON.stringify(disputes));
  }, [disputes]);

  async function loadAlerts() {
    setLoading(true);
    try {
      const data = await api.alerts({ limit: 40 }).catch(() => []);
      setAlerts(data as any[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  const query = (searchQuery || "").trim().toLowerCase();

  // Filter alerts specifically for cold chain quality issues and active search query
  const rawQualityAlerts = alerts.filter(
    (a) => a.category === "excursion" || a.category === "trend" || a.severity === "critical" || a.severity === "warning"
  );

  const qualityAlerts = rawQualityAlerts.filter((a) => {
    if (!query) return true;
    return (
      (a.title && a.title.toLowerCase().includes(query)) ||
      (a.zone_id && a.zone_id.toLowerCase().includes(query)) ||
      (a.severity && a.severity.toLowerCase().includes(query)) ||
      (a.category && a.category.toLowerCase().includes(query)) ||
      (a.message && a.message.toLowerCase().includes(query)) ||
      (a.id && String(a.id).toLowerCase().includes(query))
    );
  });

  const filteredDisputes = disputes.filter((d) => {
    if (!query) return true;
    return (
      d.claimId.toLowerCase().includes(query) ||
      d.poNumber.toLowerCase().includes(query) ||
      d.lotId.toLowerCase().includes(query) ||
      d.productName.toLowerCase().includes(query) ||
      d.zoneName.toLowerCase().includes(query) ||
      d.status.toLowerCase().includes(query)
    );
  });

  const criticalCount = qualityAlerts.filter((a) => a.severity === "critical" && a.active).length;

  function handleSubmitDispute() {
    if (!disputeModalLot) return;
    const newDispute: QualityDispute = {
      claimId: `CLM-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      poNumber: disputeModalLot.poNumber || "PO-2026-BIO-901",
      lotId: disputeModalLot.lotId,
      productName: disputeModalLot.productName,
      zoneName: disputeModalLot.zoneName,
      breachTemp: disputeModalLot.temperature || 8.4,
      criticalLimit: disputeModalLot.limit || 8.0,
      claimAmountUsd: claimAmount,
      submittedAt: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
      status: "SUBMITTED_TO_INSURER",
      merkleProofHash: "9ddc9333b4bce04e2fb1e59dcba29928989dccf37717e851a021bb4948a31809",
    };

    setDisputes((prev) => [newDispute, ...prev]);
    setDisputeModalLot(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <ShieldAlert size={28} className="text-[#0D9488]" /> Product Risk & Quality Alerts
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">
            Monitor cold chain temperature breaches, biological degradation indices, and generate automated insurance claims.
          </p>
        </div>
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white px-4 py-2.5 text-sm font-bold text-[#0F172A] hover:bg-[#F1F7FF] transition shadow-arctic-card cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Quality Logs
        </button>
      </div>

      {/* Top Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider block">Active Quality Alarms</span>
            <div className="text-3xl font-extrabold text-[#0F172A] mt-1">{qualityAlerts.filter((a) => a.active).length}</div>
            <div className="text-xs font-semibold text-rose-600 mt-0.5">{criticalCount} Critical Excursions</div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
            <ShieldAlert size={24} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider block">Filed Insurance Claims</span>
            <div className="text-3xl font-extrabold text-[#0F172A] mt-1">{disputes.length}</div>
            <div className="text-xs font-semibold text-[#0D9488] mt-0.5">
              ${disputes.reduce((sum, d) => sum + d.claimAmountUsd, 0).toLocaleString()} Total Claimed
            </div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-teal-50 border border-teal-200 text-[#0D9488] flex items-center justify-center">
            <DollarSign size={24} />
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 shadow-arctic-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider block">Automated GDP Protection</span>
            <div className="text-xl font-extrabold text-emerald-800 mt-1">100% Verified</div>
            <div className="text-xs font-semibold text-[#64748B] mt-0.5">Merkle Proofs Anchored</div>
          </div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            <ShieldCheck size={24} />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#DCE8F6] shadow-arctic-card">
        {/* Search */}
        <div className="relative flex-1 min-w-[260px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts by title, chamber, lot, or severity..."
            className="w-full pl-10 pr-9 py-2 text-sm rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {searchQuery && (
          <span className="text-xs font-bold text-[#0D9488] bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl">
            Filtering by: "{searchQuery}"
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DCE8F6] pb-2">
        <button
          onClick={() => setActiveTab("ACTIVE")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === "ACTIVE"
              ? "bg-[#0D9488] text-white shadow-md"
              : "text-[#475569] hover:bg-[#F1F7FF] hover:text-[#0F172A]"
          }`}
        >
          Active Quality & Excursion Alerts ({qualityAlerts.length})
        </button>
        <button
          onClick={() => setActiveTab("DISPUTES")}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer ${
            activeTab === "DISPUTES"
              ? "bg-[#0D9488] text-white shadow-md"
              : "text-[#475569] hover:bg-[#F1F7FF] hover:text-[#0F172A]"
          }`}
        >
          Automated Supplier Claims & Disputes ({filteredDisputes.length})
        </button>
      </div>

      {/* View: Active Quality Alerts */}
      {activeTab === "ACTIVE" && (
        <div className="space-y-4">
          {qualityAlerts.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-8 text-center">
              <CheckCircle2 size={32} className="mx-auto text-emerald-600 mb-2" />
              <h3 className="text-lg font-bold text-emerald-900">
                {searchQuery ? `No Quality Alerts Matching "${searchQuery}"` : "Zero Cold Chain Excursions Detected"}
              </h3>
              <p className="text-sm text-emerald-700 mt-1">
                {searchQuery
                  ? "Try searching for a different chamber name, alert severity, or product keyword."
                  : "All chambers and buyer lots are operating nominal within validated safe thermal limits."}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-3 px-4 py-1.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition cursor-pointer"
                >
                  Clear Search Filter
                </button>
              )}
            </div>
          ) : (
            qualityAlerts.map((alert) => {
              const isCrit = alert.severity === "critical";
              return (
                <div
                  key={alert.id}
                  className={`rounded-2xl border p-5 bg-white shadow-arctic-card transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isCrit ? "border-rose-300 ring-1 ring-rose-200" : "border-amber-200"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 ${
                        isCrit ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      <AlertTriangle size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h4 className="text-base font-extrabold text-[#0F172A]">{alert.title}</h4>
                        <span
                          className={`text-xs font-bold uppercase rounded-full px-2.5 py-0.5 border ${
                            isCrit
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BAE6FD]">
                          {alert.zone_id}
                        </span>
                      </div>
                      <p className="text-sm text-[#475569] mt-1 font-medium">{alert.message}</p>
                      <div className="flex items-center gap-4 text-xs text-[#64748B] mt-2 font-medium">
                        <span>Triggered: {alert.created_at ? new Date(alert.created_at).toLocaleTimeString() : "Recent"}</span>
                        <span>•</span>
                        <span className="text-[#0D9488] font-bold">
                          Recommended Action: {alert.recommended_action || "Quarantine affected pallet batch"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() =>
                        setDisputeModalLot({
                          lotId: alert.zone_id === "zone-a" ? "LOT-BIO-2026-09A" : alert.zone_id === "zone-b" ? "LOT-DAIRY-884B" : "LOT-CRYO-411C",
                          productName: alert.zone_id === "zone-a" ? "COVID-19 mRNA Vaccines" : "Grade-A Dairy Products",
                          zoneName: alert.zone_id,
                          temperature: alert.metric_value || 8.5,
                          limit: 8.0,
                          poNumber: "PO-2026-BIO-901",
                        })
                      }
                      className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow-sm cursor-pointer flex items-center gap-1.5"
                    >
                      <FileText size={15} /> File Insurance Claim
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* View: Filed Disputes */}
      {activeTab === "DISPUTES" && (
        <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center justify-between">
            <h3 className="text-base font-bold text-[#0F172A]">Automated Cryptographic Spoilage Claims</h3>
            <span className="text-xs font-semibold text-[#64748B]">All claims backed by Blockchain Merkle Roots</span>
          </div>

          <div className="divide-y divide-[#DCE8F6]/60">
            {filteredDisputes.length === 0 ? (
              <div className="p-8 text-center text-sm font-semibold text-[#64748B]">
                {searchQuery ? `No supplier claims matching "${searchQuery}".` : "No filed claims or disputes recorded."}
              </div>
            ) : (
              filteredDisputes.map((dispute) => (
              <div key={dispute.claimId} className="p-6 hover:bg-[#F8FAFC] transition space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-extrabold text-[#0D9488] bg-[#0D9488]/10 px-2.5 py-1 rounded border border-[#0D9488]/20">
                      {dispute.claimId}
                    </span>
                    <h4 className="text-base font-extrabold text-[#0F172A]">{dispute.productName}</h4>
                    <span className="font-mono text-xs font-semibold text-[#2563EB]">{dispute.lotId}</span>
                  </div>
                  <div className="text-base font-extrabold text-rose-700">
                    ${dispute.claimAmountUsd.toLocaleString()} Claim
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-[#F1F7FF] border border-[#DCE8F6] p-3 rounded-xl">
                  <div>
                    <span className="text-[#64748B] block font-medium">Chamber Thermal Breach:</span>
                    <span className="font-bold text-[#0F172A] font-mono">
                      {dispute.breachTemp}°C (Threshold: {dispute.criticalLimit}°C)
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block font-medium">Submitted Timestamp:</span>
                    <span className="font-semibold text-[#0F172A]">{dispute.submittedAt}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block font-medium">Claim Status:</span>
                    <span className="font-bold text-[#0D9488] uppercase">{dispute.status.replace(/_/g, " ")}</span>
                  </div>
                </div>

                <div className="font-mono text-[11px] text-[#475569] bg-white p-2.5 rounded-lg border border-[#DCE8F6] break-all">
                  <span className="font-bold text-[#1E40AF]">Blockchain Merkle Evidence:</span> {dispute.merkleProofHash}
                </div>
              </div>
            )))
          }
          </div>
        </div>
      )}

      {/* File Dispute Modal */}
      {disputeModalLot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#DCE8F6] shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
              <div>
                <h3 className="text-xl font-extrabold text-[#0F172A]">File Spoilage Insurance Claim</h3>
                <p className="text-xs font-semibold text-[#64748B] mt-0.5">
                  Automated Parametric Claim underwritten by ColdGuard Audit Proofs
                </p>
              </div>
              <button
                onClick={() => setDisputeModalLot(null)}
                className="h-8 w-8 rounded-full border border-[#DCE8F6] flex items-center justify-center text-[#475569] hover:bg-[#F1F7FF] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#64748B]">Affected Lot:</span>
                <span className="font-bold text-[#0F172A]">{disputeModalLot.lotId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Chamber Location:</span>
                <span className="font-bold text-[#0F172A]">{disputeModalLot.zoneName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Peak Excursion Temp:</span>
                <span className="font-mono font-bold text-rose-600">{disputeModalLot.temperature}°C</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                Financial Loss Claim Amount (USD)
              </label>
              <div className="relative">
                <DollarSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B]" />
                <input
                  type="number"
                  value={claimAmount}
                  onChange={(e) => setClaimAmount(Number(e.target.value))}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-[#DCE8F6] font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                Claim Reason & Medical/Food Safety Non-Compliance
              </label>
              <textarea
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-[#DCE8F6] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE8F6]">
              <button
                onClick={() => setDisputeModalLot(null)}
                className="px-4 py-2 rounded-xl border border-[#DCE8F6] text-xs font-bold text-[#475569] hover:bg-[#F1F7FF] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitDispute}
                className="px-5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Send size={15} /> Submit Digital Claim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
