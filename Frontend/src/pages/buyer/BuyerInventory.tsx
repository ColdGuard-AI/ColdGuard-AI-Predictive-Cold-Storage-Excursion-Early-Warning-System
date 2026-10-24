/* ─────────────────────────────────────────────────────────────────────────────
   Buyer / Retailer — Product & Lot Inventory
   Premium Arctic Blue Design System
   Detailed batch catalog with live shelf-life degradation & chamber telemetry
───────────────────────────────────────────────────────────────────────────── */
import React, { useState } from "react";
import {
  Package,
  Thermometer,
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Calendar,
  AlertTriangle,
  XCircle,
  Layers,
  Info,
  X,
  FileSpreadsheet,
  Boxes,
} from "lucide-react";
import { useApp } from "../../hooks/AppContext";

export interface InventoryLot {
  lotId: string;
  sku: string;
  productName: string;
  category: "biologics" | "dairy" | "frozen";
  zoneId: string;
  zoneName: string;
  quantityUnits: string;
  massKg: number;
  unitValueUsd: number;
  totalValueUsd: number;
  totalValueInr: number;
  safeTempMin: number;
  safeTempMax: number;
  spoilageThresholdC: number;
  manufacturingDate: string;
  expirationDate: string;
  nominalShelfLifeDays: number;
  packagingType: string;
  regulatoryStandard: string;
  biologicalMechanism: string;
  vulnerableItems: string[];
}

