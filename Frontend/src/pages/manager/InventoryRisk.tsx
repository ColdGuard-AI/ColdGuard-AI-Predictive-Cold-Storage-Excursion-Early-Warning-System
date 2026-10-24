/* ─────────────────────────────────────────────────────────────────────────────
   Manager — Inventory & Financial Risk (Arctic Blue Design System)
   Wraps ExcursionMonitor — shows excursion events, financial exposure per zone
───────────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { AlertTriangle, DollarSign, Package, RefreshCw, TrendingUp } from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";

const SPOILAGE_COST_PER_KG: Record<string, number> = {
  "zone-a": 45, // Vaccines & Biologics — high value
  "zone-b": 12, // Frozen goods
  "zone-c": 8, // General cold storage
};

const INVENTORY_KG: Record<string, number> = {
  "zone-a": 500,
  "zone-b": 2400,
  "zone-c": 3100,
};

export default function InventoryRisk() {
  const { zones, zonesLoading } = useApp();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const ev = await api.events(20).catch(() => []);
      setEvents(ev as any[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const inventoryRows =
    zones?.map((z: any) => {
      const risk = z.risk_score ?? 0;
      const kg = INVENTORY_KG[z.zone_id] ?? 1000;
      const costPerKg = SPOILAGE_COST_PER_KG[z.zone_id] ?? 10;
      const exposurePct = risk / 100;
      const financialExposure = kg * costPerKg * exposurePct;
      return {
        zone: z.name,
        zone_id: z.zone_id,
        inventory_kg: kg,
        cost_per_kg: costPerKg,
        risk,
        financial_exposure: financialExposure,
        status: z.temperature_status,
      };
    }) ?? [];

  const totalExposure = inventoryRows.reduce((s, r) => s + r.financial_exposure, 0);
  const highRiskZones = inventoryRows.filter((r) => r.risk >= 60).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <Package size={28} className="text-[#2563EB]" /> Inventory & Financial Exposure Analysis
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">
            Estimated inventory value at risk based on real-time temperature fluctuations and commodity valuations.
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

      <div className="rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] px-5 py-3.5 text-sm sm:text-base font-medium text-[#1E40AF] flex items-start gap-3 shadow-sm">
        <AlertTriangle size={20} className="mt-0.5 shrink-0 text-[#2563EB]" />
        <div>
          <strong>Financial Exposure Notice:</strong> Projections represent potential monetary loss calculated from live excursion risk scores and commodity unit costs.
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm sm:text-base text-[#475569] font-bold">Total Financial Exposure</span>
            <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
            ₹{totalExposure.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs sm:text-sm font-semibold text-[#475569] mt-1">
            Estimated risk across all cold rooms
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm sm:text-base font-bold text-[#475569]">High-Risk Cold Rooms</span>
            <div
              className={`h-9 w-9 rounded-xl border flex items-center justify-center ${
                highRiskZones > 0
                  ? "bg-rose-50 border-rose-200 text-rose-600"
                  : "bg-emerald-50 border-emerald-200 text-emerald-600"
              }`}
            >
              <TrendingUp size={18} />
            </div>
          </div>
          <div
            className={`text-3xl font-extrabold tracking-tight ${
              highRiskZones > 0 ? "text-rose-600" : "text-[#0F172A]"
            }`}
          >
            {highRiskZones}
          </div>
          <div
            className={`text-xs sm:text-sm font-semibold mt-1 ${
              highRiskZones > 0 ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            Excursion probability ≥ 60%
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm sm:text-base text-[#475569] font-bold">Total Tracked Inventory</span>
            <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <Package size={18} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#0F172A] tracking-tight">
            {inventoryRows.reduce((s, r) => s + r.inventory_kg, 0).toLocaleString()} kg
          </div>
          <div className="text-xs sm:text-sm font-semibold text-[#475569] mt-1">Active lot tonnage stored</div>
        </div>
      </div>

      {/* Inventory table */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center gap-2.5">
          <Package size={20} className="text-[#2563EB]" />
          <h2 className="text-lg font-bold text-[#0F172A]">Cold Room Inventory Breakdown</h2>
        </div>
        {zonesLoading ? (
          <div className="py-12 text-center text-base font-medium text-[#475569]">Loading inventory data…</div>
        ) : !inventoryRows.length ? (
          <div className="py-12 text-center text-base font-medium text-[#475569]">No inventory data available.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#EFF6FF] text-xs sm:text-sm font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#DCE8F6]">
                <tr>
                  <th className="py-3.5 px-5">Cold Room</th>
                  <th className="py-3.5 px-5">Inventory Mass</th>
                  <th className="py-3.5 px-5">Unit Value</th>
                  <th className="py-3.5 px-5">Risk Factor</th>
                  <th className="py-3.5 px-5">Financial Exposure</th>
                  <th className="py-3.5 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8F6]/60">
                {inventoryRows.map((r) => (
                  <tr key={r.zone_id} className="hover:bg-[#F1F7FF] transition">
                    <td className="py-4 px-5 font-bold text-[#0F172A] text-base">{r.zone}</td>
                    <td className="py-4 px-5 text-base font-medium text-[#475569]">
                      {r.inventory_kg.toLocaleString()} kg
                    </td>
                    <td className="py-4 px-5 text-base font-semibold text-[#475569]">₹{r.cost_per_kg} / kg</td>
                    <td className="py-4 px-5">
                      <span
                        className={`text-base font-extrabold ${
                          r.risk >= 70 ? "text-rose-600" : r.risk >= 40 ? "text-amber-600" : "text-emerald-600"
                        }`}
                      >
                        {r.risk}%
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`font-extrabold text-base ${
                          r.financial_exposure > 5000
                            ? "text-rose-700"
                            : r.financial_exposure > 1000
                            ? "text-amber-700"
                            : "text-[#0F172A]"
                        }`}
                      >
                        ₹{r.financial_exposure.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                      </span>
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`text-xs font-bold rounded-full px-3 py-1 border ${
                          r.status === "critical"
                            ? "bg-rose-50 border-rose-200 text-rose-800"
                            : r.status === "warning"
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-emerald-50 border-emerald-200 text-emerald-800"
                        }`}
                      >
                        {r.status === "critical" ? "Critical Risk" : r.status === "warning" ? "Warning" : "Nominal"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent excursion events */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center gap-2.5">
          <TrendingUp size={20} className="text-[#2563EB]" />
          <h2 className="text-lg font-bold text-[#0F172A]">Recent Temperature Excursions</h2>
        </div>
        {loading ? (
          <div className="py-10 text-center text-base font-medium text-[#475569]">Loading excursion history…</div>
        ) : !events.length ? (
          <div className="py-10 text-center text-base font-medium text-[#475569]">
            No recent temperature excursions recorded.
          </div>
        ) : (
          <div className="divide-y divide-[#DCE8F6]/60">
            {events.slice(0, 8).map((ev: any, i: number) => (
              <div key={i} className="px-6 py-4 flex items-start gap-4 hover:bg-[#F1F7FF] transition">
                <div
                  className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ${
                    ev.event_type === "excursion" ? "bg-rose-500" : "bg-[#2563EB]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-[#0F172A]">{ev.title || ev.event_type}</div>
                  <div className="text-sm font-medium text-[#475569] mt-0.5">
                    {ev.zone_id} · {ev.sim_timestamp ? ev.sim_timestamp.slice(11, 19) : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
