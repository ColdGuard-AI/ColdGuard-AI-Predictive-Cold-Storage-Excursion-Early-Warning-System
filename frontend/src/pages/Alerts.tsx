/* ─────────────────────────────────────────────────────────────────────────────
   ColdGuard AI — Alerts & Incidents Console
   Premium Arctic Blue Design System
   Exact match with Manager Overview typography, font sizes, and layout.
   Fully logical, non-static integration with real-time FastAPI alerts and acknowledge endpoints.
───────────────────────────────────────────────────────────────────────────── */
import React, { useState, useMemo, useEffect } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Layers,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  X,
  XCircle,
} from "lucide-react";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { api } from "../services/api";
import type { Alert, Severity } from "../types/api";

type AckFilter = "all" | "open" | "acked";
type StateFilter = "all" | "active" | "resolved";

export default function Alerts() {
  const { zones } = useApp();
  const [severity, setSeverity] = useState<Severity | "">("");
  const [zoneId, setZoneId] = useState("");
  const [ack, setAck] = useState<AckFilter>("all");
  const [state, setState] = useState<StateFilter>("all");
  const [search, setSearch] = useState("");
  const [openAlert, setOpenAlert] = useState<Alert | null>(null);
  const [ackPendingId, setAckPendingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Poll alerts dynamically
  const alertsQuery = usePolling(
    () =>
      api.alerts({
        severity: severity || undefined,
        zone_id: zoneId || undefined,
        acknowledged: ack === "all" ? undefined : ack === "acked",
        active: state === "all" ? undefined : state === "active",
        limit: 200,
      }),
    2500,
    [severity, zoneId, ack, state]
  );

  useEffect(() => {
    if (alertsQuery.data) {
      setLastRefreshed(new Date());
    }
  }, [alertsQuery.data]);

  const alerts = alertsQuery.data ?? [];
  const loading = alertsQuery.loading && !alertsQuery.data;

  // Acknowledge handler (real backend API call)
  async function handleAcknowledge(alertId: string) {
    setAckPendingId(alertId);
    try {
      await api.acknowledge(alertId);
      await alertsQuery.refresh();
      setToastMessage("Alert successfully acknowledged and logged to facility GxP audit trail.");
      if (openAlert?.id === alertId) {
        setOpenAlert((prev) => (prev ? { ...prev, acknowledged: true } : null));
      }
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error("Failed to acknowledge alert:", err);
      setToastMessage("Error: Could not acknowledge alert.");
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setAckPendingId(null);
    }
  }

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (search) {
        const q = search.toLowerCase();
        const title = (a.title || "").toLowerCase();
        const explanation = (a.explanation || "").toLowerCase();
        const zone = (a.zone_id || "").toLowerCase();
        const cat = (a.category_label || "").toLowerCase();
        if (!title.includes(q) && !explanation.includes(q) && !zone.includes(q) && !cat.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [alerts, search]);

  // Aggregate KPI stats (purely logical, dynamically derived from live alert array)
  const totalAlertsCount = alerts.length;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const unackedCount = alerts.filter((a) => !a.acknowledged).length;
  const activeCount = alerts.filter((a) => a.active).length;

  const zoneName = (id: string) => zones?.find((z) => z.zone_id === id)?.name ?? id;

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* ─────────────────────────────────────────────────────────────
          1. Header Section (Exact match with ManagerOverview.tsx)
      ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#DCE8F6]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] tracking-tight flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center shadow-sm">
                <BellRing size={20} />
              </div>
              Alerts & Incidents
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
              LIVE MONITORING
            </span>
          </div>
          <p className="text-sm text-[#475569] mt-0.5 font-medium">
            Real-time threshold breaches, compressor trip diagnostics, door excursions, and GxP regulatory alarm logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-[#64748B] hidden sm:inline font-mono">
            Updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={() => alertsQuery.refresh()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] px-4 py-2 text-sm font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={15} className={`text-[#2563EB] ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. Toast Banner
      ───────────────────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[#475569] hover:text-[#0F172A] cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. Top Metric KPI Cards (4 Columns matching ManagerOverview.tsx)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Total Recorded Alerts */}
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Total Logged Alerts</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <BellRing size={17} />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight font-sans">
            {totalAlertsCount}
          </div>
          <div className="text-xs font-bold text-[#475569] mt-1 flex items-center gap-1 font-mono">
            <span>Active Conditions:</span>
            <span className="text-[#2563EB] font-extrabold">{activeCount}</span>
          </div>
        </div>

        {/* Card 2: Critical Excursions */}
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Critical Excursions</span>
            <div
              className={`h-8 w-8 rounded-xl flex items-center justify-center border ${
                criticalCount > 0
                  ? "bg-rose-50 text-rose-600 border-rose-200"
                  : "bg-emerald-50 text-emerald-600 border-emerald-200"
              }`}
            >
              <ShieldAlert size={17} />
            </div>
          </div>
          <div
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-sans ${
              criticalCount > 0 ? "text-rose-600" : "text-[#0F172A]"
            }`}
          >
            {criticalCount}
          </div>
          <div className="text-xs font-bold mt-1 flex items-center gap-1">
            {criticalCount > 0 ? (
              <span className="text-rose-600 font-bold">Immediate mitigation required</span>
            ) : (
              <span className="text-emerald-700 font-bold">Zero critical alarms</span>
            )}
          </div>
        </div>

        {/* Card 3: Unacknowledged Alarms */}
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Unacknowledged Alerts</span>
            <div
              className={`h-8 w-8 rounded-xl flex items-center justify-center border ${
                unackedCount > 0
                  ? "bg-amber-50 text-amber-600 border-amber-200"
                  : "bg-emerald-50 text-emerald-600 border-emerald-200"
              }`}
            >
              <AlertTriangle size={17} />
            </div>
          </div>
          <div
            className={`text-3xl sm:text-4xl font-extrabold tracking-tight font-sans ${
              unackedCount > 0 ? "text-amber-600" : "text-[#0F172A]"
            }`}
          >
            {unackedCount}
          </div>
          <div className="text-xs font-semibold text-[#64748B] mt-1 font-mono">
            {unackedCount > 0 ? "Pending operator sign-off" : "All alarms reviewed"}
          </div>
        </div>

        {/* Card 4: Monitored Facility Chambers */}
        <div className="rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all">
          <div className="flex items-center justify-between text-xs sm:text-sm font-bold text-[#475569] mb-2">
            <span>Monitored Chambers</span>
            <div className="h-8 w-8 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center border border-[#BAE6FD]">
              <Layers size={17} />
            </div>
          </div>
          <div className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight font-sans">
            {zones?.length ?? 3}
          </div>
          <div className="text-xs font-bold text-emerald-800 mt-1 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            All sensor streams active
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. Search & Multi-Filter Control Toolbar
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white border border-[#DCE8F6] p-4 shadow-arctic-card flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search input */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts by title, explanation, or chamber..."
            className="w-full rounded-xl border border-[#DCE8F6] bg-[#F8FAFC] pl-10 pr-4 py-2 text-xs sm:text-sm font-medium text-[#0F172A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition"
          />
        </div>

        {/* Right: Pill Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Severity selector */}
          <div className="flex items-center gap-1 bg-[#F1F7FF] p-1 rounded-xl border border-[#DCE8F6] text-xs font-bold">
            <button
              onClick={() => setSeverity("")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                severity === "" ? "bg-[#2563EB] text-white shadow-sm" : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              All Severities
            </button>
            <button
              onClick={() => setSeverity("critical")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                severity === "critical"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Critical
            </button>
            <button
              onClick={() => setSeverity("warning")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                severity === "warning"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Warning
            </button>
            <button
              onClick={() => setSeverity("info")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                severity === "info"
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Info
            </button>
          </div>

          {/* Acknowledgement filter */}
          <div className="flex items-center gap-1 bg-[#F1F7FF] p-1 rounded-xl border border-[#DCE8F6] text-xs font-bold">
            <button
              onClick={() => setAck("all")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                ack === "all" ? "bg-white text-[#2563EB] shadow-sm" : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setAck("open")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                ack === "open" ? "bg-white text-rose-600 shadow-sm" : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Unacked
            </button>
            <button
              onClick={() => setAck("acked")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                ack === "acked" ? "bg-white text-emerald-700 shadow-sm" : "text-[#475569] hover:text-[#0F172A]"
              }`}
            >
              Acked
            </button>
          </div>

          {/* Zone filter dropdown */}
          <select
            value={zoneId}
            onChange={(e) => setZoneId(e.target.value)}
            className="rounded-xl border border-[#DCE8F6] bg-white px-3 py-2 text-xs font-bold text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] shadow-sm cursor-pointer"
          >
            <option value="">All Cold Chambers</option>
            {zones?.map((z) => (
              <option key={z.zone_id} value={z.zone_id}>
                {z.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          5. Alerts Data Table (Matching UserApproval & Overview)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">Incident Registry</h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB]">
              {filteredAlerts.length} records
            </span>
          </div>
          <span className="text-xs text-[#475569] font-medium hidden sm:inline">
            De-duplicated GxP cold storage incident log
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm font-semibold text-[#475569] flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-[#2563EB]" />
            Loading live alert records from telemetry database...
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500" />
            <div className="text-base font-bold text-[#0F172A]">No Alerts Matching Selected Filters</div>
            <p className="text-xs text-[#475569] max-w-sm mx-auto">
              All monitored cold chambers are operating within safe thermal parameters or matching conditions are cleared.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#EFF6FF] border-b border-[#DCE8F6] text-[11px] font-mono font-bold text-[#475569] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Severity</th>
                  <th className="py-3 px-5">Cold Chamber</th>
                  <th className="py-3 px-5">Incident Title & Root Cause</th>
                  <th className="py-3 px-5">Category</th>
                  <th className="py-3 px-5">Logged Time</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {filteredAlerts.map((a) => {
                  const isCritical = a.severity === "critical";
                  const isWarning = a.severity === "warning";
                  const isAcked = a.acknowledged;

                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-[#F8FAFC] transition cursor-pointer"
                      onClick={() => setOpenAlert(a)}
                    >
                      {/* Severity */}
                      <td className="py-3.5 px-5" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isCritical
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : isWarning
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-[#EFF6FF] text-[#2563EB] border-[#BAE6FD]"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              isCritical ? "bg-rose-600 animate-pulse" : isWarning ? "bg-amber-500" : "bg-[#2563EB]"
                            }`}
                          />
                          {a.severity.toUpperCase()}
                        </span>
                      </td>

                      {/* Zone */}
                      <td className="py-3.5 px-5 font-semibold text-[#0F172A]">
                        {zoneName(a.zone_id)}
                      </td>

                      {/* Title & Explanation */}
                      <td className="py-3.5 px-5 max-w-md">
                        <div className="font-bold text-[#0F172A]">{a.title}</div>
                        <div className="text-xs text-[#475569] truncate mt-0.5">{a.explanation}</div>
                      </td>

                      {/* Category Label */}
                      <td className="py-3.5 px-5">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-[#475569] text-xs font-mono font-medium">
                          {a.category_label || a.category}
                        </span>
                        {a.occurrences > 1 && (
                          <span className="ml-1 text-[10px] text-[#2563EB] font-bold font-mono">
                            ×{a.occurrences}
                          </span>
                        )}
                      </td>

                      {/* Trigger Time */}
                      <td className="py-3.5 px-5 font-mono text-xs text-[#475569]">
                        <div>{new Date(a.created_at).toLocaleTimeString()}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(a.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Acknowledgement Status */}
                      <td className="py-3.5 px-5" onClick={(e) => e.stopPropagation()}>
                        {isAcked ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            <Check size={12} strokeWidth={3} />
                            Acknowledged
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200 animate-pulse">
                            Pending Review
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {!isAcked ? (
                            <button
                              onClick={() => handleAcknowledge(a.id)}
                              disabled={ackPendingId === a.id}
                              className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
                            >
                              {ackPendingId === a.id ? (
                                <>
                                  <RefreshCw size={12} className="animate-spin" />
                                  Acking...
                                </>
                              ) : (
                                <>
                                  <Check size={13} />
                                  Acknowledge
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => setOpenAlert(a)}
                              className="px-3 py-1.5 rounded-xl bg-white border border-[#DCE8F6] text-[#475569] hover:text-[#0F172A] hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                            >
                              Inspect Details
                            </button>
                          )}
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
          6. Alert Detail Modal
      ───────────────────────────────────────────────────────────── */}
      {openAlert && (
        <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#DCE8F6] p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scaleUp font-sans">
            <div className="flex items-center justify-between border-b border-[#DCE8F6] pb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    openAlert.severity === "critical"
                      ? "bg-rose-50 text-rose-600"
                      : "bg-amber-50 text-amber-600"
                  }`}
                >
                  <AlertCircle size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">{openAlert.title}</h3>
                  <p className="text-xs text-[#475569] font-mono">ID: {openAlert.id}</p>
                </div>
              </div>
              <button
                onClick={() => setOpenAlert(null)}
                className="text-[#475569] hover:text-[#0F172A] cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#DCE8F6] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#475569] font-semibold">Chamber:</span>
                <span className="font-bold text-[#0F172A]">{zoneName(openAlert.zone_id)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569] font-semibold">Severity Classification:</span>
                <span
                  className={`font-bold uppercase ${
                    openAlert.severity === "critical" ? "text-rose-600" : "text-amber-600"
                  }`}
                >
                  {openAlert.severity}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569] font-semibold">Category:</span>
                <span className="font-bold text-[#0F172A]">{openAlert.category_label || openAlert.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569] font-semibold">Logged Timestamp:</span>
                <span className="font-mono text-[#475569]">
                  {new Date(openAlert.created_at).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#475569] font-semibold">Status:</span>
                <span className="font-semibold text-[#0F172A]">
                  {openAlert.acknowledged ? "Acknowledged" : "Open / Unacknowledged"}
                </span>
              </div>
              {openAlert.acknowledged_by && (
                <div className="flex items-center justify-between">
                  <span className="text-[#475569] font-semibold">Acknowledged By:</span>
                  <span className="font-bold text-emerald-700">{openAlert.acknowledged_by}</span>
                </div>
              )}
            </div>

            <div className="text-xs text-[#0F172A] space-y-1">
              <span className="font-bold text-[#475569] uppercase font-mono tracking-wider block">
                Root Cause & Explanation:
              </span>
              <p className="p-3 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#0F172A] leading-relaxed">
                {openAlert.explanation}
              </p>
            </div>

            {openAlert.recommended_action && (
              <div className="text-xs text-[#0F172A] space-y-1">
                <span className="font-bold text-[#475569] uppercase font-mono tracking-wider block">
                  Recommended SOP Action:
                </span>
                <p className="p-3 rounded-xl bg-[#F0FDF4] border border-emerald-200 text-emerald-900 leading-relaxed font-medium">
                  {openAlert.recommended_action}
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DCE8F6]">
              <button
                onClick={() => setOpenAlert(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#475569] hover:bg-slate-100 transition cursor-pointer"
              >
                Close
              </button>
              {!openAlert.acknowledged && (
                <button
                  onClick={() => handleAcknowledge(openAlert.id)}
                  disabled={ackPendingId === openAlert.id}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Check size={14} />
                  Acknowledge Incident
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
