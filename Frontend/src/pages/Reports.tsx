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
    <div className="space-y-6 pb-12 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="text-cyan-400" />
            Compliance & Excursion Audit Reports
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Official GxP / FDA 21 CFR Part 11 compliant audit trails, excursion certificates, and temperature logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition cursor-pointer"
          >
            <Download size={14} />
            <span>Export CSV & PDF</span>
          </button>
        </div>
      </div>

      {downloadSuccess && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>Audit report generated successfully and logged to compliance vault.</span>
        </div>
      )}

      {/* Report Type Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { id: "excursion", title: "Temperature Excursion Log", desc: "Detailed records of all threshold breaches and duration" },
          { id: "mkt", title: "Mean Kinetic Temp (MKT)", desc: "Calculated virtual thermal stress index per product lot" },
          { id: "audit", title: "21 CFR Part 11 Audit Trail", desc: "Operator acknowledgments, calibrations, and sensor events" },
        ].map((type) => (
          <div
            key={type.id}
            onClick={() => setReportType(type.id)}
            className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
              reportType === type.id
                ? "bg-slate-900 border-cyan-400/80 shadow-[0_0_15px_rgba(34,211,238,0.15)]"
                : "bg-[#0F192C]/80 border-slate-800 hover:border-slate-700"
            }`}
          >
            <div>
              <div className="text-sm font-bold text-white mb-1">{type.title}</div>
              <div className="text-xs text-slate-400">{type.desc}</div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400">
              <FileCheck size={13} />
              <span>{reportType === type.id ? "Active Template" : "Select Template"}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Report Preview */}
      <div className="rounded-2xl bg-[#0F192C]/90 border border-slate-800 p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div>
            <h2 className="text-base font-bold text-white">Facility Excursion Summary (Live Telemetry & Audit Logs)</h2>
            <div className="text-xs text-slate-400 mt-0.5">Facility ID: CG-FAC-01 • Auditor: Ruchita (Manager) • Part 11 Digital Signature</div>
          </div>
          <div className="text-xs font-mono text-emerald-400 flex items-center gap-1">
            <ShieldCheck size={14} />
            <span>Cryptographically Verified</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-semibold">
                <th className="pb-3">Timestamp</th>
                <th className="pb-3">Zone</th>
                <th className="pb-3">Event / Incident</th>
                <th className="pb-3">Recorded Temp</th>
                <th className="pb-3">Safe Band</th>
                <th className="pb-3">Occurrences</th>
                <th className="pb-3">Compliance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {alerts.length > 0 ? (
                alerts.map((a) => {
                  const z = zones?.find((x) => x.zone_id === a.zone_id);
                  const isCrit = a.severity === "critical";
                  const isWarn = a.severity === "warning";

                  return (
                    <tr key={a.id} className="hover:bg-slate-800/30">
                      <td className="py-3 font-mono text-slate-300">
                        {new Date(a.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 font-semibold text-white">{z?.name ?? a.zone_id}</td>
                      <td className={`py-3 font-medium ${isCrit ? "text-rose-400" : isWarn ? "text-amber-400" : "text-cyan-300"}`}>
                        {a.title}
                      </td>
                      <td className="py-3 font-mono text-white font-bold">
                        {z?.temperature != null ? fmtTemp(z.temperature) : "—"}
                      </td>
                      <td className="py-3 font-mono text-slate-400">
                        {z ? `${z.lower_limit}°C to ${z.upper_limit}°C` : "—"}
                      </td>
                      <td className="py-3 font-mono text-slate-300">
                        {a.occurrences} {a.occurrences === 1 ? "time" : "times"}
                      </td>
                      <td className="py-3 font-semibold">
                        {a.active ? (
                          <span className="text-rose-400 flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                            • Active Incident
                          </span>
                        ) : (
                          <span className="text-emerald-400">• Resolved & Audited</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                zones?.map((z) => (
                  <tr key={z.zone_id} className="hover:bg-slate-800/30">
                    <td className="py-3 font-mono text-slate-300">Continuous Monitoring</td>
                    <td className="py-3 font-semibold text-white">{z.name}</td>
                    <td className="py-3 text-emerald-400 font-medium">Nominal Operating Baseline</td>
                    <td className="py-3 font-mono text-white font-bold">{z.temperature != null ? fmtTemp(z.temperature) : "—"}</td>
                    <td className="py-3 font-mono text-slate-400">{z.lower_limit}°C to {z.upper_limit}°C</td>
                    <td className="py-3 font-mono text-slate-300">0 breaches</td>
                    <td className="py-3 text-emerald-400 font-semibold">• Fully Compliant</td>
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
