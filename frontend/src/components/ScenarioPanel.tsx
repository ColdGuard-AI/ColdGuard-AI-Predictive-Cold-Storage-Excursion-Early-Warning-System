import { DoorOpen, FastForward, Pause, Play, Power, RotateCcw, ScanLine, ShieldCheck, Sun, TimerReset } from "lucide-react";
import { useState } from "react";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { api } from "../services/api";
import type { ScenarioId } from "../types/api";
import { Badge, Button, Card, InfoTip, Segmented } from "./ui";

const SCENARIOS: { id: ScenarioId; label: string; icon: typeof Power; hint: string }[] = [
  { id: "normal", label: "Normal Operation", icon: ShieldCheck, hint: "Thermostat holds the setpoint; brief routine door openings." },
  { id: "compressor_failure", label: "Compressor Failure", icon: Power, hint: "Compressor stops; temperature rises toward ambient." },
  { id: "door_open", label: "Door Left Open", icon: DoorOpen, hint: "Door stays open; warm, humid air enters faster than the unit can remove heat." },
  { id: "ambient_increase", label: "Ambient Increase", icon: Sun, hint: "Surroundings warm by 18°C over 15 min; cooling capacity drops." },
  { id: "sensor_anomaly", label: "Sensor Anomaly", icon: ScanLine, hint: "Sensor reports spikes, then drops readings, then freezes on one value. Real temperature is unaffected." },
];

export function ScenarioPanel() {
  const { selectedZone, selectedZoneId, notify, refreshZones } = useApp();
  const status = usePolling(api.simulatorStatus, 2000);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<{ message: string }>) => {
    setBusy(key);
    try {
      const res = await action();
      notify("success", res.message);
      await Promise.all([status.refresh(), refreshZones()]);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const zoneState = status.data?.zones[selectedZoneId];
  const active = zoneState?.scenario ?? selectedZone?.scenario ?? "normal";
  const running = status.data?.running ?? false;

  return (
    <Card
      title="Scenario Simulator"
      icon={<TimerReset size={15} />}
      tip="Scenarios change the simulator's inputs (compressor, door, ambient, sensor). Readings, forecasts, risk and alerts then respond through the normal pipeline — nothing on screen is scripted."
      actions={<Badge tone={active === "normal" ? "ok" : "warn"} dot>{zoneState?.label ?? "—"}{active !== "normal" && zoneState ? ` · ${zoneState.scenario_minutes} min` : ""}</Badge>}
    >
      <p className="mb-3 text-xs text-fg-muted">
        Applies to <span className="text-fg">{selectedZone?.name ?? selectedZoneId}</span>. One tick = one simulated minute.
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SCENARIOS.map(({ id, label, icon: Icon, hint }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => run(id, () => (id === "normal" ? api.reset("scenario", selectedZoneId) : api.setScenario(selectedZoneId, id)))}
              disabled={busy !== null}
              aria-pressed={isActive}
              title={hint}
              className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors disabled:opacity-60 ${
                isActive
                  ? id === "normal" ? "border-neon/40 bg-neon/[0.07]" : "border-warn/40 bg-warn/[0.07]"
                  : "border-white/[0.07] bg-ink-900/60 hover:border-neon/30"
              } ${id === "normal" ? "sm:col-span-2" : ""}`}
            >
              <Icon size={16} className={isActive ? (id === "normal" ? "text-neon" : "text-warn") : "text-fg-muted"} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{id === "normal" && active !== "normal" ? "Return to Normal Operation" : label}</span>
                <span className="block text-[11px] leading-snug text-fg-faint">{hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
        <Button
          size="sm"
          onClick={() => run("pause", () => api.control({ running: !running }))}
          loading={busy === "pause"}
          aria-label={running ? "Pause simulator" : "Resume simulator"}
        >
          {running ? <Pause size={13} /> : <Play size={13} />} {running ? "Pause" : "Resume"}
        </Button>
        <Segmented
          label="Simulation speed"
          value={status.data?.tick_seconds ?? 1}
          onChange={(v) => run("speed", () => api.control({ tick_seconds: v }))}
          options={[
            { value: 2, label: "0.5×" },
            { value: 1, label: "1×" },
            { value: 0.5, label: "2×" },
          ]}
        />
        <InfoTip text="1× = one simulated minute per real second." />
        <Button size="sm" onClick={() => run("ff", () => api.advance(10))} loading={busy === "ff"}>
          <FastForward size={13} /> +10 min
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          loading={busy === "full"}
          onClick={() => {
            if (window.confirm("Full reset: clear all readings and alerts and restart the demo from normal operation?")) {
              void run("full", () => api.reset("full"));
            }
          }}
        >
          <RotateCcw size={13} /> Full reset
        </Button>
      </div>
      {status.error && <p className="mt-2 text-xs text-crit">Simulator status unavailable: {status.error}</p>}
    </Card>
  );
}
