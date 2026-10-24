/* ─────────────────────────────────────────────────────────────────────────────
   Operator — Alerts & Work Orders
   Premium Arctic Blue Design System
   Combines real-time alert triage with maintenance work order dispatching,
   technician assignments, and GxP completion sign-offs.
───────────────────────────────────────────────────────────────────────────── */
import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  ClipboardList,
  Filter,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  User,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";
import type { Alert } from "../../types/api";

export interface WorkOrder {
  id: string;
  zoneId: string;
  zoneName: string;
  subsystem: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "ROUTINE";
  title: string;
  description: string;
  assignedTo: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  createdAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  originAlertId?: string;
}

const STORAGE_KEY = "coldguard.workOrders";

const INITIAL_WORK_ORDERS: WorkOrder[] = [
  {
    id: "WO-2026-041",
    zoneId: "zone-a",
    zoneName: "Vaccine Store A",
    subsystem: "Refrigeration Compressor Relays",
    priority: "HIGH",
    title: "Inspect Auxiliary Contactor & Thermal Overload Sensor",
    description: "Verify duty cycle switching times and inspect contacts for pitting or resistance spikes during pull-down.",
    assignedTo: "Lead Technician Ruchita",
    status: "IN_PROGRESS",
    createdAt: "2026-10-24 14:30",
  },
  {
    id: "WO-2026-042",
    zoneId: "zone-b",
    zoneName: "Dairy Chiller B",
    subsystem: "Door Perimeter Silicone Gasket",
    priority: "MEDIUM",
    title: "Replace Lower Magnetic Compression Seal",
    description: "Micro-thermal infiltration detected during night cycle. Replace lower 1.2m gasket strip and re-test vacuum seal.",
    assignedTo: "Tech Marcus Vance",
    status: "OPEN",
    createdAt: "2026-10-24 16:15",
  },
  {
    id: "WO-2026-039",
    zoneId: "zone-c",
    zoneName: "Frozen Store C",
    subsystem: "Evaporator Defrost Heaters",
    priority: "ROUTINE",
    title: "Biannual Cryogenic Resistance & Drain Pan Inspection",
    description: "Clean condensation drain pan and confirm hot-gas bypass solenoid triggers cleanly at -20°C.",
    assignedTo: "Tech Elena Rostova",
    status: "COMPLETED",
    createdAt: "2026-10-23 09:00",
    resolvedAt: "2026-10-23 11:45",
    resolutionNotes: "Defrost heating rods tested at 22.4 ohms. Drain lines cleared with pressurized nitrogen.",
  },
];

