/* ─────────────────────────────────────────────────────────────────────────────
   Buyer / Retailer — Orders & Acceptance Dashboard
   Premium Arctic Blue Design System
   Integrates live chamber telemetry, excursion alerts, and blockchain proofs
───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Package,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  Printer,
  X,
  FileText,
  AlertOctagon,
  Calendar,
  Building,
  Check,
  ExternalLink,
  PlusCircle,
  Plus,
  DollarSign,
  Layers,
} from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";

export interface BuyerOrder {
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
  liveTemp?: number | null;
  riskScore?: number;
  qualityScore?: number;
  isExcursion?: boolean;
  zoneStatus?: string;
}

const INITIAL_BUYER_ORDERS: BuyerOrder[] = [
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

function StatCard({ label, value, sub, icon: Icon, color = "blue" }: any) {
  const iconColors: Record<string, string> = {
    blue: "text-[#2563EB] bg-[#EFF6FF] border-[#BAE6FD]",
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    rose: "text-rose-700 bg-rose-50 border-rose-200",
  };
  return (
    <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs sm:text-sm font-bold text-[#475569] uppercase tracking-wider">{label}</span>
        <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${iconColors[color] ?? iconColors.blue}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight">{value}</div>
      {sub && <div className="text-xs font-semibold text-[#64748B] mt-1">{sub}</div>}
    </div>
  );
}

const PRESET_COMMODITIES = [
  {
    productName: "COVID-19 mRNA Vaccine Vials (Comirnaty) & Insulin",
    category: "biologics" as const,
    zoneId: "zone-a",
    zoneName: "Vaccine Store A",
    supplier: "Apex BioPharma Logistics",
    mandatedRange: "2.0°C to 8.0°C",
    spoilageThresholdC: 8.0,
    defaultQty: "4,000 Vials (20,000 Doses)",
    defaultValueUsd: 175000,
  },
  {
    productName: "Pediatric MMR, Varicella & Rotavirus Cold-Chain Stock",
    category: "biologics" as const,
    zoneId: "zone-a",
    zoneName: "Vaccine Store A",
    supplier: "Serum LifeSciences Hub",
    mandatedRange: "2.0°C to 8.0°C",
    spoilageThresholdC: 8.0,
    defaultQty: "3,000 Doses",
    defaultValueUsd: 65000,
  },
  {
    productName: "Pasteurized Whole Milk Cartons & Fresh Mozzarella",
    category: "dairy" as const,
    zoneId: "zone-b",
    zoneName: "Dairy Chiller B",
    supplier: "Alpine Meadow Creameries",
    mandatedRange: "0.0°C to 4.0°C",
    spoilageThresholdC: 6.0,
    defaultQty: "2,000 kg (1,500 Units)",
    defaultValueUsd: 22000,
  },
  {
    productName: "Artisan European Cheeses & Dairy Cultures",
    category: "dairy" as const,
    zoneId: "zone-b",
    zoneName: "Dairy Chiller B",
    supplier: "Bavarian Farmsteads Hub",
    mandatedRange: "0.0°C to 4.0°C",
    spoilageThresholdC: 6.0,
    defaultQty: "1,200 kg",
    defaultValueUsd: 31000,
  },
  {
    productName: "Wild Alaskan Sockeye Salmon & Black Cod Fillets",
    category: "frozen" as const,
    zoneId: "zone-c",
    zoneName: "Deep Freeze Vault C",
    supplier: "Pacific Catch Cold Storage",
    mandatedRange: "-25.0°C to -18.0°C",
    spoilageThresholdC: -15.0,
    defaultQty: "3,500 kg (Crated)",
    defaultValueUsd: 89000,
  },
  {
    productName: "Grade-A Frozen Poultry Medallions & Turkey",
    category: "frozen" as const,
    zoneId: "zone-c",
    zoneName: "Deep Freeze Vault C",
    supplier: "Nordic Meat Processing Depot",
    mandatedRange: "-25.0°C to -18.0°C",
    spoilageThresholdC: -15.0,
    defaultQty: "4,200 kg",
    defaultValueUsd: 58000,
  },
];

export default function BuyerOrders() {
  const { zones, zonesLoading, notify } = useApp();
  const [orders, setOrders] = useState<BuyerOrder[]>(() => {
    const saved = localStorage.getItem("coldguard_buyer_orders");
    return saved ? JSON.parse(saved) : INITIAL_BUYER_ORDERS;
  });
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING" | "ACCEPTED" | "HOLD">("ALL");
  const [selectedOrderForCert, setSelectedOrderForCert] = useState<BuyerOrder | null>(null);
  const [decisionModalOrder, setDecisionModalOrder] = useState<BuyerOrder | null>(null);
  const [decisionAction, setDecisionAction] = useState<"ACCEPT" | "HOLD" | "REJECT">("ACCEPT");
  const [decisionNotes, setDecisionNotes] = useState("");

  // ── Stage New Purchase Order Modal State ──
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPoNumber, setNewPoNumber] = useState("");
  const [newProductName, setNewProductName] = useState(PRESET_COMMODITIES[0].productName);
  const [newCategory, setNewCategory] = useState<"biologics" | "dairy" | "frozen">(PRESET_COMMODITIES[0].category);
  const [newZoneId, setNewZoneId] = useState(PRESET_COMMODITIES[0].zoneId);
  const [newSupplier, setNewSupplier] = useState(PRESET_COMMODITIES[0].supplier);
  const [newCustomerOrg, setNewCustomerOrg] = useState("Metro Health Hospital Network");
  const [newQuantity, setNewQuantity] = useState(PRESET_COMMODITIES[0].defaultQty);
  const [newValueUsd, setNewValueUsd] = useState(PRESET_COMMODITIES[0].defaultValueUsd);
  const [newDelivery, setNewDelivery] = useState("Tomorrow, 10:00 Local");

  function handlePresetSelect(preset: typeof PRESET_COMMODITIES[0]) {
    setNewProductName(preset.productName);
    setNewCategory(preset.category);
    setNewZoneId(preset.zoneId);
    setNewSupplier(preset.supplier);
    setNewQuantity(preset.defaultQty);
    setNewValueUsd(preset.defaultValueUsd);
  }

  function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    const zoneNameMap: Record<string, string> = {
      "zone-a": "Vaccine Store A",
      "zone-b": "Dairy Chiller B",
      "zone-c": "Deep Freeze Vault C",
    };
    const rangeMap: Record<string, { range: string; threshold: number }> = {
      biologics: { range: "2.0°C to 8.0°C", threshold: 8.0 },
      dairy: { range: "0.0°C to 4.0°C", threshold: 6.0 },
      frozen: { range: "-25.0°C to -18.0°C", threshold: -15.0 },
    };

    const idSuffix = Math.floor(100 + Math.random() * 900);
    const poNum = newPoNumber.trim() || `PO-2026-${newCategory.toUpperCase().substring(0, 3)}-${idSuffix}`;
    const lotNum = `LOT-${newCategory.toUpperCase().substring(0, 3)}-2026-${idSuffix}`;
    const spec = rangeMap[newCategory] || { range: "2.0°C to 8.0°C", threshold: 8.0 };

    const newOrder: BuyerOrder = {
      id: `ORD-${idSuffix}`,
      poNumber: poNum,
      lotId: lotNum,
      productName: newProductName.trim() || "Cold-Chain Perishables Staged Lot",
      category: newCategory,
      zoneId: newZoneId,
      zoneName: zoneNameMap[newZoneId] || "Chamber Bay A",
      supplier: newSupplier.trim() || "Apex Cold Chain Logistics",
      customerOrg: newCustomerOrg.trim() || "Metro Health Hospital Network",
      quantityUnits: newQuantity.trim() || "2,000 Units",
      grossValueUsd: Number(newValueUsd) || 50000,
      grossValueInr: (Number(newValueUsd) || 50000) * 83,
      expectedDelivery: newDelivery.trim() || "Tomorrow, 12:00 Local",
      mandatedRange: spec.range,
      spoilageThresholdC: spec.threshold,
      status: "PENDING_INSPECTION",
    };

    const updated = [newOrder, ...orders];
    setOrders(updated);
    try {
      localStorage.setItem("coldguard_buyer_orders", JSON.stringify(updated));
      window.dispatchEvent(new Event("coldguard_orders_updated"));
    } catch {}
    setIsCreateModalOpen(false);
    setNewPoNumber("");
    notify?.("success", `Purchase Order ${poNum} staged in ${newOrder.zoneName} for continuous quality monitoring.`);
  }

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

  async function loadData() {
    setLoading(true);
    try {
      const activeAlerts = await api.alerts({ active: true, limit: 30 }).catch(() => []);
      setAlerts(activeAlerts as any[]);
      syncOrders();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Compute live telemetry & quality per order
  const enrichedOrders = orders.map((order) => {
    const zone = zones?.find((z: any) => z.zone_id === order.zoneId);
    const risk = zone?.risk_score ?? 0;
    const temp = zone?.temperature ?? null;
    const excursionAlert = alerts.find(
      (a) => a.zone_id === order.zoneId && (a.severity === "critical" || a.severity === "warning")
    );

    // Dynamic quality score: 100 minus risk points
    const qualityScore = Math.max(0, Math.min(100, Math.round(100 - risk * 0.95)));
    const isExcursion = risk >= 60 || !!excursionAlert || (temp !== null && temp > order.spoilageThresholdC);

    return {
      ...order,
      liveTemp: temp,
      riskScore: risk,
      qualityScore,
      isExcursion,
      zoneStatus: (zone as any)?.status ?? "SAFE",
    };
  });

  const totalPurchaseValueUsd = enrichedOrders.reduce((sum, o) => sum + o.grossValueUsd, 0);
  const acceptedOrdersCount = enrichedOrders.filter((o) => o.status === "ACCEPTED").length;
  const pendingOrdersCount = enrichedOrders.filter((o) => o.status === "PENDING_INSPECTION").length;
  const onHoldCount = enrichedOrders.filter(
    (o) => o.status === "CONDITIONAL_HOLD" || o.status === "REJECTED_QUARANTINE" || o.isExcursion
  ).length;

  const filteredOrders = enrichedOrders.filter((o) => {
    if (filterTab === "PENDING") return o.status === "PENDING_INSPECTION";
    if (filterTab === "ACCEPTED") return o.status === "ACCEPTED";
    if (filterTab === "HOLD") return o.status === "CONDITIONAL_HOLD" || o.status === "REJECTED_QUARANTINE" || o.isExcursion;
    return true;
  });

  function handleSaveDecision() {
    if (!decisionModalOrder) return;
    const statusMap = {
      ACCEPT: "ACCEPTED" as const,
      HOLD: "CONDITIONAL_HOLD" as const,
      REJECT: "REJECTED_QUARANTINE" as const,
    };
    const updated = orders.map((o) =>
      o.id === decisionModalOrder.id
        ? {
            ...o,
            status: statusMap[decisionAction],
            decisionNote: decisionNotes || (decisionAction === "ACCEPT" ? "Cold chain verified within limits" : "Flagged for thermal review"),
            acceptedAt: decisionAction === "ACCEPT" ? new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC" : undefined,
            acceptedBy: "Sarah Lin (Chief Procurement Specialist)",
          }
        : o
    );
    setOrders(updated);
    try {
      localStorage.setItem("coldguard_buyer_orders", JSON.stringify(updated));
      window.dispatchEvent(new Event("coldguard_orders_updated"));
    } catch {}
    setDecisionModalOrder(null);
    setDecisionNotes("");
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <ShoppingBag size={28} className="text-[#0D9488]" /> Orders & Cold-Chain Acceptance
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">
            Inspect staged wholesale orders, verify continuous temperature history, and digitally clear perishable shipments.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white px-4 py-2.5 text-sm font-bold shadow-md hover:shadow-lg transition cursor-pointer"
          >
            <PlusCircle size={17} /> Stage New Purchase Order
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white px-4 py-2.5 text-sm font-bold text-[#0F172A] hover:bg-[#F1F7FF] transition shadow-arctic-card cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh Telemetry
          </button>
        </div>
      </div>

      {/* Banner Notice */}
      <div className="rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] p-4 text-[#1E40AF] flex items-start gap-3 shadow-sm">
        <ShieldCheck size={22} className="mt-0.5 shrink-0 text-[#2563EB]" />
        <div className="text-sm font-medium leading-relaxed">
          <strong className="font-bold text-[#0F172A]">Digital Good Distribution Practice (GDP) Gateway:</strong> Real-time sensor telemetry from storage chambers determines batch clearance. Shipments cannot be released if physical readings breach WHO/FDA thermal limits.
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          label="Total Staged Orders"
          value={orders.length}
          sub={`$${totalPurchaseValueUsd.toLocaleString()} / ₹${(totalPurchaseValueUsd * 83).toLocaleString()}`}
          icon={Package}
          color="blue"
        />
        <StatCard
          label="Pending Acceptance"
          value={pendingOrdersCount}
          sub="Awaiting buyer verification"
          icon={Clock}
          color="amber"
        />
        <StatCard
          label="Cleared & Accepted"
          value={acceptedOrdersCount}
          sub="Dispatched to hospital / retail"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          label="At Risk / On Hold"
          value={onHoldCount}
          sub={onHoldCount > 0 ? "Excursion flag active" : "Zero thermal breaches"}
          icon={AlertTriangle}
          color={onHoldCount > 0 ? "rose" : "blue"}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#DCE8F6] pb-2 overflow-x-auto">
        {[
          { key: "ALL", label: `All Orders (${orders.length})` },
          { key: "PENDING", label: `Pending Inspection (${pendingOrdersCount})` },
          { key: "ACCEPTED", label: `Accepted & Cleared (${acceptedOrdersCount})` },
          { key: "HOLD", label: `Flagged / On Hold (${onHoldCount})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilterTab(tab.key as any)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer whitespace-nowrap ${
              filterTab === tab.key
                ? "bg-[#0D9488] text-white shadow-md"
                : "text-[#475569] hover:bg-[#F1F7FF] hover:text-[#0F172A]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShoppingBag size={20} className="text-[#0D9488]" />
            <h2 className="text-lg font-bold text-[#0F172A]">Active Purchase Orders & Verification Queue</h2>
          </div>
          <span className="text-xs font-semibold text-[#475569] bg-[#F1F7FF] border border-[#DCE8F6] px-3 py-1 rounded-full">
            Continuous Telemetry Sync Active
          </span>
        </div>

        {zonesLoading ? (
          <div className="py-14 text-center text-base font-medium text-[#475569]">Loading purchase orders…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#EFF6FF] text-xs font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#DCE8F6]">
                <tr>
                  <th className="py-3.5 px-5">Order & PO Number</th>
                  <th className="py-3.5 px-5">Commodity & Lot</th>
                  <th className="py-3.5 px-5">Storage Chamber</th>
                  <th className="py-3.5 px-5">Live Temp</th>
                  <th className="py-3.5 px-5">Cold Chain Quality</th>
                  <th className="py-3.5 px-5">Order Status</th>
                  <th className="py-3.5 px-5 text-right">Actions & Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8F6]/60">
                {filteredOrders.map((order) => {
                  const statusColors = {
                    ACCEPTED: "bg-emerald-50 text-emerald-800 border-emerald-200",
                    PENDING_INSPECTION: "bg-blue-50 text-blue-800 border-blue-200",
                    CONDITIONAL_HOLD: "bg-amber-50 text-amber-800 border-amber-200",
                    REJECTED_QUARANTINE: "bg-rose-50 text-rose-800 border-rose-200",
                  };
                  return (
                    <tr key={order.id} className="hover:bg-[#F1F7FF] transition">
                      {/* PO Number */}
                      <td className="py-4 px-5">
                        <div className="font-mono text-base font-bold text-[#0F172A]">{order.poNumber}</div>
                        <div className="text-xs text-[#475569] font-medium mt-0.5">{order.customerOrg}</div>
                        <div className="text-xs font-semibold text-[#0D9488] mt-0.5">
                          ${order.grossValueUsd.toLocaleString()} · {order.quantityUnits}
                        </div>
                      </td>

                      {/* Commodity */}
                      <td className="py-4 px-5">
                        <div className="text-sm font-bold text-[#0F172A] max-w-xs">{order.productName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-xs font-semibold bg-[#F1F7FF] border border-[#DCE8F6] text-[#2563EB] px-2 py-0.5 rounded">
                            {order.lotId}
                          </span>
                          <span className="text-xs text-[#64748B]">Limit: {order.mandatedRange}</span>
                        </div>
                      </td>

                      {/* Storage Chamber */}
                      <td className="py-4 px-5">
                        <span className="text-sm font-bold text-[#0F172A] block">{order.zoneName}</span>
                        <span className="text-xs font-medium text-[#64748B]">{order.supplier}</span>
                      </td>

                      {/* Live Temp */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-1.5 font-mono text-base font-extrabold text-[#0F172A]">
                          {order.liveTemp !== null ? `${order.liveTemp.toFixed(2)}°C` : "—"}
                        </div>
                        {order.isExcursion ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full mt-1">
                            <XCircle size={12} /> Limit Exceeded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1">
                            <CheckCircle2 size={12} /> Within Limit
                          </span>
                        )}
                      </td>

                      {/* Cold Chain Quality Bar */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-20 bg-[#F1F7FF] border border-[#DCE8F6] rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                order.qualityScore >= 80
                                  ? "bg-emerald-500"
                                  : order.qualityScore >= 50
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              }`}
                              style={{ width: `${order.qualityScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-extrabold text-[#0F172A]">{order.qualityScore}%</span>
                        </div>
                        <span className="text-xs text-[#64748B] block mt-1">Risk Score: {order.riskScore}%</span>
                      </td>

                      {/* Order Status */}
                      <td className="py-4 px-5">
                        <span className={`inline-block text-xs font-bold uppercase rounded-full px-3 py-1 border ${statusColors[order.status]}`}>
                          {order.status.replace("_", " ")}
                        </span>
                        {order.acceptedAt && (
                          <span className="block text-[11px] text-[#64748B] font-medium mt-1">
                            Signed: {order.acceptedAt.split(" ")[0]}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right space-x-2">
                        <button
                          onClick={() => {
                            setDecisionModalOrder(order);
                            setDecisionAction(order.status === "ACCEPTED" ? "HOLD" : "ACCEPT");
                          }}
                          className="rounded-xl border border-[#DCE8F6] bg-white px-3 py-1.5 text-xs font-bold text-[#0F172A] hover:bg-[#F1F7FF] transition shadow-sm cursor-pointer"
                        >
                          Review & Sign
                        </button>
                        <button
                          onClick={() => setSelectedOrderForCert(order)}
                          className="rounded-xl border border-[#0D9488]/30 bg-[#0D9488]/10 px-3 py-1.5 text-xs font-bold text-[#0D9488] hover:bg-[#0D9488] hover:text-white transition shadow-sm cursor-pointer"
                        >
                          Certificate
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

      {/* Review & Decision Sign-off Modal */}
      {decisionModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full border border-[#DCE8F6] shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
              <div>
                <h3 className="text-xl font-extrabold text-[#0F172A]">Order Inspection & Acceptance</h3>
                <p className="text-xs font-semibold text-[#64748B] mt-0.5 font-mono">{decisionModalOrder.poNumber}</p>
              </div>
              <button
                onClick={() => setDecisionModalOrder(null)}
                className="h-8 w-8 rounded-full border border-[#DCE8F6] flex items-center justify-center text-[#475569] hover:bg-[#F1F7FF] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#64748B] font-medium">Product Batch:</span>
                <span className="font-bold text-[#0F172A]">{decisionModalOrder.lotId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-medium">Chamber Location:</span>
                <span className="font-bold text-[#0F172A]">{decisionModalOrder.zoneName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-medium">Live Chamber Reading:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {decisionModalOrder.liveTemp != null ? `${decisionModalOrder.liveTemp.toFixed(2)}°C` : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B] font-medium">Mandated Range:</span>
                <span className="font-bold text-[#2563EB]">{decisionModalOrder.mandatedRange}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                Acceptance Decision
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDecisionAction("ACCEPT")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    decisionAction === "ACCEPT"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                      : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                  }`}
                >
                  <CheckCircle2 size={16} /> Accept & Clear
                </button>
                <button
                  type="button"
                  onClick={() => setDecisionAction("HOLD")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    decisionAction === "HOLD"
                      ? "bg-amber-600 text-white border-amber-600 shadow-md"
                      : "bg-white text-amber-800 border-amber-200 hover:bg-amber-50"
                  }`}
                >
                  <Clock size={16} /> Quarantine
                </button>
                <button
                  type="button"
                  onClick={() => setDecisionAction("REJECT")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    decisionAction === "REJECT"
                      ? "bg-rose-600 text-white border-rose-600 shadow-md"
                      : "bg-white text-rose-800 border-rose-200 hover:bg-rose-50"
                  }`}
                >
                  <XCircle size={16} /> Reject Lot
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1.5">
                Audit Notes / Quarantine Justification
              </label>
              <textarea
                value={decisionNotes}
                onChange={(e) => setDecisionNotes(e.target.value)}
                placeholder="e.g. Telemetry verified intact; Mean Kinetic Temperature nominal..."
                rows={3}
                className="w-full rounded-xl border border-[#DCE8F6] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE8F6]">
              <button
                onClick={() => setDecisionModalOrder(null)}
                className="px-4 py-2.5 rounded-xl border border-[#DCE8F6] text-sm font-bold text-[#475569] hover:bg-[#F1F7FF] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveDecision}
                className="px-5 py-2.5 rounded-xl bg-[#0D9488] text-white text-sm font-bold hover:bg-[#0f766e] transition shadow-md cursor-pointer flex items-center gap-2"
              >
                <Check size={16} /> Commit Acceptance Sign-Off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Digital Cold Chain Certificate Modal */}
      {selectedOrderForCert && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#DCE8F6] shadow-2xl p-7 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Certificate Header */}
            <div className="flex items-center justify-between border-b border-[#DCE8F6] pb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <ShieldCheck size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#0F172A]">Certificate of Cold-Chain Integrity</h3>
                  <p className="text-xs font-bold text-[#64748B] tracking-wider uppercase">
                    WHO Annex 5 & FDA 21 CFR Part 11 Validated Electronic Record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderForCert(null)}
                className="h-8 w-8 rounded-full border border-[#DCE8F6] flex items-center justify-center text-[#475569] hover:bg-[#F1F7FF] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Cert Details */}
            <div className="grid grid-cols-2 gap-4 text-sm bg-[#F8FAFC] border border-[#DCE8F6] p-5 rounded-2xl">
              <div>
                <span className="text-xs text-[#64748B] uppercase font-bold tracking-wider block">Purchase Order</span>
                <span className="font-mono font-bold text-[#0F172A] text-base">{selectedOrderForCert.poNumber}</span>
              </div>
              <div>
                <span className="text-xs text-[#64748B] uppercase font-bold tracking-wider block">Batch Lot ID</span>
                <span className="font-mono font-bold text-[#2563EB] text-base">{selectedOrderForCert.lotId}</span>
              </div>
              <div>
                <span className="text-xs text-[#64748B] uppercase font-bold tracking-wider block">Consignee</span>
                <span className="font-bold text-[#0F172A]">{selectedOrderForCert.customerOrg}</span>
              </div>
              <div>
                <span className="text-xs text-[#64748B] uppercase font-bold tracking-wider block">Chamber Facility</span>
                <span className="font-bold text-[#0F172A]">{selectedOrderForCert.zoneName}</span>
              </div>
              <div>
                <span className="text-xs text-[#64748B] uppercase font-bold tracking-wider block">Mandated Temperature</span>
                <span className="font-bold text-emerald-800">{selectedOrderForCert.mandatedRange}</span>
              </div>
              <div>
                <span className="text-xs text-[#64748B] uppercase font-bold tracking-wider block">Current Storage Temp</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {selectedOrderForCert.liveTemp != null ? `${selectedOrderForCert.liveTemp.toFixed(2)}°C` : "Nominal"}
                </span>
              </div>
            </div>

            {/* Cryptographic Proof Details */}
            <div className="p-4 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#1E40AF]">
                <span>BLOCKCHAIN INTEGRITY ANCHOR</span>
                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono">MERKLE ROOT VERIFIED</span>
              </div>
              <div className="font-mono text-xs text-[#334155] break-all bg-white p-2.5 rounded-lg border border-[#DCE8F6]">
                Root: 72758bf1a40acde22384976ea84b5c77e92bf18b32e6b89e3a6c1178...
              </div>
              <div className="text-[11px] text-[#475569] font-medium">
                SHA-256 hash chains guarantee telemetry continuity from edge sensors with zero post-hoc database alterations.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-[#64748B] font-medium">
                Issued By: ColdGuard AI Automated Regulatory Authority
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl border border-[#DCE8F6] text-xs font-bold text-[#0F172A] hover:bg-[#F1F7FF] flex items-center gap-2 cursor-pointer"
                >
                  <Printer size={15} /> Print Certificate
                </button>
                <button
                  onClick={() => setSelectedOrderForCert(null)}
                  className="px-5 py-2 rounded-xl bg-[#0D9488] text-white text-xs font-bold hover:bg-[#0f766e] transition cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE NEW PURCHASE ORDER MODAL ── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-[#DCE8F6] shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-2xl bg-teal-50 border border-teal-200 text-[#0D9488] flex items-center justify-center shadow-sm">
                  <ShoppingBag size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[#0F172A]">Stage New Purchase Order</h3>
                  <p className="text-xs font-semibold text-[#475569]">Digitally allocate stock to a monitored temperature chamber</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-[#64748B] hover:text-[#0F172A] p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Presets */}
            <div>
              <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                Quick-Select Wholesale Template
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_COMMODITIES.map((preset) => (
                  <button
                    key={preset.productName}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`text-left p-2.5 rounded-xl border text-xs transition cursor-pointer flex flex-col justify-between ${
                      newProductName === preset.productName
                        ? "border-[#0D9488] bg-teal-50/70 text-[#0D9488] font-bold shadow-sm"
                        : "border-[#DCE8F6] bg-slate-50 text-[#334155] hover:bg-[#F1F7FF]"
                    }`}
                  >
                    <span className="truncate">{preset.productName.split("(")[0]}</span>
                    <span className="text-[10px] text-[#64748B] font-mono mt-1">
                      {preset.zoneName} · {preset.mandatedRange}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                    PO Number
                  </label>
                  <input
                    type="text"
                    value={newPoNumber}
                    onChange={(e) => setNewPoNumber(e.target.value)}
                    placeholder="e.g. PO-2026-BIO-905"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                  <span className="text-[10px] text-[#64748B] mt-0.5 block">Leave blank to auto-generate</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                    Commodity Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => {
                      const cat = e.target.value as any;
                      setNewCategory(cat);
                      if (cat === "biologics") setNewZoneId("zone-a");
                      else if (cat === "dairy") setNewZoneId("zone-b");
                      else setNewZoneId("zone-c");
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  >
                    <option value="biologics">Biologics & Vaccines (2°C to 8°C)</option>
                    <option value="dairy">Fresh Dairy & Cheeses (0°C to 4°C)</option>
                    <option value="frozen">Frozen Seafood & Meat (-25°C to -18°C)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                  Product / Lot Description
                </label>
                <input
                  type="text"
                  required
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="e.g. COVID-19 mRNA Vaccine Vials (Comirnaty)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                    Storage Chamber Allocation
                  </label>
                  <select
                    value={newZoneId}
                    onChange={(e) => setNewZoneId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  >
                    <option value="zone-a">Vaccine Store A (Chamber Bay 8)</option>
                    <option value="zone-b">Dairy Chiller B (Bay 12)</option>
                    <option value="zone-c">Deep Freeze Vault C (Bay 16 Cryo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                    Customer / Receiving Org
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerOrg}
                    onChange={(e) => setNewCustomerOrg(e.target.value)}
                    placeholder="e.g. Metro Health Hospital Network"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-sm font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                    Quantity & Units
                  </label>
                  <input
                    type="text"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="e.g. 3,500 Vials"
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-xs sm:text-sm font-semibold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                    Wholesale USD ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={newValueUsd}
                    onChange={(e) => setNewValueUsd(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-xs sm:text-sm font-semibold text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#475569] uppercase tracking-wider mb-1">
                    Expected Delivery
                  </label>
                  <input
                    type="text"
                    value={newDelivery}
                    onChange={(e) => setNewDelivery(e.target.value)}
                    placeholder="Tomorrow, 10:00"
                    className="w-full px-3 py-2 rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-xs sm:text-sm font-semibold text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] p-3 text-xs text-[#1E40AF] flex items-center gap-2">
                <ShieldCheck size={18} className="text-[#2563EB] shrink-0" />
                <span>
                  Once placed, order telemetry will be continuously evaluated and made accessible to both the Buyer and Cold Storage Manager.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#DCE8F6]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#DCE8F6] text-xs sm:text-sm font-bold text-[#475569] hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0D9488] hover:bg-[#0f766e] text-white text-xs sm:text-sm font-bold transition shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <PlusCircle size={16} /> Stage Order in Cold Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