const LOT_INVENTORY: InventoryLot[] = [
  {
    lotId: "LOT-BIO-2026-09A",
    sku: "MED-MRNA-4200",
    productName: "COVID-19 mRNA Vaccine Vials (Comirnaty / Spikevax)",
    category: "biologics",
    zoneId: "zone-a",
    zoneName: "Vaccine Store A",
    quantityUnits: "4,200 vials (21,000 doses)",
    massKg: 500,
    unitValueUsd: 44.28,
    totalValueUsd: 186000,
    totalValueInr: 15438000,
    safeTempMin: 2.0,
    safeTempMax: 8.0,
    spoilageThresholdC: 8.0,
    manufacturingDate: "2026-09-15",
    expirationDate: "2027-03-15",
    nominalShelfLifeDays: 180,
    packagingType: "VIP Vacuum Insulated Shippers with Phase-Change PCM Plates",
    regulatoryStandard: "WHO Annex 5 / FDA 21 CFR Part 211.142",
    biologicalMechanism: "Denaturation of tertiary protein chains and mRNA lipid nanoparticle degradation above 8.0°C; loss of antigenic potency.",
    vulnerableItems: [
      "COVID-19 mRNA Vaccine Vials (Comirnaty / Spikevax) - 4,200 doses",
      "Cryogenic buffer solution packs - 210 units",
    ],
  },
  {
    lotId: "LOT-BIO-PEDIATRIC",
    sku: "MED-MMR-3500",
    productName: "Pediatric MMR, Varicella & Rotavirus Cold-Chain Vaccines",
    category: "biologics",
    zoneId: "zone-a",
    zoneName: "Vaccine Store A",
    quantityUnits: "3,500 doses in multi-dose glass vials",
    massKg: 350,
    unitValueUsd: 21.28,
    totalValueUsd: 74500,
    totalValueInr: 6183500,
    safeTempMin: 2.0,
    safeTempMax: 8.0,
    spoilageThresholdC: 8.0,
    manufacturingDate: "2026-08-20",
    expirationDate: "2027-02-20",
    nominalShelfLifeDays: 184,
    packagingType: "Sealed Cold-Chain Polystyrene Shipper with Dry Gel Blocks",
    regulatoryStandard: "WHO PQS/E003 Temperature Monitoring Guidelines",
    biologicalMechanism: "Live attenuated viral coat degradation upon heat exposure.",
    vulnerableItems: [
      "Pediatric MMR Vials - 1,800 doses",
      "Varicella Vaccine Stock - 900 doses",
      "Oral Rotavirus Suspension - 800 doses",
    ],
  },
  {
    lotId: "LOT-BIO-INSULIN",
    sku: "MED-INS-2800",
    productName: "Recombinant Human Insulin (Glargine & Lispro Cartridges)",
    category: "biologics",
    zoneId: "zone-a",
    zoneName: "Vaccine Store A",
    quantityUnits: "2,800 cartridges (3ml each)",
    massKg: 280,
    unitValueUsd: 18.5,
    totalValueUsd: 51800,
    totalValueInr: 4299400,
    safeTempMin: 2.0,
    safeTempMax: 8.0,
    spoilageThresholdC: 8.0,
    manufacturingDate: "2026-09-01",
    expirationDate: "2027-05-01",
    nominalShelfLifeDays: 242,
    packagingType: "Cushioned Thermal Carton with Continuous Temperature Sensor",
    regulatoryStandard: "USP <1079> Good Storage & Distribution Practices",
    biologicalMechanism: "Fibrillation and irreversible peptide aggregation above 8.0°C or below 0°C freezing.",
    vulnerableItems: [
      "Insulin Glargine Long-Acting 100 U/mL - 1,600 cartridges",
      "Insulin Lispro Rapid-Acting 100 U/mL - 1,200 cartridges",
    ],
  },
  {
    lotId: "LOT-DAIRY-884B",
    sku: "DRY-MLK-1800",
    productName: "Grade-A Pasteurized Whole Milk & Heavy Whipping Cream",
    category: "dairy",
    zoneId: "zone-b",
    zoneName: "Dairy Chiller B",
    quantityUnits: "1,800 cartons (2,400 liters)",
    massKg: 2400,
    unitValueUsd: 7.25,
    totalValueUsd: 17400,
    totalValueInr: 1444200,
    safeTempMin: 0.0,
    safeTempMax: 4.0,
    spoilageThresholdC: 6.0,
    manufacturingDate: "2026-10-20",
    expirationDate: "2026-11-08",
    nominalShelfLifeDays: 19,
    packagingType: "Recyclable Tetra Top Multi-Barrier Cartons",
    regulatoryStandard: "USDA Grade A Pasteurized Milk Ordinance (PMO)",
    biologicalMechanism: "Psychrotrophic bacterial growth (Pseudomonas, Listeria) leading to souring and curdling.",
    vulnerableItems: [
      "Whole Homogenized Milk (1L) - 1,200 cartons",
      "Heavy Cream 36% Butterfat (500ml) - 600 bottles",
    ],
  },
  {
    lotId: "LOT-DAIRY-CHEESE",
    sku: "DRY-CHS-620",
    productName: "Artisan Live-Culture Cheeses (Mozzarella, Ricotta & Brie)",
    category: "dairy",
    zoneId: "zone-b",
    zoneName: "Dairy Chiller B",
    quantityUnits: "620 kg sealed artisan wheels",
    massKg: 620,
    unitValueUsd: 14.68,
    totalValueUsd: 9100,
    totalValueInr: 755300,
    safeTempMin: 0.0,
    safeTempMax: 4.0,
    spoilageThresholdC: 6.0,
    manufacturingDate: "2026-10-18",
    expirationDate: "2026-11-28",
    nominalShelfLifeDays: 41,
    packagingType: "Micro-Perforated Gas-Flushed Barrier Film",
    regulatoryStandard: "FDA Compliance Policy Guide Sec. 560.400",
    biologicalMechanism: "Uncontrolled yeast blooming and secondary whey separation above 6.0°C.",
    vulnerableItems: [
      "Fresh Mozzarella di Bufala - 320 kg",
      "Handmade Whole-Milk Ricotta - 180 kg",
      "Triple-Crème Brie Wheels - 120 kg",
    ],
  },
  {
    lotId: "LOT-CRYO-411C",
    sku: "CRYO-SEA-1200",
    productName: "Wild-Caught IQF Atlantic Salmon & Prime Cod Fillets",
    category: "frozen",
    zoneId: "zone-c",
    zoneName: "Frozen Store C",
    quantityUnits: "1,200 kg IQF sealed vacuum packs",
    massKg: 1200,
    unitValueUsd: 26.5,
    totalValueUsd: 31800,
    totalValueInr: 2639400,
    safeTempMin: -22.0,
    safeTempMax: -18.0,
    spoilageThresholdC: -15.0,
    manufacturingDate: "2026-10-05",
    expirationDate: "2027-04-05",
    nominalShelfLifeDays: 182,
    packagingType: "Heavy-Gauge 5-Ply Cryo Polyethylene Vacuum Bags",
    regulatoryStandard: "Codex Alimentarius Standard for Quick Frozen Fish (CXS 36-1981)",
    biologicalMechanism: "Recrystallization of ice puncturing cellular walls, leading to moisture drip loss and lipid oxidation.",
    vulnerableItems: [
      "IQF Atlantic Salmon Center-Cut Portions - 800 kg",
      "Flash-Frozen Cod Fillets - 400 kg",
    ],
  },
  {
    lotId: "LOT-CRYO-POULTRY",
    sku: "CRYO-PLT-980",
    productName: "Flash-Frozen Organic Poultry & Prime Cuts",
    category: "frozen",
    zoneId: "zone-c",
    zoneName: "Frozen Store C",
    quantityUnits: "980 kg cryo-cartons",
    massKg: 980,
    unitValueUsd: 16.53,
    totalValueUsd: 16200,
    totalValueInr: 1344600,
    safeTempMin: -22.0,
    safeTempMax: -18.0,
    spoilageThresholdC: -15.0,
    manufacturingDate: "2026-10-10",
    expirationDate: "2027-06-10",
    nominalShelfLifeDays: 243,
    packagingType: "Corrugated Cryo-Treated Master Cases with Poly Liners",
    regulatoryStandard: "USDA FSIS Directive 7120.1",
    biologicalMechanism: "Freezer burn and enzymatic rancidity above -15.0°C.",
    vulnerableItems: [
      "Organic Boneless Chicken Breasts - 600 kg",
      "Flash-Frozen Turkey Medallions - 380 kg",
    ],
  },
];

