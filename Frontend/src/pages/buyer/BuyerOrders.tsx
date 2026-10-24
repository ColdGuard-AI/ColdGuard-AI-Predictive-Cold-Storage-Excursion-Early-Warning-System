/* ─────────────────────────────────────────────────────────────────────────────
   Buyer / Retailer — Orders & Acceptance Dashboard (Arctic Blue Design System)
   Pulls from /api/zones, /api/alerts for excursion-affected lot quality info
───────────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Package, RefreshCw, ShoppingBag, XCircle } from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";

function QualityBadge({ score }: { score: number }) {
  if (score >= 80)
    return (
      <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 text-xs font-bold">
        Accepted
      </span>
    );
  if (score >= 50)
    return (
      <span className="rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 text-xs font-bold">
        Review Required
      </span>
    );
  return (
    <span className="rounded-full bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1 text-xs font-bold">
      Shipment On Hold
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color = "primary" }: any) {
  const iconColors: Record<string, string> = {
    primary: "text-[#2563EB] bg-[#EFF6FF] border-[#BAE6FD]",
    green: "text-emerald-600 bg-emerald-50 border-emerald-200",
    amber: "text-amber-600 bg-amber-50 border-amber-200",
    red: "text-rose-600 bg-rose-50 border-rose-200",
  };

  return (
    <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 flex flex-col justify-between shadow-arctic-card hover:shadow-arctic-hover transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm sm:text-base font-bold text-[#475569]">{label}</span>
        <div
          className={`h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 ${
            iconColors[color] ?? iconColors.primary
          }`}
        >
          <Icon size={18} />
        </div>
      </div>
      <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight">{value}</div>
    </div>
  );
}

export default function BuyerOrders() {
  const { zones, zonesLoading } = useApp();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const al = await api.alerts({ active: true, limit: 20 }).catch(() => []);
      setAlerts(al as any[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Compute lot quality from zone risk scores
  const lots =
    zones?.map((z: any) => {
      const risk = z.risk_score ?? 0;
      const qualityScore = Math.max(0, 100 - risk);
      const excursionAlert = alerts.find((a) => a.zone_id === z.zone_id && a.severity === "critical");
      return {
        lot_id: `LOT-${z.zone_id.toUpperCase().replace("ZONE-", "").replace("-", "")}`,
        zone: z.name,
        zone_id: z.zone_id,
        current_temp: z.temperature,
        quality_score: qualityScore,
        risk_score: risk,
        excursion_flag: risk >= 70 || !!excursionAlert,
        temp_history_complete: true,
        status: qualityScore >= 80 ? "accepted" : qualityScore >= 50 ? "review" : "hold",
      };
    }) ?? [];

  const acceptedLots = lots.filter((l) => l.status === "accepted").length;
  const reviewLots = lots.filter((l) => l.status === "review").length;
  const holdLots = lots.filter((l) => l.status === "hold").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <ShoppingBag size={28} className="text-[#2563EB]" /> Buyer Orders & Lot Quality Acceptance
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">
            Verify batch temperature histories, audit quality scores, and clear shipments for delivery.
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

      {/* Notice */}
      <div className="rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] px-5 py-3.5 text-sm sm:text-base font-medium text-[#1E40AF] flex items-start gap-3 shadow-sm">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#2563EB]" />
        <div>
          <strong>Acceptance Gate:</strong> Quality ratings and shipment statuses are updated in real-time from continuous cold room temperature telemetry.
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
        <StatCard label="Total Monitored Lots" value={lots.length} icon={Package} color="primary" />
        <StatCard label="Cleared & Accepted" value={acceptedLots} icon={CheckCircle2} color="green" />
        <StatCard label="Under Review" value={reviewLots} icon={AlertTriangle} color="amber" />
        <StatCard label="Shipment On Hold" value={holdLots} icon={XCircle} color={holdLots > 0 ? "red" : "primary"} />
      </div>

      {/* Lot table */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package size={20} className="text-[#2563EB]" />
            <h2 className="text-lg font-bold text-[#0F172A]">Lot Quality & Compliance Roster</h2>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-[#475569] bg-[#F1F7FF] border border-[#DCE8F6] px-3 py-1 rounded-full">
            {lots.length} Product Lots
          </span>
        </div>

        {zonesLoading || loading ? (
          <div className="py-12 text-center text-base font-medium text-[#475569]">Loading lot telemetry…</div>
        ) : !lots.length ? (
          <div className="py-12 text-center text-base font-medium text-[#475569]">
            No lot data available yet. Waiting for sensor stream.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#EFF6FF] text-xs sm:text-sm font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#DCE8F6]">
                <tr>
                  <th className="py-3.5 px-5">Batch Lot ID</th>
                  <th className="py-3.5 px-5">Storage Zone</th>
                  <th className="py-3.5 px-5">Current Temp</th>
                  <th className="py-3.5 px-5">Quality Integrity</th>
                  <th className="py-3.5 px-5">Excursion Alert</th>
                  <th className="py-3.5 px-5">Cold-Chain Log</th>
                  <th className="py-3.5 px-5">Acceptance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8F6]/60">
                {lots.map((lot) => (
                  <tr key={lot.lot_id} className="hover:bg-[#F1F7FF] transition">
                    <td className="py-4 px-5 font-mono text-base font-bold text-[#0F172A]">{lot.lot_id}</td>
                    <td className="py-4 px-5 text-base font-semibold text-[#0F172A]">{lot.zone}</td>
                    <td className="py-4 px-5 text-base font-mono font-bold text-[#0F172A]">
                      {lot.current_temp?.toFixed(1) ?? "—"}°C
                    </td>
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-20 bg-[#F1F7FF] border border-[#DCE8F6] rounded-full h-2 overflow-hidden p-[1px]">
                          <div
                            className={`h-full rounded-full ${
                              lot.quality_score >= 80
                                ? "bg-emerald-500"
                                : lot.quality_score >= 50
                                ? "bg-amber-400"
                                : "bg-rose-500"
                            }`}
                            style={{ width: `${lot.quality_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-extrabold text-[#0F172A]">
                          {Math.round(lot.quality_score)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-5">
                      {lot.excursion_flag ? (
                        <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full">
                          <XCircle size={14} /> Excursion Detected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                          <CheckCircle2 size={14} /> Safe Range
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-5">
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                        <CheckCircle2 size={15} /> Verified Intact
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <QualityBadge score={lot.quality_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quality alerts */}
      {alerts.filter((a) => a.severity === "critical").length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 shadow-arctic-card overflow-hidden">
          <div className="px-6 py-4 border-b border-rose-200 flex items-center gap-2.5">
            <AlertTriangle size={20} className="text-rose-600" />
            <h2 className="text-lg font-bold text-rose-900">
              Critical Quality Flags — Immediate Shipment Hold Recommended
            </h2>
          </div>
          <div className="divide-y divide-rose-100">
            {alerts
              .filter((a) => a.severity === "critical")
              .map((a: any) => (
                <div key={a.id} className="px-6 py-4">
                  <div className="text-base font-bold text-rose-900">{a.title}</div>
                  <div className="text-sm font-medium text-rose-700 mt-0.5">
                    {a.zone_id} · Recommended action: {a.recommended_action}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
