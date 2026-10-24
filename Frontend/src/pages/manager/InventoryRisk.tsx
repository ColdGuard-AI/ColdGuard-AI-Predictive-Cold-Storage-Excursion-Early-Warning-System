/* ─────────────────────────────────────────────────────────────────────────────
   Manager Dashboard — Inventory & Financial Exposure Analysis
   Premium Arctic Blue Design System
   Matches ManagerOverview and UserApproval typography and font sizing
───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  Package,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  Zap,
  Activity,
  Sliders,
  FileSpreadsheet,
  Layers,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  Info,
} from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";

interface CommodityProfile {
  zoneId: string;
  name: string;
  product: string;
  batchId: string;
  massKg: number;
  unitCostInr: number;
  grossValueUsd: number;
  spoilageThresholdC: number;
  spoilageMechanism: string;
  vulnerableItems: string[];
  regulatoryStandard: string;
}

const COMMODITY_PROFILES: Record<string, CommodityProfile> = {
  "zone-a": {
    zoneId: "zone-a",
    name: "Vaccine Store A",
    product: "Vaccines & Biologics",
    batchId: "LOT-BIO-2026-09A",
    massKg: 500,
    unitCostInr: 450,
    grossValueUsd: 186000,
    spoilageThresholdC: 8.0,
    spoilageMechanism:
      "Denaturation of tertiary protein chains and mRNA lipid nanoparticle degradation above 8.0°C; results in total antigenic potency loss requiring mandatory quarantine under WHO/FDA Good Distribution Practices.",
    vulnerableItems: [
      "COVID-19 mRNA Vaccine Vials (Comirnaty / Spikevax) - 4,200 doses",
      "Pediatric MMR, Varicella & Rotavirus Cold-Chain Vaccines - 3,500 doses",
      "Recombinant Human Insulin (Glargine & Lispro) - 2,800 cartridges",
      "Monoclonal Antibodies & Oncology Immunotherapies - 1,100 vials",
    ],
    regulatoryStandard: "WHO Annex 5 / FDA 21 CFR Part 211.142",
  },
  "zone-b": {
    zoneId: "zone-b",
    name: "Dairy Chiller B",
    product: "Milk, Yoghurt & Cheese",
    batchId: "LOT-DAIRY-884B",
    massKg: 2400,
    unitCostInr: 120,
    grossValueUsd: 26500,
    spoilageThresholdC: 6.0,
    spoilageMechanism:
      "Proliferation of psychrotrophic bacteria (Pseudomonas, Listeria monocytogenes) accelerating casein proteolysis and lactic acidification above 6.0°C; causes premature souring, curdling, and renders stock unsellable within 2-4 hours.",
    vulnerableItems: [
      "Grade-A Pasteurized Whole & Skim Milk Cartons - 1,800 units",
      "Artisan Live-Culture Greek Yoghurts & Kefir - 950 jars",
      "Soft Fresh Cheeses (Fresh Mozzarella, Ricotta, Brie) - 620 kg",
      "Heavy Whipping Cream & Custards - 480 liters",
    ],
    regulatoryStandard: "USDA Grade A Pasteurized Milk Ordinance (PMO)",
  },
  "zone-c": {
    zoneId: "zone-c",
    name: "Frozen Store C",
    product: "Frozen Seafood & Poultry",
    batchId: "LOT-CRYO-411C",
    massKg: 3100,
    unitCostInr: 85,
    grossValueUsd: 48000,
    spoilageThresholdC: -15.0,
    spoilageMechanism:
      "Recrystallization of microscopic ice crystals above -15.0°C causing cellular wall puncture, enzymatic lipid oxidation, and moisture purge; irreversible texture damage and microbial spoilage.",
    vulnerableItems: [
      "Wild-Caught IQF Atlantic Salmon & Cod Fillets - 1,200 kg",
      "Flash-Frozen Organic Poultry & Prime Cuts - 980 kg",
      "Prepared Cold-Chain Ready Meals & Pastries - 650 kg",
      "Cryogenic Biological Culture Stocks - 270 kg",
    ],
    regulatoryStandard: "Codex Alimentarius Code of Practice for Frozen Foods",
  },
};

function StatCard({ label, value, sub, icon: Icon, color = "blue", alert = false }: any) {
  const iconColors: any = {
    blue: "text-[#2563EB] bg-[#EFF6FF] border-[#BAE6FD]",
    green: "text-emerald-700 bg-emerald-50 border-emerald-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    red: "text-rose-700 bg-rose-50 border-rose-200",
  };
  const c = iconColors[color] ?? iconColors.blue;
  return (
    <div
      className={`rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 flex flex-col gap-3 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all ${
        alert ? "ring-2 ring-rose-200 border-rose-300" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm sm:text-base font-bold text-[#475569]">{label}</span>
        <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${c}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className={`text-3xl font-extrabold tracking-tight ${alert ? "text-rose-600" : "text-[#0F172A]"}`}>
        {value}
      </div>
      {sub && <div className="text-xs sm:text-sm font-medium text-[#475569]">{sub}</div>}
    </div>
  );
}

export default function InventoryRisk() {
  const { zones, zonesLoading } = useApp();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "profiles" | "simulator" | "history">("overview");

  // What-If Simulator State
  const [simZoneId, setSimZoneId] = useState<string>("zone-a");
  const [simTempDelta, setSimTempDelta] = useState<number>(3.5);
  const [simDurationHours, setSimDurationHours] = useState<number>(2.0);

  async function loadData() {
    setLoading(true);
    try {
      const ev = await api.events(25).catch(() => []);
      setEvents(ev as any[]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Compute live financial rows per zone
  const inventoryRows = (zones ?? []).map((z: any) => {
    const profile = COMMODITY_PROFILES[z.zone_id] || {
      zoneId: z.zone_id,
      name: z.name,
      product: z.product || "Perishable Stock",
      batchId: `LOT-${z.zone_id.toUpperCase()}-STD`,
      massKg: 1000,
      unitCostInr: 100,
      grossValueUsd: 50000,
      spoilageThresholdC: z.upper_limit,
      spoilageMechanism: "Thermal decay of temperature-sensitive inventory.",
      vulnerableItems: [z.product || "Chamber Commodities"],
      regulatoryStandard: "GxP Quality Standard",
    };

    const risk = z.risk_score ?? 0;
    const currentTemp = z.temperature ?? z.setpoint ?? 0;
    const threshold = profile.spoilageThresholdC;
    const isExcursion = currentTemp > threshold;
    const deltaToThreshold = threshold - currentTemp;
    const grossValInr = profile.massKg * profile.unitCostInr;

    // Realistic GxP financial exposure logic matching backend monitor.py:
    let financialExposureInr = 0;
    let exposureNote = "100% Protected";

    if (isExcursion || z.temperature_status === "critical") {
      // Active thermal breach — total batch quarantine required under GxP
      financialExposureInr = grossValInr;
      exposureNote = "Critical Lot Loss";
    } else if (z.temperature_status === "warning" || (z.time_to_breach_minutes && z.time_to_breach_minutes <= 60) || risk >= 50) {
      // Projected excursion or active warning — capital at risk proportional to breach probability
      financialExposureInr = grossValInr * (risk / 100);
      exposureNote = `${risk}% Projected Risk`;
    } else {
      // Nominal operation — storage within validated limits, zero active loss
      financialExposureInr = 0;
      exposureNote = "Safe (0% Loss)";
    }

    return {
      ...profile,
      currentTemp,
      status: z.temperature_status || "normal",
      risk,
      grossValInr,
      financialExposureInr,
      exposureNote,
      isExcursion,
      deltaToThreshold,
      activeAlerts: z.active_alert_count || 0,
      sensorId: z.sensor_id || "TS-01",
    };
  });

  const totalGrossInr = inventoryRows.reduce((sum, r) => sum + r.grossValInr, 0);
  const totalExposureInr = inventoryRows.reduce((sum, r) => sum + r.financialExposureInr, 0);
  const totalGrossUsd = inventoryRows.reduce((sum, r) => sum + r.grossValueUsd, 0);
  const highRiskCount = inventoryRows.filter((r) => r.risk >= 40).length;
  const criticalCount = inventoryRows.filter((r) => r.status === "critical" || r.risk >= 70).length;
  const totalTonnageKg = inventoryRows.reduce((sum, r) => sum + r.massKg, 0);

  // What-if calculation
  const simProfile = COMMODITY_PROFILES[simZoneId] || COMMODITY_PROFILES["zone-a"];
  const simCurrentZone = inventoryRows.find((r) => r.zoneId === simZoneId) || inventoryRows[0];
  const simBaseTemp = simCurrentZone?.currentTemp ?? 4.0;
  const simProjectedTemp = simBaseTemp + simTempDelta;
  const simThreshold = simProfile.spoilageThresholdC;
  const simExceedsThreshold = simProjectedTemp > simThreshold;
  const simThermalOverdrive = Math.max(0, simProjectedTemp - simThreshold);

  const simSpoilagePct = simExceedsThreshold
    ? Math.min(100, Math.round(20 + simThermalOverdrive * 18 + simDurationHours * 12))
    : Math.min(15, Math.round((simTempDelta / 5) * 10));

  const simGrossValueInr = simProfile.massKg * simProfile.unitCostInr;
  const simProjectedLossInr = (simGrossValueInr * simSpoilagePct) / 100;
  const simProjectedLossUsd = (simProfile.grossValueUsd * simSpoilagePct) / 100;
  const simSalvageableInr = simGrossValueInr - simProjectedLossInr;

  function exportReportCsv() {
    const headers = [
      "Zone ID",
      "Chamber Name",
      "Product",
      "Batch ID",
      "Mass (kg)",
      "Unit Cost (INR)",
      "Gross Value (INR)",
      "Current Temp (°C)",
      "Spoilage Threshold (°C)",
      "Risk Score (%)",
      "Financial Exposure (INR)",
      "Status",
    ];
    const rows = inventoryRows.map((r) => [
      r.zoneId,
      `"${r.name}"`,
      `"${r.product}"`,
      r.batchId,
      r.massKg,
      r.unitCostInr,
      r.grossValInr,
      r.currentTemp.toFixed(2),
      r.spoilageThresholdC,
      r.risk,
      r.financialExposureInr.toFixed(0),
      r.status,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ColdGuard_Financial_Exposure_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────────────────────
          1. Page Header (Exact match with ManagerOverview.tsx)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <Package size={28} className="text-[#2563EB]" /> Inventory & Financial Exposure Analysis
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">
            Estimated inventory value at risk based on real-time temperature fluctuations and commodity valuations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportReportCsv}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] px-4 py-2.5 text-sm sm:text-base font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
          >
            <FileSpreadsheet size={16} className="text-[#2563EB]" /> Export CSV
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] px-4 py-2.5 text-sm sm:text-base font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={16} className={`text-[#2563EB] ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. KPI Stat Cards (4 Columns matching ManagerOverview.tsx)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Total Gross Inventory"
          value={`₹${(totalGrossInr / 100000).toFixed(2)}L`}
          sub={`$${totalGrossUsd.toLocaleString()} USD across all cold chambers`}
          icon={Package}
          color="blue"
        />
        <StatCard
          label="Total Financial Exposure"
          value={`₹${totalExposureInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
          sub={totalExposureInr > 0 ? "Potential monetary loss at current risk" : "Zero exposure — storage within validated range"}
          icon={DollarSign}
          color={totalExposureInr > 5000 ? "red" : "blue"}
          alert={totalExposureInr > 5000}
        />
        <StatCard
          label="Active Stored Tonnage"
          value={`${totalTonnageKg.toLocaleString()} kg`}
          sub="Certified pharmaceutical & food batches"
          icon={Layers}
          color="green"
        />
        <StatCard
          label="High-Risk Cold Rooms"
          value={`${highRiskCount} / ${inventoryRows.length}`}
          sub={highRiskCount > 0 ? "Excursion probability ≥ 40%" : "All chambers in thermal equilibrium"}
          icon={TrendingUp}
          color={highRiskCount > 0 ? "red" : "green"}
          alert={highRiskCount > 0}
        />
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Sub-Navigation Tabs (Large, clean, standard typography)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#DCE8F6] pb-3">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
            activeTab === "overview"
              ? "bg-[#2563EB] text-white shadow-sm"
              : "text-[#475569] hover:text-[#0F172A] hover:bg-white"
          }`}
        >
          Overview & Chamber Breakdown
        </button>
        <button
          onClick={() => setActiveTab("profiles")}
          className={`px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
            activeTab === "profiles"
              ? "bg-[#2563EB] text-white shadow-sm"
              : "text-[#475569] hover:text-[#0F172A] hover:bg-white"
          }`}
        >
          Commodity Spoilage Profiles
        </button>
        <button
          onClick={() => setActiveTab("simulator")}
          className={`px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === "simulator"
              ? "bg-[#2563EB] text-white shadow-sm"
              : "text-[#475569] hover:text-[#0F172A] hover:bg-white"
          }`}
        >
          <Sliders size={16} /> What-If Loss Simulator
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
            activeTab === "history"
              ? "bg-[#2563EB] text-white shadow-sm"
              : "text-[#475569] hover:text-[#0F172A] hover:bg-white"
          }`}
        >
          Recent Excursions & Log
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TAB 1: OVERVIEW & BREAKDOWN TABLE
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
            <div className="px-6 py-5 border-b border-[#DCE8F6] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Package size={22} className="text-[#2563EB]" />
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">Chamber Inventory & Live Risk Breakdown</h2>
                  <p className="text-sm font-medium text-[#475569] mt-0.5">
                    Live excursion risk scores, commodity unit replacement costs, and active capital exposure
                  </p>
                </div>
              </div>
              <span className="text-xs sm:text-sm font-bold px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
                Continuous Evaluation
              </span>
            </div>

            {zonesLoading ? (
              <div className="py-16 text-center text-base font-medium text-[#475569]">
                <RefreshCw size={24} className="animate-spin text-[#2563EB] mx-auto mb-2" />
                Loading inventory breakdown…
              </div>
            ) : !inventoryRows.length ? (
              <div className="py-16 text-center text-base font-medium text-[#475569]">
                No inventory data available.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#EFF6FF] text-xs sm:text-sm font-bold text-[#0F172A] uppercase tracking-wider border-b border-[#DCE8F6]">
                    <tr>
                      <th className="py-4 px-6">Cold Room & Lot</th>
                      <th className="py-4 px-6">Commodity Category</th>
                      <th className="py-4 px-6">Stored Mass</th>
                      <th className="py-4 px-6">Chamber Temp</th>
                      <th className="py-4 px-6">Gross Valuation</th>
                      <th className="py-4 px-6">Excursion Risk</th>
                      <th className="py-4 px-6">Financial Exposure</th>
                      <th className="py-4 px-6">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DCE8F6]">
                    {inventoryRows.map((r) => {
                      const isRiskElevated = r.risk >= 40;
                      const isRiskCritical = r.risk >= 70;
                      return (
                        <tr key={r.zoneId} className="hover:bg-[#F1F7FF] transition">
                          {/* Cold Room & Lot */}
                          <td className="py-4 px-6">
                            <div className="font-bold text-[#0F172A] text-base">{r.name}</div>
                            <div className="text-sm font-medium text-[#2563EB] mt-0.5">
                              {r.batchId} <span className="text-[#94A3B8]">·</span> {r.sensorId}
                            </div>
                          </td>

                          {/* Commodity Category */}
                          <td className="py-4 px-6">
                            <div className="font-semibold text-[#0F172A] text-base">{r.product}</div>
                            <div className="text-sm font-medium text-[#475569] mt-0.5">₹{r.unitCostInr} / kg</div>
                          </td>

                          {/* Stored Mass */}
                          <td className="py-4 px-6 text-base font-bold text-[#0F172A]">
                            {r.massKg.toLocaleString()} kg
                          </td>

                          {/* Chamber Temp */}
                          <td className="py-4 px-6">
                            <div className="text-base font-bold text-[#0F172A]">
                              {r.currentTemp.toFixed(1)}°C
                            </div>
                            <div className="text-sm font-medium mt-0.5">
                              {r.isExcursion ? (
                                <span className="text-rose-600 font-bold">
                                  Exceeds limit ({r.spoilageThresholdC.toFixed(1)}°C)
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-medium">
                                  Safe (max {r.spoilageThresholdC.toFixed(1)}°C)
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Gross Valuation */}
                          <td className="py-4 px-6">
                            <div className="font-extrabold text-[#0F172A] text-base">
                              ₹{r.grossValInr.toLocaleString("en-IN")}
                            </div>
                            <div className="text-xs sm:text-sm font-medium text-[#64748B]">
                              ${r.grossValueUsd.toLocaleString()} USD
                            </div>
                          </td>

                          {/* Excursion Risk */}
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-slate-100 border border-[#DCE8F6] rounded-full h-2.5 min-w-[70px] max-w-[100px] overflow-hidden">
                                <div
                                  className={`h-2.5 rounded-full transition-all ${
                                    isRiskCritical
                                      ? "bg-rose-500"
                                      : isRiskElevated
                                      ? "bg-amber-400"
                                      : "bg-emerald-500"
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(5, r.risk))}%` }}
                                />
                              </div>
                              <span
                                className={`text-base font-bold ${
                                  isRiskCritical
                                    ? "text-rose-600"
                                    : isRiskElevated
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                }`}
                              >
                                {r.risk}%
                              </span>
                            </div>
                          </td>

                          {/* Financial Exposure */}
                          <td className="py-4 px-6">
                            <div
                              className={`text-base font-extrabold ${
                                r.financialExposureInr > 5000
                                  ? "text-rose-600"
                                  : r.financialExposureInr > 1000
                                  ? "text-amber-700"
                                  : "text-[#0F172A]"
                              }`}
                            >
                              ₹{r.financialExposureInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </div>
                            <div className="text-xs sm:text-sm font-medium text-[#64748B]">
                              {r.financialExposureInr > 0
                                ? `${((r.financialExposureInr / r.grossValInr) * 100).toFixed(1)}% of lot value`
                                : "100% Protected (₹0 loss)"}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-4 px-6">
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs sm:text-sm font-bold border shadow-sm ${
                                r.status === "critical" || r.isExcursion
                                  ? "bg-rose-50 border-rose-200 text-rose-800"
                                  : r.status === "warning" || isRiskElevated
                                  ? "bg-amber-50 border-amber-200 text-amber-800"
                                  : "bg-emerald-50 border-emerald-200 text-emerald-800"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  r.status === "critical" || r.isExcursion
                                    ? "bg-rose-500"
                                    : r.status === "warning" || isRiskElevated
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                }`}
                              />
                              {r.status === "critical" || r.isExcursion
                                ? "Quarantine Hold"
                                : r.status === "warning" || isRiskElevated
                                ? "Warning Excursion"
                                : "Nominal"}
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

          {/* Explanatory Cards (Matching Overview Style) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-arctic-card">
              <div className="flex items-center gap-2.5 text-base font-bold text-[#0F172A] mb-2">
                <Info size={18} className="text-[#2563EB]" /> Dynamic Spoilage Attribution
              </div>
              <p className="text-sm font-medium text-[#475569] leading-relaxed">
                ColdGuard AI does not evaluate spoilage as a simple binary on/off switch. The platform integrates cumulative thermal 
                kinetic stress (Mean Kinetic Temperature, MKT) over time. Prolonged mild excursions trigger accelerated shelf-life decay 
                formulas, even before peak limits are crossed.
              </p>
            </div>

            <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-arctic-card">
              <div className="flex items-center gap-2.5 text-base font-bold text-[#0F172A] mb-2">
                <ShieldCheck size={18} className="text-emerald-700" /> Automated GxP Quarantine Protocol
              </div>
              <p className="text-sm font-medium text-[#475569] leading-relaxed">
                When a chamber sustains critical thermal exposure, batch quarantine holds are automatically provisioned 
                in the system audit trail. Supply chain ERPs and dispatch gates are immediately flagged, preventing compromised 
                inventory from leaving the warehouse.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. TAB 2: COMMODITY SPOILAGE PROFILES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "profiles" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {Object.values(COMMODITY_PROFILES).map((profile) => (
            <div
              key={profile.zoneId}
              className="rounded-2xl border border-[#DCE8F6] bg-white p-6 sm:p-7 shadow-arctic-card flex flex-col justify-between hover:shadow-arctic-hover transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#2563EB] bg-[#EFF6FF] border border-[#BAE6FD] px-3 py-1 rounded-full">
                      {profile.batchId}
                    </span>
                    <h3 className="text-xl font-bold text-[#0F172A] mt-3">{profile.name}</h3>
                    <div className="text-sm font-semibold text-[#475569] mt-0.5">{profile.product}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-extrabold text-[#0F172A]">
                      ₹{(profile.massKg * profile.unitCostInr).toLocaleString("en-IN")}
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-[#64748B]">
                      ${profile.grossValueUsd.toLocaleString()} USD
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6]">
                  <div>
                    <div className="text-xs font-bold text-[#64748B] uppercase">Critical Limit</div>
                    <div className="text-base font-extrabold text-rose-600 mt-0.5">
                      {profile.spoilageThresholdC.toFixed(1)}°C
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#64748B] uppercase">Certified Mass</div>
                    <div className="text-base font-extrabold text-[#0F172A] mt-0.5">
                      {profile.massKg.toLocaleString()} kg
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                    <Activity size={16} className="text-[#2563EB]" /> Degradation Mechanism:
                  </div>
                  <p className="text-sm text-[#475569] leading-relaxed bg-[#EFF6FF] p-3.5 rounded-xl border border-[#BAE6FD]">
                    {profile.spoilageMechanism}
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="text-sm font-bold text-[#0F172A]">Vulnerable Stored Commodities:</div>
                  <div className="space-y-1.5">
                    {profile.vulnerableItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 text-xs sm:text-sm font-medium text-[#0F172A] bg-[#F8FAFC] px-3 py-2 rounded-xl border border-[#DCE8F6]"
                      >
                        <span className="h-2 w-2 rounded-full bg-[#2563EB] shrink-0" />
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-5 border-t border-[#DCE8F6] flex items-center justify-between text-xs sm:text-sm">
                <span className="text-[#64748B] font-medium">Standard:</span>
                <span className="font-bold text-[#2563EB]">{profile.regulatoryStandard}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. TAB 3: WHAT-IF LOSS SIMULATOR
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "simulator" && (
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-6 sm:p-8 shadow-arctic-card space-y-6">
          <div className="pb-4 border-b border-[#DCE8F6]">
            <h2 className="text-xl font-bold text-[#0F172A] flex items-center gap-2.5">
              <Sliders size={22} className="text-[#2563EB]" /> Interactive What-If Financial Loss Simulator
            </h2>
            <p className="text-sm sm:text-base font-medium text-[#475569] mt-1">
              Simulate cooling disruptions and door-open events to quantify projected capital exposure in advance
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-6">
              <div>
                <label className="block text-sm font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                  Select Target Cold Room:
                </label>
                <select
                  value={simZoneId}
                  onChange={(e) => setSimZoneId(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] px-4 py-3 text-base font-semibold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
                >
                  {Object.values(COMMODITY_PROFILES).map((p) => (
                    <option key={p.zoneId} value={p.zoneId}>
                      {p.name} — {p.product} (${p.grossValueUsd.toLocaleString()} USD)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm sm:text-base font-bold mb-2">
                  <span className="text-[#0F172A]">Simulated Temperature Rise:</span>
                  <span className="text-[#2563EB] bg-[#EFF6FF] px-3 py-1 rounded-full border border-[#BAE6FD]">
                    +{simTempDelta.toFixed(1)}°C
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="15.0"
                  step="0.5"
                  value={simTempDelta}
                  onChange={(e) => setSimTempDelta(parseFloat(e.target.value))}
                  className="w-full accent-[#2563EB] cursor-pointer h-2"
                />
                <div className="flex justify-between text-xs sm:text-sm font-medium text-[#64748B] mt-1.5">
                  <span>+0.5°C (Minor)</span>
                  <span>+7.5°C (Severe)</span>
                  <span>+15.0°C (Critical)</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm sm:text-base font-bold mb-2">
                  <span className="text-[#0F172A]">Excursion Duration:</span>
                  <span className="text-[#2563EB] bg-[#EFF6FF] px-3 py-1 rounded-full border border-[#BAE6FD]">
                    {simDurationHours.toFixed(1)} Hours
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="12.0"
                  step="0.5"
                  value={simDurationHours}
                  onChange={(e) => setSimDurationHours(parseFloat(e.target.value))}
                  className="w-full accent-[#2563EB] cursor-pointer h-2"
                />
                <div className="flex justify-between text-xs sm:text-sm font-medium text-[#64748B] mt-1.5">
                  <span>30 mins</span>
                  <span>6 hours</span>
                  <span>12 hours</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div className="rounded-2xl bg-[#EFF6FF] border border-[#BAE6FD] p-6 sm:p-7 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#1E40AF] uppercase tracking-wider">
                    Projected Financial Impact
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-full border ${
                      simExceedsThreshold
                        ? "bg-rose-100 border-rose-300 text-rose-800"
                        : "bg-emerald-100 border-emerald-300 text-emerald-800"
                    }`}
                  >
                    {simExceedsThreshold ? "Threshold Exceeded" : "Within Safe Margin"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl p-4 border border-[#BAE6FD] shadow-sm">
                    <div className="text-xs sm:text-sm text-[#475569] font-bold">Projected Peak Temp</div>
                    <div
                      className={`text-2xl sm:text-3xl font-extrabold mt-1 ${
                        simExceedsThreshold ? "text-rose-600" : "text-[#0F172A]"
                      }`}
                    >
                      {simProjectedTemp.toFixed(1)}°C
                    </div>
                    <div className="text-xs font-semibold text-[#64748B] mt-1">
                      {simExceedsThreshold
                        ? `+${simThermalOverdrive.toFixed(1)}°C over limit`
                        : "Safe range maintained"}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-4 border border-[#BAE6FD] shadow-sm">
                    <div className="text-xs sm:text-sm text-[#475569] font-bold">Projected Spoilage Risk</div>
                    <div
                      className={`text-2xl sm:text-3xl font-extrabold mt-1 ${
                        simSpoilagePct >= 50
                          ? "text-rose-600"
                          : simSpoilagePct >= 20
                          ? "text-amber-700"
                          : "text-emerald-700"
                      }`}
                    >
                      {simSpoilagePct}%
                    </div>
                    <div className="text-xs font-semibold text-[#64748B] mt-1">Estimated irreversible loss</div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center text-base sm:text-lg">
                    <span className="text-[#475569] font-bold">Projected Capital at Risk:</span>
                    <span className="font-extrabold text-2xl text-rose-600">
                      ₹{simProjectedLossInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-medium text-[#64748B]">
                    <span>USD Equivalent Loss:</span>
                    <span className="font-bold text-[#0F172A]">${simProjectedLossUsd.toLocaleString()} USD</span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-medium text-[#64748B]">
                    <span>Estimated Salvage Value:</span>
                    <span className="font-bold text-emerald-700">
                      ₹{simSalvageableInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. TAB 4: RECENT EXCURSIONS & AUDIT LOG
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
          <div className="px-6 py-5 border-b border-[#DCE8F6] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp size={22} className="text-[#2563EB]" />
              <h2 className="text-lg sm:text-xl font-bold text-[#0F172A]">Recent Temperature Excursion Events</h2>
            </div>
            <span className="text-xs sm:text-sm font-semibold text-[#475569]">Continuous audit logging</span>
          </div>

          {loading ? (
            <div className="py-16 text-center text-base font-medium text-[#475569]">
              <RefreshCw size={24} className="animate-spin text-[#2563EB] mx-auto mb-2" />
              Loading excursion history…
            </div>
          ) : !events.length ? (
            <div className="py-16 text-center text-base font-medium text-[#475569]">
              No temperature excursions recorded in the current monitoring cycle.
            </div>
          ) : (
            <div className="divide-y divide-[#DCE8F6]">
              {events.map((ev: any, idx: number) => {
                const isCritical = ev.event_type === "excursion" || ev.severity === "critical";
                return (
                  <div
                    key={idx}
                    className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-[#F1F7FF] transition"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`mt-1.5 h-3 w-3 rounded-full shrink-0 ${
                          isCritical ? "bg-rose-500" : "bg-[#2563EB]"
                        }`}
                      />
                      <div>
                        <div className="text-base font-bold text-[#0F172A]">{ev.title || ev.event_type}</div>
                        <div className="text-sm font-medium text-[#475569] mt-0.5">
                          {ev.zone_id} · {ev.sim_timestamp ? ev.sim_timestamp.replace("T", " ") : "Live Telemetry"}
                        </div>
                        {ev.explanation && (
                          <p className="text-sm font-medium text-[#475569] mt-1 max-w-2xl leading-relaxed">
                            {ev.explanation}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <span
                        className={`inline-block px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold border shadow-sm ${
                          isCritical
                            ? "bg-rose-50 border-rose-200 text-rose-800"
                            : "bg-[#EFF6FF] border-[#BAE6FD] text-[#1E40AF]"
                        }`}
                      >
                        {isCritical ? "Excursion Logged" : "Telemetry Event"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