export default function BuyerInventory() {
  const { zones, zonesLoading, searchQuery, setSearchQuery } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<"ALL" | "biologics" | "dairy" | "frozen">("ALL");
  const [inspectingLot, setInspectingLot] = useState<InventoryLot | null>(null);

  // Sync internal searchTerm with shared searchQuery
  const effectiveQuery = (searchQuery || searchTerm).trim().toLowerCase();

  // Compute live readings and estimated shelf-life degradation
  const enrichedLots = LOT_INVENTORY.map((lot) => {
    const zone = zones?.find((z: any) => z.zone_id === lot.zoneId);
    const liveTemp = zone?.temperature ?? null;
    const riskScore = zone?.risk_score ?? 0;

    // Thermal stress index: if temperature exceeds safe max, compute accelerated degradation rate
    const isExcursion = liveTemp !== null && liveTemp > lot.spoilageThresholdC;
    const thermalStressFactor = isExcursion ? Math.max(1.5, (liveTemp - lot.safeTempMax) * 1.8) : 1.0;

    // Days remaining estimate
    const daysLeft = Math.max(0, Math.round(lot.nominalShelfLifeDays / thermalStressFactor));
    const shelfLifeLossPct = Math.min(100, Math.round(riskScore * 0.85));

    return {
      ...lot,
      liveTemp,
      riskScore,
      isExcursion,
      daysLeft,
      shelfLifeLossPct,
      zoneStatus: (zone as any)?.status ?? "SAFE",
    };
  });

  const filteredLots = enrichedLots.filter((lot) => {
    const matchesSearch =
      !effectiveQuery ||
      lot.lotId.toLowerCase().includes(effectiveQuery) ||
      lot.productName.toLowerCase().includes(effectiveQuery) ||
      lot.sku.toLowerCase().includes(effectiveQuery) ||
      lot.zoneName.toLowerCase().includes(effectiveQuery) ||
      lot.category.toLowerCase().includes(effectiveQuery) ||
      lot.packagingType.toLowerCase().includes(effectiveQuery);
    const matchesCategory = selectedCategory === "ALL" || lot.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalInventoryUsd = LOT_INVENTORY.reduce((sum, l) => sum + l.totalValueUsd, 0);
  const totalMassKg = LOT_INVENTORY.reduce((sum, l) => sum + l.massKg, 0);
  const lotsAtRisk = enrichedLots.filter((l) => l.isExcursion || l.riskScore >= 60).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <Package size={28} className="text-[#0D9488]" /> Product & Lot Inventory Explorer
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">
            Live SKU catalog, cold chamber assignments, thermal sensitivity profiles, and shelf-life degradation tracking.
          </p>
        </div>
      </div>

      {/* Top Inventory Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Gross Lot Valuation</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Boxes size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
            ${totalInventoryUsd.toLocaleString()}
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">
            ₹{(totalInventoryUsd * 83).toLocaleString()} (7 Active Batches)
          </div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Total Cargo Mass</span>
            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-200 text-[#2563EB] flex items-center justify-center">
              <Layers size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">
            {totalMassKg.toLocaleString()} kg
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">Distributed across Zones A, B, and C</div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Chamber Allocation</span>
            <div className="h-9 w-9 rounded-xl bg-cyan-50 border border-cyan-200 text-[#0284C7] flex items-center justify-center">
              <Thermometer size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#0F172A]">3 Facilities</div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">Cryo Vault · Dairy · Frozen Hub</div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Lots Under Thermal Stress</span>
            <div
              className={`h-9 w-9 rounded-xl border flex items-center justify-center ${
                lotsAtRisk > 0
                  ? "bg-rose-50 border-rose-200 text-rose-700"
                  : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}
            >
              <AlertTriangle size={18} />
            </div>
          </div>
          <div
            className={`text-2xl sm:text-3xl font-extrabold ${
              lotsAtRisk > 0 ? "text-rose-700" : "text-[#0F172A]"
            }`}
          >
            {lotsAtRisk} Lots
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">
            {lotsAtRisk > 0 ? "Accelerated shelf-life degradation" : "100% within validated bounds"}
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
            value={searchQuery || searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSearchQuery(e.target.value);
            }}
            placeholder="Search by Lot ID (e.g. LOT-BIO-2026), SKU, Product, or Chamber..."
            className="w-full pl-10 pr-9 py-2 text-sm rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0D9488]"
          />
          {(searchQuery || searchTerm) && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSearchQuery("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { key: "ALL", label: "All Commodities" },
            { key: "biologics", label: "Vaccines & Biologics" },
            { key: "dairy", label: "Fresh Dairy" },
            { key: "frozen", label: "Frozen Seafood & Meat" },
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.key
                  ? "bg-[#0D9488] text-white shadow-sm"
                  : "bg-[#F1F7FF] text-[#475569] hover:bg-[#E2E8F0]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lot Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredLots.map((lot) => {
          const categoryColors = {
            biologics: "bg-blue-50 text-[#1E40AF] border-blue-200",
            dairy: "bg-amber-50 text-amber-900 border-amber-200",
            frozen: "bg-cyan-50 text-cyan-900 border-cyan-200",
          };

          return (
            <div
              key={lot.lotId}
              className={`rounded-2xl border bg-white p-5 shadow-arctic-card hover:shadow-arctic-hover transition-all flex flex-col justify-between ${
                lot.isExcursion ? "border-rose-300 ring-2 ring-rose-200" : "border-[#DCE8F6]"
              }`}
            >
              <div>
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <span className="font-mono text-xs font-extrabold text-[#0D9488] bg-[#0D9488]/10 px-2.5 py-1 rounded-md border border-[#0D9488]/20">
                    {lot.lotId}
                  </span>
                  <span className={`text-[11px] font-bold uppercase rounded-full px-2.5 py-0.5 border ${categoryColors[lot.category]}`}>
                    {lot.category}
                  </span>
                </div>

                {/* Product Name */}
                <h3 className="text-base font-extrabold text-[#0F172A] leading-snug line-clamp-2 mb-1.5">
                  {lot.productName}
                </h3>
                <div className="text-xs text-[#64748B] font-medium mb-3 font-mono">SKU: {lot.sku}</div>

                {/* Chamber and Temp telemetry */}
                <div className="rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] p-3 space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Chamber:</span>
                    <span className="font-bold text-[#0F172A]">{lot.zoneName}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Safe Limit:</span>
                    <span className="font-semibold text-[#0F172A]">{lot.safeTempMin}°C to {lot.safeTempMax}°C</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748B] font-medium">Current Reading:</span>
                    <span
                      className={`font-mono font-bold ${
                        lot.isExcursion ? "text-rose-700 font-extrabold" : "text-[#0F172A]"
                      }`}
                    >
                      {lot.liveTemp !== null ? `${lot.liveTemp.toFixed(2)}°C` : "—"}
                    </span>
                  </div>
                </div>

                {/* Shelf-Life & Stability Bar */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-[#64748B]">Remaining Shelf Life</span>
                    <span className="text-[#0F172A] font-bold">{lot.daysLeft} Days</span>
                  </div>
                  <div className="w-full bg-[#E2E8F0] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        lot.isExcursion
                          ? "bg-rose-500"
                          : lot.daysLeft < 30
                          ? "bg-amber-500"
                          : "bg-[#0D9488]"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(10, (lot.daysLeft / lot.nominalShelfLifeDays) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-[#64748B]">
                    <span>Exp: {lot.expirationDate}</span>
                    <span>Stress Loss: {lot.shelfLifeLossPct}%</span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-[#DCE8F6] flex items-center justify-between">
                <div>
                  <div className="text-sm font-extrabold text-[#0F172A]">${lot.totalValueUsd.toLocaleString()}</div>
                  <div className="text-[11px] text-[#64748B] font-medium">{lot.quantityUnits.split("(")[0]}</div>
                </div>
                <button
                  onClick={() => setInspectingLot(lot)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#DCE8F6] text-xs font-bold text-[#0D9488] bg-white hover:bg-[#F1F7FF] transition cursor-pointer shadow-sm"
                >
                  Inspect Batch
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lot Detail Modal */}
      {inspectingLot && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-[#DCE8F6] shadow-2xl p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
              <div>
                <span className="text-xs font-bold text-[#0D9488] uppercase tracking-wider block">
                  Batch Lot Inspection
                </span>
                <h3 className="text-lg font-extrabold text-[#0F172A]">{inspectingLot.productName}</h3>
                <span className="font-mono text-xs text-[#64748B]">{inspectingLot.lotId}</span>
              </div>
              <button
                onClick={() => setInspectingLot(null)}
                className="h-8 w-8 rounded-full border border-[#DCE8F6] flex items-center justify-center text-[#475569] hover:bg-[#F1F7FF] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-[#F8FAFC] border border-[#DCE8F6] p-4 rounded-xl">
              <div>
                <span className="text-[#64748B] block font-medium">Chamber Location</span>
                <span className="font-bold text-[#0F172A] text-sm">{inspectingLot.zoneName}</span>
              </div>
              <div>
                <span className="text-[#64748B] block font-medium">Batch Mass</span>
                <span className="font-bold text-[#0F172A] text-sm">{inspectingLot.massKg} kg</span>
              </div>
              <div>
                <span className="text-[#64748B] block font-medium">Packaging Spec</span>
                <span className="font-semibold text-[#0F172A]">{inspectingLot.packagingType}</span>
              </div>
              <div>
                <span className="text-[#64748B] block font-medium">Regulatory Standard</span>
                <span className="font-semibold text-[#2563EB]">{inspectingLot.regulatoryStandard}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                Biological Spoilage & Quality Mechanism
              </h4>
              <p className="text-xs text-[#334155] bg-[#EFF6FF] border border-[#BAE6FD] p-3 rounded-xl leading-relaxed">
                {inspectingLot.biologicalMechanism}
              </p>
            </div>

            <div>
              <h4 className="text-xs font-bold text-[#475569] uppercase tracking-wider mb-2">
                Included Items & Doses
              </h4>
              <ul className="text-xs text-[#334155] space-y-1 list-disc list-inside bg-[#F8FAFC] p-3 rounded-xl border border-[#DCE8F6]">
                {inspectingLot.vulnerableItems.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-[#DCE8F6]">
              <button
                onClick={() => setInspectingLot(null)}
                className="px-5 py-2.5 rounded-xl bg-[#0D9488] text-white text-xs font-bold hover:bg-[#0f766e] transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
