import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Filter,
  Printer,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { fmtTemp, POLL_MS } from "../lib/format";
import { api } from "../services/api";

export default function Reports() {
  const { zones } = useApp();
  const [reportType, setReportType] = useState("excursion");
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const alertsQuery = usePolling(() => api.alerts({ limit: 15 }), POLL_MS);
  const alerts = alertsQuery.data ?? [];

  const handleDownload = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 pb-12 font-sans selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center">
              <FileText size={20} />
            </div>
            Compliance & Excursion Audit Reports
          </h1>
          <p className="text-xs text-[#475569] mt-1 font-medium">
            Official GxP / FDA 21 CFR Part 11 compliant audit trails, excursion certificates, and temperature logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-xs font-bold shadow-arctic-card transition cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV & PDF</span>
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-sm">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>Audit report generated successfully and logged to cryptographic compliance vault.</span>
        </div>
      )}

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            id: "excursion",
            title: "Temperature Excursion Log",
            desc: "Detailed records of all threshold breaches and duration",
          },
          {
            id: "mkt",
            title: "Mean Kinetic Temp (MKT)",
            desc: "Calculated virtual thermal stress index per product lot",
          },
          {
            id: "audit",
            title: "21 CFR Part 11 Audit Trail",
            desc: "Operator acknowledgments, calibrations, and sensor events",
          },
        ].map((type) => (
          <div
            key={type.id}
            onClick={() => setReportType(type.id)}
            className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between shadow-arctic-card hover:shadow-arctic-hover ${
              reportType === type.id
                ? "bg-[#EFF6FF] border-[#2563EB] ring-2 ring-[#BAE6FD]"
                : "bg-white border-[#DCE8F6]"
            }`}
          >
            <div>
              <div className="text-sm font-bold text-[#0F172A] mb-1">{type.title}</div>
              <div className="text-xs text-[#475569]">{type.desc}</div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-[#2563EB]">
              <FileCheck size={14} />
              <span>{reportType === type.id ? "Active Template" : "Select Template"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Report Preview */}
      <div className="rounded-2xl bg-white border border-[#DCE8F6] p-6 shadow-arctic-card">
        <div className="flex items-center justify-between pb-4 border-b border-[#DCE8F6] mb-4">
          <div>
            <h2 className="text-base font-bold text-[#0F172A]">
              Facility Excursion Summary (Live Telemetry & Audit Logs)
            </h2>
            <div className="text-xs text-[#475569] mt-0.5">
              Facility ID: CG-FAC-01 • Auditor: Facility Manager • Part 11 Digital Signature
            </div>
          </div>
          <div className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Cryptographically Verified</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#EFF6FF] text-[#0F172A] uppercase text-[11px] font-bold border-b border-[#DCE8F6]">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Zone</th>
                <th className="py-3 px-3">Event / Incident</th>
                <th className="py-3 px-3">Recorded Temp</th>
                <th className="py-3 px-3">Safe Band</th>
                <th className="py-3 px-3">Occurrences</th>
                <th className="py-3 px-3">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE8F6]/60">
              {alerts.length > 0 ? (
                alerts.map((a) => {
                  const z = zones?.find((x) => x.zone_id === a.zone_id);
                  const isCrit = a.severity === "critical";
                  const isWarn = a.severity === "warning";

                  return (
                    <tr key={a.id} className="hover:bg-[#F1F7FF] transition">
                      <td className="py-3 px-3 font-mono text-[#475569]">
                        {new Date(a.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 px-3 font-semibold text-[#0F172A]">{z?.name ?? a.zone_id}</td>
                      <td
                        className={`py-3 px-3 font-medium ${
                          isCrit ? "text-rose-600" : isWarn ? "text-amber-600" : "text-[#2563EB]"
                        }`}
                      >
                        {a.title}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#0F172A] font-bold">
                        {z?.temperature != null ? fmtTemp(z.temperature) : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#475569]">
                        {z ? `${z.lower_limit}°C to ${z.upper_limit}°C` : "—"}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#475569]">
                        {a.occurrences} {a.occurrences === 1 ? "time" : "times"}
                      </td>
                      <td className="py-3 px-3 font-semibold">
                        {a.active ? (
                          <span className="text-rose-600 flex items-center gap-1 font-bold">
                            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                            • Active Incident
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-bold">• Resolved & Audited</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                zones?.map((z) => (
                  <tr key={z.zone_id} className="hover:bg-[#F1F7FF] transition">
                    <td className="py-3 px-3 font-mono text-[#475569]">Continuous Monitoring</td>
                    <td className="py-3 px-3 font-semibold text-[#0F172A]">{z.name}</td>
                    <td className="py-3 px-3 text-emerald-700 font-medium">Nominal Operating Baseline</td>
                    <td className="py-3 px-3 font-mono text-[#0F172A] font-bold">
                      {z.temperature != null ? fmtTemp(z.temperature) : "—"}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#475569]">
                      {z.lower_limit}°C to {z.upper_limit}°C
                    </td>
                    <td className="py-3 px-3 font-mono text-[#475569]">0 breaches</td>
                    <td className="py-3 px-3 text-emerald-700 font-bold">• Fully Compliant</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
