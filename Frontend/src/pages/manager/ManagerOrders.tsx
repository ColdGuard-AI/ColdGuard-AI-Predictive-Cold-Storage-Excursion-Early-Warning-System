/* ─────────────────────────────────────────────────────────────────────────────
   Manager Dashboard — Order Management & Fulfillment Governance
   Premium Arctic Blue Design System
   Synchronized with Buyer / Retailer — Orders & Lot Quality
───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Package,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  FileSpreadsheet,
  RefreshCw,
  Building,
  FileText,
  Check,
  ShieldCheck,
  X,
  ExternalLink,
  ChevronDown,
  Thermometer,
  Calendar,
} from "lucide-react";
import { useApp } from "../../hooks/AppContext";

export interface ManagedOrder {
  id: string;
  poNumber: string;
  lotId: string;
  productName: string;
  category: "biologics" | "dairy" | "frozen";
  zoneId: string;
  zoneName: string;
  supplier: string;
  customerOrg: string;
  quantityUnits: string;
  grossValueUsd: number;
  grossValueInr: number;
  expectedDelivery: string;
  mandatedRange: string;
  spoilageThresholdC: number;
  status: "ACCEPTED" | "PENDING_INSPECTION" | "CONDITIONAL_HOLD" | "REJECTED_QUARANTINE";
  decisionNote?: string;
  acceptedAt?: string;
  acceptedBy?: string;
}

const INITIAL_ORDERS: ManagedOrder[] = [
  {
    id: "ORD-901",
    poNumber: "PO-2026-BIO-901",
    lotId: "LOT-BIO-2026-09A",
    productName: "COVID-19 mRNA Vaccine Vials (Comirnaty) & Insulin",
    category: "biologics",
    zoneId: "zone-a",
    zoneName: "Vaccine Store A",
    supplier: "Apex BioPharma Logistics",
    customerOrg: "Metro Health Hospital Network",
    quantityUnits: "4,200 Vials (21,000 Doses)",
    grossValueUsd: 186000,
    grossValueInr: 15438000,
    expectedDelivery: "Today, 14:00 Local",
    mandatedRange: "2.0°C to 8.0°C",
    spoilageThresholdC: 8.0,
    status: "PENDING_INSPECTION",
  },
  {
    id: "ORD-902",
    poNumber: "PO-2026-BIO-902",
    lotId: "LOT-BIO-PEDIATRIC",
    productName: "Pediatric MMR, Varicella & Rotavirus Cold-Chain Stock",
    category: "biologics",
    zoneId: "zone-a",
    zoneName: "Vaccine Store A",
    supplier: "Serum LifeSciences Hub",
    customerOrg: "State Public Health Depots",
    quantityUnits: "3,500 Doses",
    grossValueUsd: 74500,
    grossValueInr: 6183500,
    expectedDelivery: "Tomorrow, 09:30 Local",
    mandatedRange: "2.0°C to 8.0°C",
    spoilageThresholdC: 8.0,
    status: "PENDING_INSPECTION",
  },
  {
    id: "ORD-903",
    poNumber: "PO-2026-DRY-884",
    lotId: "LOT-DAIRY-884B",
    productName: "Pasteurized Whole Milk Cartons & Fresh Mozzarella",
    category: "dairy",
    zoneId: "zone-b",
    zoneName: "Dairy Chiller B",
    supplier: "Alpine Meadow Creameries",
    customerOrg: "FreshMart Global Supermarkets (12 Stores)",
    quantityUnits: "2,400 kg (1,800 Units)",
    grossValueUsd: 26500,
    grossValueInr: 2199500,
    expectedDelivery: "Today, 18:00 Local",
    mandatedRange: "0.0°C to 4.0°C",
    spoilageThresholdC: 6.0,
    status: "ACCEPTED",
    acceptedAt: "2026-10-24 21:15 UTC",
    acceptedBy: "Sarah Lin (Chief Procurement)",
  },
  {
    id: "ORD-904",
    poNumber: "PO-2026-CRYO-411",
    lotId: "LOT-CRYO-411C",
    productName: "Wild-Caught IQF Atlantic Salmon & Flash-Frozen Cod",
    category: "frozen",
    zoneId: "zone-c",
    zoneName: "Frozen Store C",
    supplier: "Nordic SeaHarvest Fleet",
    customerOrg: "Continental Gourmet Distributors",
    quantityUnits: "3,100 kg Bulk Cryo-Crates",
    grossValueUsd: 48000,
    grossValueInr: 3984000,
    expectedDelivery: "Oct 26, 08:00 Local",
    mandatedRange: "-22.0°C to -18.0°C",
    spoilageThresholdC: -15.0,
    status: "ACCEPTED",
    acceptedAt: "2026-10-24 19:40 UTC",
    acceptedBy: "Sarah Lin (Chief Procurement)",
  },
];

export default function ManagerOrders() {
  const { zones, zonesLoading, notify } = useApp();
  const [orders, setOrders] = useState<ManagedOrder[]>(() => {
    try {
      const saved = localStorage.getItem("coldguard_buyer_orders");
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_ORDERS;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING_INSPECTION" | "ACCEPTED" | "CONDITIONAL_HOLD" | "REJECTED_QUARANTINE"
  >("ALL");

  const [inspectModalOrder, setInspectModalOrder] = useState<ManagedOrder | null>(null);
  const [modalTargetStatus, setModalTargetStatus] = useState<
    "ACCEPTED" | "PENDING_INSPECTION" | "CONDITIONAL_HOLD" | "REJECTED_QUARANTINE"
  >("ACCEPTED");
  const [decisionNotes, setDecisionNotes] = useState("");

  const syncOrders = () => {
    try {
      const saved = localStorage.getItem("coldguard_buyer_orders");
      if (saved) {
        setOrders(JSON.parse(saved));
      }
    } catch {}
  };

  useEffect(() => {
    syncOrders();
    window.addEventListener("storage", syncOrders);
    window.addEventListener("coldguard_orders_updated", syncOrders);
    return () => {
      window.removeEventListener("storage", syncOrders);
      window.removeEventListener("coldguard_orders_updated", syncOrders);
    };
  }, []);

  // Update order status and persist to localStorage
  function updateOrderStatus(
    orderId: string,
    newStatus: "ACCEPTED" | "PENDING_INSPECTION" | "CONDITIONAL_HOLD" | "REJECTED_QUARANTINE",
    note?: string
  ) {
    const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    const updated = orders.map((o) => {
      if (o.id !== orderId) return o;
      return {
        ...o,
        status: newStatus,
        decisionNote:
          note ||
          (newStatus === "ACCEPTED"
            ? "Completed: Released and authorized for dock dispatch by Cold Storage Manager."
            : newStatus === "PENDING_INSPECTION"
            ? "Status reset to Pending Inspection by Cold Storage Manager."
            : newStatus === "CONDITIONAL_HOLD"
            ? "Thermal Hold placed by Manager pending chamber stabilization."
            : "Quarantine mandated by Manager due to thermal non-compliance."),
        acceptedAt: newStatus === "ACCEPTED" ? now : o.acceptedAt,
        acceptedBy: newStatus === "ACCEPTED" ? "Elena Rostova (Cold Storage Manager)" : o.acceptedBy,
      };
    });

    setOrders(updated);
    try {
      localStorage.setItem("coldguard_buyer_orders", JSON.stringify(updated));
      window.dispatchEvent(new Event("coldguard_orders_updated"));
    } catch {}

    const statusLabels: Record<string, string> = {
      ACCEPTED: "Completed / Released",
      PENDING_INSPECTION: "Pending Inspection",
      CONDITIONAL_HOLD: "Thermal Hold",
      REJECTED_QUARANTINE: "Quarantined",
    };

    notify(
      newStatus === "ACCEPTED" ? "success" : newStatus === "PENDING_INSPECTION" ? "info" : "error",
      `Order status updated to: ${statusLabels[newStatus]}`
    );

    setInspectModalOrder(null);
    setDecisionNotes("");
  }

  // Enrich orders with live chamber telemetry
  const enrichedOrders = orders.map((ord) => {
    const z = (zones ?? []).find((zone: any) => zone.zone_id === ord.zoneId);
    const temp = z?.temperature ?? (z as any)?.temp ?? null;
    const isExcursion = temp != null && temp > ord.spoilageThresholdC;
    return {
      ...ord,
      liveTemp: temp,
      riskScore: z?.risk_score ?? 0,
      isExcursion,
      zoneStatus: (z as any)?.status ?? (z as any)?.temperature_status ?? "SAFE",
    };
  });

  // Filtered orders
  const filteredOrders = enrichedOrders.filter((ord) => {
    const matchesFilter = statusFilter === "ALL" || ord.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      ord.poNumber.toLowerCase().includes(q) ||
      ord.lotId.toLowerCase().includes(q) ||
      ord.productName.toLowerCase().includes(q) ||
      ord.customerOrg.toLowerCase().includes(q) ||
      ord.zoneName.toLowerCase().includes(q) ||
      ord.supplier.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const pendingCount = enrichedOrders.filter((o) => o.status === "PENDING_INSPECTION").length;
  const completedCount = enrichedOrders.filter((o) => o.status === "ACCEPTED").length;
  const holdCount = enrichedOrders.filter((o) => o.status === "CONDITIONAL_HOLD").length;
  const quarantineCount = enrichedOrders.filter((o) => o.status === "REJECTED_QUARANTINE").length;
  const totalValueUsd = enrichedOrders.reduce((sum, o) => sum + (o.grossValueUsd || 0), 0);

  function exportOrdersCsv() {
    const headers = [
      "PO Number",
      "Lot ID",
      "Customer Organization",
      "Product",
      "Storage Bay",
      "Value (USD)",
      "Mandated Range",
      "Status",
      "Accepted At",
      "Accepted By",
      "Decision Notes",
    ];
    const rows = enrichedOrders.map((o) => [
      o.poNumber,
      o.lotId,
      `"${o.customerOrg}"`,
      `"${o.productName}"`,
      `"${o.zoneName}"`,
      o.grossValueUsd,
      `"${o.mandatedRange}"`,
      o.status,
      o.acceptedAt || "",
      o.acceptedBy || "",
      `"${o.decisionNote || ""}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ColdGuard_Order_Management_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Banner
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <ShoppingBag size={28} className="text-[#2563EB]" /> Purchase Order Management
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">
            Manage buyer & retailer purchase orders across pending and completed stages with live chamber compliance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportOrdersCsv}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] px-4 py-2.5 text-sm sm:text-base font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
          >
            <FileSpreadsheet size={16} className="text-[#2563EB]" /> Export Manifest CSV
          </button>
          <button
            onClick={syncOrders}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] px-4 py-2.5 text-sm sm:text-base font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={16} className={`text-[#2563EB] ${zonesLoading ? "animate-spin" : ""}`} /> Refresh Sync
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KPI Stat Cards
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[#475569] uppercase tracking-wider">Total Customer Orders</span>
            <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center text-[#2563EB]">
              <Package size={20} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#0F172A]">{enrichedOrders.length}</div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">
            ${totalValueUsd.toLocaleString()} USD Total Exposure
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-amber-800 uppercase tracking-wider">Pending Inspection</span>
            <div className="h-10 w-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-800">
              <Clock size={20} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-amber-900">{pendingCount}</div>
          <div className="text-xs font-semibold text-amber-700 mt-1">Awaiting manager GxP clearance for dispatch</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-emerald-800 uppercase tracking-wider">Completed / Released</span>
            <div className="h-10 w-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-900">{completedCount}</div>
          <div className="text-xs font-semibold text-emerald-700 mt-1">Cleared and authorized for dock logistics</div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-rose-800 uppercase tracking-wider">Hold / Quarantined</span>
            <div className="h-10 w-10 rounded-xl bg-rose-100 border border-rose-300 flex items-center justify-center text-rose-700">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-900">{holdCount + quarantineCount}</div>
          <div className="text-xs font-semibold text-rose-700 mt-1">
            {holdCount} on Thermal Hold · {quarantineCount} Quarantined
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Order Table with Filter & Search
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        {/* Table Controls */}
        <div className="px-6 py-5 border-b border-[#DCE8F6] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "ALL", label: `All Orders (${enrichedOrders.length})` },
              { key: "PENDING_INSPECTION", label: `Pending (${pendingCount})` },
              { key: "ACCEPTED", label: `Completed / Released (${completedCount})` },
              { key: "CONDITIONAL_HOLD", label: `Thermal Hold (${holdCount})` },
              { key: "REJECTED_QUARANTINE", label: `Quarantined (${quarantineCount})` },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                  statusFilter === tab.key
                    ? "bg-[#2563EB] text-white shadow-sm"
                    : "bg-[#F8FAFC] text-[#475569] hover:bg-[#EFF6FF] hover:text-[#2563EB] border border-[#E2E8F0]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[280px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO, Customer, Lot, Bay…"
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] text-sm font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Table Body */}
        {!filteredOrders.length ? (
          <div className="py-20 text-center text-sm font-medium text-[#64748B]">
            No purchase orders matching the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] border-b border-[#DCE8F6] text-xs font-bold uppercase tracking-wider text-[#64748B]">
                <tr>
                  <th className="px-5 py-3.5">PO & Delivery</th>
                  <th className="px-5 py-3.5">Customer Organization</th>
                  <th className="px-5 py-3.5">Commodity / Chamber Bay</th>
                  <th className="px-5 py-3.5">Volume & Value</th>
                  <th className="px-5 py-3.5">Chamber Telemetry</th>
                  <th className="px-5 py-3.5">Current Status</th>
                  <th className="px-5 py-3.5 text-right">Manager Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {filteredOrders.map((ord) => {
                  const statusColors: Record<string, string> = {
                    PENDING_INSPECTION: "bg-amber-50 text-amber-800 border-amber-300",
                    ACCEPTED: "bg-emerald-50 text-emerald-800 border-emerald-300",
                    CONDITIONAL_HOLD: "bg-orange-50 text-orange-800 border-orange-300",
                    REJECTED_QUARANTINE: "bg-rose-50 text-rose-800 border-rose-300",
                  };

                  const statusLabels: Record<string, string> = {
                    PENDING_INSPECTION: "Pending Inspection",
                    ACCEPTED: "Completed / Released",
                    CONDITIONAL_HOLD: "Thermal Hold",
                    REJECTED_QUARANTINE: "Quarantined",
                  };

                  return (
                    <tr key={ord.id} className="hover:bg-[#F8FAFC] transition">
                      {/* PO Number & Delivery */}
                      <td className="px-5 py-4">
                        <div className="font-extrabold text-[#0F172A] flex items-center gap-1.5">
                          <FileText size={15} className="text-[#2563EB]" /> {ord.poNumber}
                        </div>
                        <div className="text-xs font-medium text-[#64748B] mt-0.5">
                          Delivery: {ord.expectedDelivery}
                        </div>
                      </td>

                      {/* Customer Organization */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-[#0F172A] flex items-center gap-1.5">
                          <Building size={14} className="text-slate-400" /> {ord.customerOrg}
                        </div>
                        <div className="text-xs font-medium text-[#64748B] mt-0.5">
                          Supplier: {ord.supplier}
                        </div>
                      </td>

                      {/* Product & Staged Bay */}
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#0F172A] line-clamp-1 max-w-[220px]" title={ord.productName}>
                          {ord.productName}
                        </div>
                        <div className="text-xs font-medium text-[#64748B] mt-0.5">
                          Bay: <span className="font-bold text-[#0F172A]">{ord.zoneName}</span> · {ord.lotId}
                        </div>
                      </td>

                      {/* Value & Quantity */}
                      <td className="px-5 py-4">
                        <div className="font-extrabold text-[#0F172A]">
                          ${ord.grossValueUsd.toLocaleString()} USD
                        </div>
                        <div className="text-xs font-medium text-[#64748B] mt-0.5">
                          {ord.quantityUnits}
                        </div>
                      </td>

                      {/* Live Telemetry */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-[#0F172A]">
                            {ord.liveTemp !== null ? `${Number(ord.liveTemp).toFixed(1)}°C` : "Monitoring"}
                          </span>
                          {ord.isExcursion ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              Breach
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Optimal
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-medium text-[#64748B] mt-0.5">
                          Limit: {ord.mandatedRange}
                        </div>
                      </td>

                      {/* Current Status Pill */}
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${
                            statusColors[ord.status] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {statusLabels[ord.status] || ord.status}
                        </span>
                        {ord.acceptedBy && (
                          <div className="text-[10px] font-medium text-[#64748B] mt-1 line-clamp-1">
                            by {ord.acceptedBy}
                          </div>
                        )}
                      </td>

                      {/* Quick Manager Actions */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Set Completed */}
                          {ord.status !== "ACCEPTED" && (
                            <button
                              onClick={() => updateOrderStatus(ord.id, "ACCEPTED")}
                              title="Mark as Completed / Released"
                              className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition cursor-pointer text-xs font-bold flex items-center gap-1 shadow-sm"
                            >
                              <Check size={14} /> Completed
                            </button>
                          )}

                          {/* Set Pending */}
                          {ord.status !== "PENDING_INSPECTION" && (
                            <button
                              onClick={() => updateOrderStatus(ord.id, "PENDING_INSPECTION")}
                              title="Mark as Pending Inspection"
                              className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white transition cursor-pointer text-xs font-bold flex items-center gap-1 shadow-sm"
                            >
                              <Clock size={14} /> Pending
                            </button>
                          )}

                          {/* Set Hold */}
                          {ord.status !== "CONDITIONAL_HOLD" && (
                            <button
                              onClick={() => updateOrderStatus(ord.id, "CONDITIONAL_HOLD")}
                              title="Place on Thermal Hold"
                              className="p-1.5 rounded-lg border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-600 hover:text-white transition cursor-pointer shadow-sm"
                            >
                              <AlertTriangle size={15} />
                            </button>
                          )}

                          {/* Set Quarantine */}
                          {ord.status !== "REJECTED_QUARANTINE" && (
                            <button
                              onClick={() => updateOrderStatus(ord.id, "REJECTED_QUARANTINE")}
                              title="Mandate Quarantine"
                              className="p-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition cursor-pointer shadow-sm"
                            >
                              <XCircle size={15} />
                            </button>
                          )}

                          {/* Custom Review Modal */}
                          <button
                            onClick={() => {
                              setInspectModalOrder(ord);
                              setModalTargetStatus(ord.status);
                              setDecisionNotes(ord.decisionNote || "");
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] text-[#2563EB] text-xs font-bold transition cursor-pointer"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. Detailed Review & Status Override Modal
      ───────────────────────────────────────────────────────────── */}
      {inspectModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#DCE8F6] max-w-xl w-full p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] flex items-center justify-center text-[#2563EB]">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#0F172A]">Manager Order Status Override</h3>
                  <p className="text-xs font-semibold text-[#64748B]">
                    PO: <span className="text-[#0F172A] font-bold">{inspectModalOrder.poNumber}</span> · {inspectModalOrder.customerOrg}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectModalOrder(null)}
                className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Order Details Brief */}
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="font-bold text-[#64748B]">Product / SKU:</span>
                <span className="font-extrabold text-[#0F172A]">{inspectModalOrder.productName} ({inspectModalOrder.lotId})</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-[#64748B]">Staged Storage Bay:</span>
                <span className="font-extrabold text-[#0F172A]">{inspectModalOrder.zoneName} (Safe Range: {inspectModalOrder.mandatedRange})</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-[#64748B]">Gross Commercial Value:</span>
                <span className="font-extrabold text-[#0F172A]">
                  ${inspectModalOrder.grossValueUsd.toLocaleString()} USD (₹{inspectModalOrder.grossValueInr.toLocaleString("en-IN")})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-[#64748B]">Expected Outbound Delivery:</span>
                <span className="font-extrabold text-[#0F172A]">{inspectModalOrder.expectedDelivery}</span>
              </div>
            </div>

            {/* Target Status Selector */}
            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                Set Order Lifecycle Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: "PENDING_INSPECTION", label: "Pending", icon: Clock, color: "amber" },
                  { key: "ACCEPTED", label: "Completed", icon: CheckCircle2, color: "emerald" },
                  { key: "CONDITIONAL_HOLD", label: "Thermal Hold", icon: AlertTriangle, color: "orange" },
                  { key: "REJECTED_QUARANTINE", label: "Quarantine", icon: XCircle, color: "rose" },
                ].map((s) => {
                  const isSelected = modalTargetStatus === s.key;
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setModalTargetStatus(s.key as any)}
                      className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center gap-1 ${
                        isSelected
                          ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-2 ring-[#BAE6FD]"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-xs font-bold">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Notes */}
            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                Manager Inspection Notes / Justification
              </label>
              <textarea
                rows={3}
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="Enter GxP clearance notes, dock dispatch timestamp, or reason for thermal hold..."
                className="w-full p-3 rounded-xl border border-[#CBD5E1] bg-white text-xs font-medium text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setInspectModalOrder(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateOrderStatus(inspectModalOrder.id, modalTargetStatus, decisionNotes)}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow-md transition cursor-pointer flex items-center gap-1.5"
              >
                <Check size={16} /> Save & Apply Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