export default function WorkOrders() {
  const { zones } = useApp();
  const [activeTab, setActiveTab] = useState<"alerts" | "work_orders">("alerts");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  // Work Orders state with localStorage persistence
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_WORK_ORDERS;
    } catch {
      return INITIAL_WORK_ORDERS;
    }
  });

  const [woFilter, setWoFilter] = useState<"ALL" | "OPEN" | "IN_PROGRESS" | "COMPLETED">("ALL");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [targetWo, setTargetWo] = useState<WorkOrder | null>(null);
  const [resolutionInput, setResolutionInput] = useState("");

  // New Work Order Form State
  const [newZoneId, setNewZoneId] = useState("zone-a");
  const [newSubsystem, setNewSubsystem] = useState("Evaporator Fan Relays");
  const [newPriority, setNewPriority] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "ROUTINE">("HIGH");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAssignee, setNewAssignee] = useState("Lead Technician Ruchita");

  function saveWorkOrders(updated: WorkOrder[]) {
    setWorkOrders(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn("Failed saving work orders to localStorage:", e);
    }
  }

  async function loadAlerts() {
    setAlertsLoading(true);
    try {
      const al = await api.alerts({ limit: 50 }).catch(() => []);
      setAlerts(al as Alert[]);
    } finally {
      setAlertsLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, []);

  async function handleAcknowledge(alertId: string) {
    try {
      await api.acknowledge(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true, acknowledged_by: "Facility Operator" } : a))
      );
    } catch (err) {
      console.error("Failed to acknowledge alert:", err);
    }
  }

  function handleCreateWoFromAlert(alert: Alert) {
    const zone = zones?.find((z) => z.zone_id === alert.zone_id);
    const newWo: WorkOrder = {
      id: `WO-2026-${Math.floor(100 + Math.random() * 900)}`,
      zoneId: alert.zone_id,
      zoneName: zone?.name || alert.zone_id,
      subsystem: alert.category === "predicted_excursion" ? "Thermostat & Compressor Pull-Down" : "Thermal Integrity Probe",
      priority: alert.severity === "critical" ? "CRITICAL" : "HIGH",
      title: `Resolve Alert: ${alert.title}`,
      description: alert.recommended_action || alert.explanation,
      assignedTo: "Lead Technician Ruchita",
      status: "OPEN",
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      originAlertId: alert.id,
    };
    saveWorkOrders([newWo, ...workOrders]);
    setActiveTab("work_orders");
  }

  function handleCreateCustomWo() {
    if (!newTitle.trim()) return;
    const zone = zones?.find((z) => z.zone_id === newZoneId);
    const wo: WorkOrder = {
      id: `WO-2026-${Math.floor(100 + Math.random() * 900)}`,
      zoneId: newZoneId,
      zoneName: zone?.name || newZoneId,
      subsystem: newSubsystem,
      priority: newPriority,
      title: newTitle,
      description: newDescription,
      assignedTo: newAssignee,
      status: "OPEN",
      createdAt: new Date().toISOString().replace("T", " ").slice(0, 16),
    };
    saveWorkOrders([wo, ...workOrders]);
    setIsCreateModalOpen(false);
    setNewTitle("");
    setNewDescription("");
  }

  function updateWoStatus(id: string, newStatus: "OPEN" | "IN_PROGRESS" | "COMPLETED") {
    const updated = workOrders.map((w) => (w.id === id ? { ...w, status: newStatus } : w));
    saveWorkOrders(updated);
  }

  function completeWorkOrder() {
    if (!targetWo) return;
    const updated = workOrders.map((w) =>
      w.id === targetWo.id
        ? {
            ...w,
            status: "COMPLETED" as const,
            resolvedAt: new Date().toISOString().replace("T", " ").slice(0, 16),
            resolutionNotes: resolutionInput || "Maintenance inspection completed. System verified operational.",
          }
        : w
    );
    saveWorkOrders(updated);
    setIsResolveModalOpen(false);
    setTargetWo(null);
    setResolutionInput("");
  }

  const filteredAlerts = alerts.filter((a) => {
    if (severityFilter === "critical") return a.severity === "critical";
    if (severityFilter === "warning") return a.severity === "warning";
    if (severityFilter === "open") return !a.acknowledged;
    return true;
  });

  const filteredWos = workOrders.filter((w) => {
    if (woFilter === "OPEN") return w.status === "OPEN";
    if (woFilter === "IN_PROGRESS") return w.status === "IN_PROGRESS";
    if (woFilter === "COMPLETED") return w.status === "COMPLETED";
    return true;
  });

  const openWosCount = workOrders.filter((w) => w.status !== "COMPLETED").length;
  const criticalWosCount = workOrders.filter((w) => w.priority === "CRITICAL" && w.status !== "COMPLETED").length;

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Section
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center shadow-sm">
              <Wrench size={22} className="text-[#2563EB]" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2">
                Alerts & Maintenance Work Orders
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] uppercase">
                  Technician Operations
                </span>
              </h1>
              <p className="text-sm text-[#475569] mt-0.5 font-medium">
                Triage active thermal alerts, dispatch electromechanical work orders, and document GxP maintenance sign-offs.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2.5 text-sm font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus size={16} /> New Work Order
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. Top Metric Cards
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Active Alerts</span>
            <BellRing size={18} className="text-[#2563EB]" />
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">{alerts.length}</div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">Logged across all sensor zones</div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Pending Work Orders</span>
            <ClipboardList size={18} className={openWosCount > 0 ? "text-amber-600" : "text-emerald-600"} />
          </div>
          <div className={`text-3xl font-extrabold tracking-tight ${openWosCount > 0 ? "text-amber-600" : "text-[#0F172A]"}`}>
            {openWosCount}
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">Scheduled or active in progress</div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Critical Priority</span>
            <AlertTriangle size={18} className={criticalWosCount > 0 ? "text-rose-600" : "text-emerald-600"} />
          </div>
          <div className={`text-3xl font-extrabold tracking-tight ${criticalWosCount > 0 ? "text-rose-600" : "text-emerald-700"}`}>
            {criticalWosCount}
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1">Requires immediate intervention</div>
        </div>

        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Completed Work Orders</span>
            <CheckCircle2 size={18} className="text-emerald-700" />
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">
            {workOrders.filter((w) => w.status === "COMPLETED").length}
          </div>
          <div className="text-xs font-semibold text-emerald-700 mt-1">GxP maintenance verified</div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. Sub-Navigation Tabs
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-[#DCE8F6] shadow-arctic-card">
        <div className="flex items-center gap-1.5 p-1 bg-[#EFF6FF] rounded-xl border border-[#DCE8F6]">
          <button
            onClick={() => setActiveTab("alerts")}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-2 ${
              activeTab === "alerts"
                ? "bg-[#2563EB] text-white shadow-sm"
                : "text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            <BellRing size={15} /> Active Alerts ({alerts.length})
          </button>
          <button
            onClick={() => setActiveTab("work_orders")}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition cursor-pointer flex items-center gap-2 ${
              activeTab === "work_orders"
                ? "bg-[#2563EB] text-white shadow-sm"
                : "text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            <Wrench size={15} /> Maintenance Work Orders ({workOrders.length})
          </button>
        </div>

        {activeTab === "alerts" ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#64748B]">Filter:</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#0F172A] focus:outline-none"
            >
              <option value="all">All Alerts</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warnings</option>
              <option value="open">Unacknowledged</option>
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#64748B]">Status:</span>
            <select
              value={woFilter}
              onChange={(e) => setWoFilter(e.target.value as any)}
              className="rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] px-3 py-1.5 text-xs font-bold text-[#0F172A] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TAB 1: ALERTS LIST
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "alerts" && (
        <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">Live Telemetry Alerts Queue</h2>
            <button
              onClick={loadAlerts}
              disabled={alertsLoading}
              className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw size={13} className={alertsLoading ? "animate-spin" : ""} /> Refresh Alerts
            </button>
          </div>

          {alertsLoading ? (
            <div className="py-16 text-center text-sm font-medium text-[#475569]">
              <RefreshCw size={24} className="animate-spin text-[#2563EB] mx-auto mb-2" />
              Loading real-time alert log…
            </div>
          ) : !filteredAlerts.length ? (
            <div className="py-16 text-center text-sm font-medium text-[#475569]">
              Zero alerts match current criteria. Storage rooms operating nominally.
            </div>
          ) : (
            <div className="divide-y divide-[#DCE8F6]">
              {filteredAlerts.map((a) => {
                const isCritical = a.severity === "critical";
                const isWarning = a.severity === "warning";

                return (
                  <div
                    key={a.id}
                    className="p-6 flex flex-wrap items-start justify-between gap-4 hover:bg-[#F1F7FF] transition"
                  >
                    <div className="flex items-start gap-3.5 max-w-3xl">
                      <div
                        className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 ${
                          isCritical
                            ? "bg-rose-50 text-rose-600 border-rose-200"
                            : isWarning
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-[#EFF6FF] text-[#2563EB] border-[#BAE6FD]"
                        }`}
                      >
                        <AlertTriangle size={18} />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-[#0F172A] text-base">{a.title}</span>
                          <span
                            className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                              isCritical
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : isWarning
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                            }`}
                          >
                            {a.severity.toUpperCase()}
                          </span>
                          <span className="text-xs font-mono font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded border border-[#BAE6FD]">
                            {a.zone_id}
                          </span>
                        </div>

                        <p className="text-xs sm:text-sm text-[#475569] leading-relaxed font-medium">
                          {a.explanation}
                        </p>

                        {a.recommended_action && (
                          <div className="p-2.5 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-xs text-[#1E40AF] font-medium mt-2">
                            <strong>Recommended SOP Action:</strong> {a.recommended_action}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 self-start">
                      {!a.acknowledged ? (
                        <button
                          onClick={() => handleAcknowledge(a.id)}
                          className="px-3.5 py-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#F8FAFC] text-xs font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 size={13} /> Acknowledged
                        </span>
                      )}

                      <button
                        onClick={() => handleCreateWoFromAlert(a)}
                        className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-bold text-white transition shadow-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Wrench size={13} /> Create Work Order
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          5. TAB 2: MAINTENANCE WORK ORDERS LIST
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "work_orders" && (
        <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">Maintenance Work Orders Ledger</h2>
            <span className="text-xs font-medium text-[#64748B]">Showing {filteredWos.length} work orders</span>
          </div>

          {!filteredWos.length ? (
            <div className="py-16 text-center text-sm font-medium text-[#475569]">
              No work orders match the selected filter.
            </div>
          ) : (
            <div className="divide-y divide-[#DCE8F6]">
              {filteredWos.map((wo) => {
                const isOpen = wo.status === "OPEN";
                const isInProgress = wo.status === "IN_PROGRESS";
                const isCompleted = wo.status === "COMPLETED";

                return (
                  <div
                    key={wo.id}
                    className="p-6 flex flex-wrap items-start justify-between gap-4 hover:bg-[#F1F7FF] transition"
                  >
                    <div className="space-y-2 max-w-3xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs bg-[#EFF6FF] text-[#2563EB] px-2.5 py-1 rounded-lg border border-[#BAE6FD]">
                          {wo.id}
                        </span>
                        <h3 className="font-extrabold text-[#0F172A] text-base">{wo.title}</h3>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            wo.priority === "CRITICAL"
                              ? "bg-rose-50 text-rose-800 border-rose-200"
                              : wo.priority === "HIGH"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-[#EFF6FF] text-[#1E40AF] border-[#BAE6FD]"
                          }`}
                        >
                          {wo.priority}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            isOpen
                              ? "bg-slate-100 text-slate-800 border-slate-300"
                              : isInProgress
                              ? "bg-blue-50 text-blue-800 border-blue-300 animate-pulse"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {wo.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="text-xs font-medium text-[#64748B] flex items-center gap-3">
                        <span>
                          Chamber: <strong className="text-[#0F172A]">{wo.zoneName}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Subsystem: <strong className="text-[#0F172A]">{wo.subsystem}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Assigned: <strong className="text-[#0F172A]">{wo.assignedTo}</strong>
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">{wo.description}</p>

                      {wo.resolutionNotes && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium mt-2">
                          <strong>GxP Resolution Sign-Off ({wo.resolvedAt}):</strong> {wo.resolutionNotes}
                        </div>
                      )}
                    </div>

                    {/* State Actions */}
                    <div className="flex items-center gap-2 self-start">
                      {isOpen && (
                        <button
                          onClick={() => updateWoStatus(wo.id, "IN_PROGRESS")}
                          className="px-3.5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-bold text-white transition shadow-sm cursor-pointer"
                        >
                          Start Work Order
                        </button>
                      )}

                      {isInProgress && (
                        <button
                          onClick={() => {
                            setTargetWo(wo);
                            setIsResolveModalOpen(true);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition shadow-sm cursor-pointer"
                        >
                          Complete & Sign-Off
                        </button>
                      )}

                      {isCompleted && (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Completed & Verified
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          6. Modal: Create Custom Work Order
      ───────────────────────────────────────────────────────────── */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#DCE8F6] bg-white p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE8F6]">
              <h3 className="font-extrabold text-lg text-[#0F172A] flex items-center gap-2">
                <Wrench size={18} className="text-[#2563EB]" /> Dispatch Maintenance Work Order
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-[#0F172A] cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Target Cold Room:</label>
                <select
                  value={newZoneId}
                  onChange={(e) => setNewZoneId(e.target.value)}
                  className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-2.5 font-semibold text-[#0F172A]"
                >
                  {(zones ?? []).map((z) => (
                    <option key={z.zone_id} value={z.zone_id}>
                      {z.name} ({z.zone_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Equipment Subsystem:</label>
                <input
                  type="text"
                  value={newSubsystem}
                  onChange={(e) => setNewSubsystem(e.target.value)}
                  placeholder="e.g. Compressor Contactor, Silicone Gasket, Air Handler"
                  className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-2.5 font-medium text-[#0F172A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#0F172A] mb-1">Priority:</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-2.5 font-semibold text-[#0F172A]"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="ROUTINE">ROUTINE</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#0F172A] mb-1">Assigned Technician:</label>
                  <input
                    type="text"
                    value={newAssignee}
                    onChange={(e) => setNewAssignee(e.target.value)}
                    className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-2.5 font-medium text-[#0F172A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Work Order Title:</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Calibrate RTD sensor probe TS-A01"
                  className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-2.5 font-medium text-[#0F172A]"
                />
              </div>

              <div>
                <label className="block font-bold text-[#0F172A] mb-1">Detailed Work Instructions / Notes:</label>
                <textarea
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Specify protocol and parts required..."
                  className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-2.5 font-medium text-[#0F172A]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#DCE8F6]">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#DCE8F6] text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomWo}
                className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                Dispatch Work Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          7. Modal: Complete & Sign-Off Work Order
      ───────────────────────────────────────────────────────────── */}
      {isResolveModalOpen && targetWo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#DCE8F6] bg-white p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-[#0F172A]">Complete Work Order: {targetWo.id}</h3>
            <p className="text-xs text-[#475569]">{targetWo.title}</p>

            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1">
                Technician Resolution & GxP Compliance Notes:
              </label>
              <textarea
                rows={3}
                value={resolutionInput}
                onChange={(e) => setResolutionInput(e.target.value)}
                placeholder="Describe corrective actions taken and verification results..."
                className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] p-3 text-xs sm:text-sm font-medium text-[#0F172A]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#DCE8F6]">
              <button
                onClick={() => setIsResolveModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-[#DCE8F6] text-xs font-semibold text-[#475569] hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={completeWorkOrder}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm cursor-pointer"
              >
                Sign Off & Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
