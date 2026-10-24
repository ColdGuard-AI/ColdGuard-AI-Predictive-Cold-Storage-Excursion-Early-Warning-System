/* ─────────────────────────────────────────────────────────────────────────────
   Manager Dashboard — Overview Page
   Premium Arctic Blue Design System
   Pulls from /api/manager/overview + /api/zones + /api/alerts
───────────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import {
  Activity, AlertTriangle, BellRing, CheckCircle2, Package,
  RefreshCw, ShieldCheck, Thermometer, TrendingDown, TrendingUp, Zap,
} from "lucide-react";
import { api } from "../../services/api";
import { useApp } from "../../hooks/AppContext";

function StatCard({ label, value, sub, icon: Icon, color = "blue", alert = false }: any) {
  const iconColors: any = {
    blue: "text-[#2563EB] bg-[#EFF6FF] border-[#DCE8F6]",
    green: "text-emerald-700 bg-emerald-50 border-emerald-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    red: "text-red-700 bg-red-50 border-red-200",
  };
  const c = iconColors[color] ?? iconColors.blue;
  return (
    <div className={`rounded-2xl border border-[#DCE8F6] bg-white p-5 sm:p-6 flex flex-col gap-3 shadow-arctic-card hover:shadow-arctic-hover hover:border-[#BAE6FD] transition-all ${
      alert ? "ring-2 ring-red-200 border-red-300" : ""
    }`}>
      <div className="flex items-center justify-between">
        <span className="text-sm sm:text-base font-bold text-[#475569]">{label}</span>
        <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${c}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="text-3xl font-extrabold tracking-tight text-[#0F172A]">{value}</div>
      {sub && <div className="text-xs sm:text-sm font-medium text-[#475569]">{sub}</div>}
    </div>
  );
}

function ZoneStatusRow({ zone }: { zone: any }) {
  const risk = zone.risk_score ?? 0;
  const riskColor = risk >= 70 ? "text-red-700 font-bold" : risk >= 40 ? "text-amber-700 font-bold" : "text-emerald-700 font-bold";
  const statusDot = zone.temperature_status === "critical" ? "bg-red-500" : zone.temperature_status === "warning" ? "bg-amber-400" : "bg-emerald-500";
  return (
    <tr className="border-b border-[#DCE8F6] hover:bg-slate-50/70 transition">
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusDot}`} />
          <span className="font-bold text-[#0F172A] text-base">{zone.name}</span>
        </div>
      </td>
      <td className="py-4 px-5 text-base font-mono font-bold text-[#0F172A]">{zone.temperature?.toFixed(1) ?? "—"}°C</td>
      <td className="py-4 px-5 text-base font-medium text-[#475569]">{zone.humidity?.toFixed(0) ?? "—"}%</td>
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-slate-100 border border-[#DCE8F6] rounded-full h-2 max-w-[90px]">
            <div className={`h-2 rounded-full ${risk >= 70 ? "bg-red-500" : risk >= 40 ? "bg-amber-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, risk)}%` }} />
          </div>
          <span className={`text-sm ${riskColor}`}>{risk}%</span>
        </div>
      </td>
      <td className="py-4 px-5">
        <span className={`rounded-full px-3 py-1 text-xs font-bold border shadow-sm ${
          zone.scenario === "normal" || !zone.scenario ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"
        }`}>
          {zone.scenario || "Normal"}
        </span>
      </td>
      <td className="py-4 px-5 text-sm font-semibold text-[#475569]">{zone.active_alert_count || 0} active</td>
    </tr>
  );
}

export default function ManagerOverview() {
  const { zones, health } = useApp();
  const [overview, setOverview] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function refresh() {
    setLoading(true);
    try {
      const [ov, al] = await Promise.all([
        api.managerOverview(240).catch(() => null),
        api.alerts({ active: true, limit: 5 }).catch(() => []),
      ]);
      setOverview(ov);
      setAlerts(al as any[]);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }

  useEffect(() => { refresh(); }, []);

  const totalRisk = overview?.zones_summary?.reduce((a: number, z: any) => a + (z.risk_score ?? 0), 0) ?? 0;
  const avgRisk = zones?.length ? Math.round(totalRisk / (zones.length || 1)) : 0;
  const activeAlerts = zones?.reduce((n, z) => n + z.active_alert_count, 0) ?? 0;
  const totalPower = zones?.reduce((n, z) => n + (z.power_consumption_kw ?? 0), 0) ?? 0;
  const zonesAtRisk = zones?.filter(z => (z.risk_score ?? 0) >= 40).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
            <ShieldCheck size={28} className="text-[#2563EB]" /> Cold Storage Manager Overview
          </h1>
          <p className="text-base text-[#475569] mt-1 font-medium">Facility-wide operational oversight, telemetry telemetry, and excursion posture</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm font-medium text-[#475569]">Updated: {lastRefresh.toLocaleTimeString()}</span>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-[#DCE8F6] bg-white hover:bg-[#EFF6FF] hover:border-[#BAE6FD] hover:text-[#2563EB] px-4 py-2.5 text-sm font-bold text-[#0F172A] transition shadow-sm cursor-pointer"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard label="Active Sensor Zones" value={zones?.length ?? "—"} sub="Operational chambers" icon={Activity} color="blue" />
        <StatCard label="Active Alerts" value={activeAlerts} sub="Requires attention" icon={BellRing} color={activeAlerts > 0 ? "amber" : "green"} alert={activeAlerts > 2} />
        <StatCard label="Avg. Facility Risk" value={`${avgRisk}%`} sub="Across active rooms" icon={ShieldCheck} color={avgRisk >= 70 ? "red" : avgRisk >= 40 ? "amber" : "green"} />
        <StatCard label="Compressor Load" value={`${totalPower.toFixed(1)} kW`} sub="Real-time draw" icon={Zap} color="blue" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard label="Chambers at Risk" value={zonesAtRisk} sub="Risk score ≥ 40%" icon={AlertTriangle} color={zonesAtRisk > 0 ? "amber" : "green"} />
        <StatCard label="Excursions (24h)" value={overview?.excursions_24h ?? 0} sub="Threshold breaches" icon={TrendingUp} color={overview?.excursions_24h > 0 ? "red" : "green"} />
        <StatCard label="Readings Stored" value={(overview?.readings_stored ?? 0).toLocaleString()} sub="Verified records" icon={Package} color="blue" />
        <StatCard label="Simulator Engine" value={health?.simulator_running ? "Active" : "Paused"} sub={`Sim: ${health?.sim_time?.slice(11, 19) ?? "—"}`} icon={Activity} color={health?.simulator_running ? "green" : "amber"} />
      </div>

      {/* Zone table */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <Thermometer size={20} className="text-[#2563EB]" />
            <h2 className="text-lg font-bold text-[#0F172A]">Live Cold Room Status</h2>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-[#2563EB] bg-[#EFF6FF] border border-[#BAE6FD] px-3 py-1 rounded-full">{zones?.length ?? 0} Zones Monitored</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-base font-medium text-[#475569]">Loading live zone telemetry…</div>
        ) : !zones?.length ? (
          <div className="py-12 text-center text-base font-medium text-[#475569]">No zone telemetry available yet. Waiting for sensor stream.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#EFF6FF] border-b border-[#DCE8F6] text-xs sm:text-sm font-bold text-[#475569] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-5">Cold Room</th>
                  <th className="py-3.5 px-5">Current Temp</th>
                  <th className="py-3.5 px-5">Humidity</th>
                  <th className="py-3.5 px-5">AI Risk Index</th>
                  <th className="py-3.5 px-5">Condition</th>
                  <th className="py-3.5 px-5">Active Alerts</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z: any) => <ZoneStatusRow key={z.zone_id} zone={z} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent alerts */}
      <div className="rounded-2xl border border-[#DCE8F6] bg-white shadow-arctic-card overflow-hidden">
        <div className="px-6 py-4 border-b border-[#DCE8F6] flex items-center gap-2.5 bg-slate-50/50">
          <BellRing size={20} className="text-[#2563EB]" />
          <h2 className="text-lg font-bold text-[#0F172A]">Recent Excursion Warnings & Alerts</h2>
        </div>
        {!alerts.length ? (
          <div className="py-8 text-center text-base font-medium text-[#475569]">No active alerts — all cold rooms are operating within normal ranges.</div>
        ) : (
          <div className="divide-y divide-[#DCE8F6]">
            {alerts.map((a: any) => (
              <div key={a.id} className="px-6 py-4 flex items-start gap-4 hover:bg-slate-50/50 transition">
                <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${a.severity === "critical" ? "bg-red-500" : a.severity === "warning" ? "bg-amber-400" : "bg-[#2563EB]"}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-[#0F172A] truncate">{a.title}</div>
                  <div className="text-sm font-medium text-[#475569] mt-0.5">{a.zone_id} — {a.category_label ?? a.category}</div>
                </div>
                <span className={`text-xs uppercase font-bold rounded-full px-3 py-1 border shrink-0 ${
                  a.severity === "critical" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"
                }`}>{a.severity}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
