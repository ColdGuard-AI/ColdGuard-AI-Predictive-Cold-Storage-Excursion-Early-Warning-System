/* ─────────────────────────────────────────────────────────────────────────────
   Operator — Equipment & Sensor Health (Arctic Blue Design System)
   Pulls from /api/zones for sensor health, power, compressor status
───────────────────────────────────────────────────────────────────────────── */
import { useApp } from "../../hooks/AppContext";
import { Cpu, Thermometer, Zap, Droplets, Activity } from "lucide-react";

function HealthBar({ value, max = 100, color = "primary" }: any) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const col =
    color === "primary"
      ? "bg-[#2563EB]"
      : color === "sky"
      ? "bg-[#38BDF8]"
      : color === "amber"
      ? "bg-[#F59E0B]"
      : color === "red"
      ? "bg-[#EF4444]"
      : "bg-[#10B981]";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-[#F1F7FF] border border-[#DCE8F6] rounded-full h-2.5 overflow-hidden p-[1px]">
        <div className={`h-full rounded-full transition-all duration-500 ${col}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-mono font-bold w-12 text-right text-[#0F172A]">{value.toFixed(1)}</span>
    </div>
  );
}

function SensorCard({ zone }: { zone: any }) {
  const health = zone.sensor_health;
  const isHealthy = !health || health === "ok" || health === "healthy";
  return (
    <div
      className={`rounded-2xl border p-6 bg-white shadow-arctic-card hover:shadow-arctic-hover transition-all duration-200 space-y-5 ${
        !isHealthy ? "border-amber-300 ring-2 ring-amber-100" : "border-[#DCE8F6]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#EFF6FF] border border-[#BAE6FD] text-[#2563EB] flex items-center justify-center font-bold">
            <Cpu size={20} />
          </div>
          <div>
            <div className="font-extrabold text-[#0F172A] text-lg">{zone.name}</div>
            <div className="text-xs font-mono font-semibold text-[#475569]">{zone.zone_id}</div>
          </div>
        </div>
        <span
          className={`text-xs font-bold uppercase rounded-full px-3 py-1 border ${
            isHealthy
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}
        >
          {isHealthy ? "Healthy" : health}
        </span>
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2 mb-1.5">
            <Thermometer size={16} className="text-[#2563EB]" />
            Temperature (°C)
          </div>
          <HealthBar
            value={zone.temperature ?? 0}
            max={60}
            color={Math.abs(zone.temperature ?? 0) > 25 ? "red" : "primary"}
          />
        </div>

        <div>
          <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2 mb-1.5">
            <Droplets size={16} className="text-[#38BDF8]" />
            Humidity (%RH)
          </div>
          <HealthBar value={zone.humidity ?? 0} max={100} color={zone.humidity > 85 ? "amber" : "sky"} />
        </div>

        <div>
          <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2 mb-1.5">
            <Zap size={16} className="text-[#2563EB]" />
            Power Draw (kW)
          </div>
          <HealthBar value={zone.power_consumption_kw ?? 0} max={10} color="primary" />
        </div>

        <div>
          <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2 mb-1.5">
            <Activity size={16} className="text-[#38BDF8]" />
            Compressor Duty Load (%)
          </div>
          <HealthBar
            value={zone.compressor_load_pct ?? 0}
            max={100}
            color={
              zone.compressor_load_pct > 90
                ? "red"
                : zone.compressor_load_pct > 70
                ? "amber"
                : "primary"
            }
          />
        </div>
      </div>

      <div className="pt-3 border-t border-[#DCE8F6] flex justify-between text-sm text-[#475569]">
        <span>
          Compressor: <strong className="font-bold text-[#0F172A]">{zone.compressor_status ?? "Active"}</strong>
        </span>
        <span>
          Door:{" "}
          <strong
            className={`font-bold ${
              zone.door_status === "open" ? "text-amber-700 font-extrabold" : "text-[#0F172A]"
            }`}
          >
            {zone.door_status ?? "Closed"}
          </strong>
        </span>
      </div>
    </div>
  );
}

export default function EquipmentHealth() {
  const { zones, zonesLoading } = useApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] flex items-center gap-3">
          <Cpu size={28} className="text-[#2563EB]" /> Equipment & Sensor Health Telemetry
        </h1>
        <p className="text-base text-[#475569] mt-1 font-medium">
          Real-time equipment performance, compressor duty cycles, and sensor drift status across the facility.
        </p>
      </div>

      {zonesLoading ? (
        <div className="py-14 text-center text-base font-medium text-[#475569]">Loading sensor telemetry…</div>
      ) : !zones?.length ? (
        <div className="py-14 text-center text-base font-medium text-[#475569]">
          No sensor data available. Waiting for telemetry ingestion.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {zones.map((z: any) => (
            <SensorCard key={z.zone_id} zone={z} />
          ))}
        </div>
      )}
    </div>
  );
}
