import { Droplets, LineChart, Thermometer } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartLegend, HistoryTemperatureChart, HumidityChart } from "../components/charts";
import { Card, EmptyState, ErrorState, LoadingState, Segmented, SimulatedBadge, Stat, StaleBanner } from "../components/ui";
import { ZoneTabs } from "../components/zone";
import { useApp } from "../hooks/AppContext";
import { usePolling } from "../hooks/usePolling";
import { CHART, fmtTemp } from "../lib/format";
import { api } from "../services/api";
import type { Reading } from "../types/api";

const RANGES = [
  { value: 60, label: "1 h" },
  { value: 180, label: "3 h" },
  { value: 360, label: "6 h" },
  { value: 720, label: "12 h" },
  { value: 1440, label: "24 h" },
];

function summarize(readings: Reading[]) {
  const temps = readings.map((r) => r.temperature).filter((t): t is number => t != null);
  const hums = readings.map((r) => r.humidity).filter((h): h is number => h != null);
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  return {
    min: temps.length ? Math.min(...temps) : null,
    max: temps.length ? Math.max(...temps) : null,
    avg: avg(temps),
    humAvg: avg(hums),
    missing: readings.length - temps.length,
    doorMinutes: readings.filter((r) => r.door_status === "open").length,
    compOffMinutes: readings.filter((r) => r.compressor_status === "stopped").length,
  };
}

export default function History() {
  const { selectedZone, selectedZoneId } = useApp();
  const [minutes, setMinutes] = useState(180);
  const [showForecast, setShowForecast] = useState(true);
  const readings = usePolling(() => api.readings(selectedZoneId, minutes), 3000, [selectedZoneId, minutes]);
  const forecast = usePolling(() => api.forecast(selectedZoneId, 60), 3000, [selectedZoneId]);
  const stats = useMemo(() => summarize(readings.data?.readings ?? []), [readings.data]);
  const data = readings.data?.readings ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-fg"><LineChart size={20} className="text-neon" /> Sensor History</h1>
          <p className="text-sm text-fg-muted">Observed readings with optional forecast overlay. <SimulatedBadge /></p>
        </div>
        <ZoneTabs />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented label="Time range" value={minutes} onChange={setMinutes} options={RANGES} />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-fg-muted">
          <input type="checkbox" className="accent-[#3dff8f]" checked={showForecast} onChange={(e) => setShowForecast(e.target.checked)} />
          Show 60-min forecast
        </label>
        {readings.data && <span className="text-xs text-fg-faint">{readings.data.count} readings</span>}
      </div>
      <StaleBanner error={readings.data ? readings.error : null} />

      <div className="grid grid-cols-2 gap-3 rounded-xl border border-neon/10 bg-ink-800/90 p-4 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Min" value={fmtTemp(stats.min, 2)} />
        <Stat label="Max" value={fmtTemp(stats.max, 2)} />
        <Stat label="Average" value={fmtTemp(stats.avg, 2)} />
        <Stat label="Avg humidity" value={stats.humAvg != null ? `${stats.humAvg.toFixed(0)}%` : "—"} />
        <Stat label="Missing" value={stats.missing} tip="Readings where the sensor returned no temperature value." />
        <Stat label="Door open" value={`${stats.doorMinutes} min`} />
        <Stat label="Compressor off" value={`${stats.compOffMinutes} min`} />
      </div>

      <Card title="Temperature" icon={<Thermometer size={15} />}>
        {readings.loading && !readings.data ? (
          <LoadingState />
        ) : readings.error && !readings.data ? (
          <ErrorState message={readings.error} onRetry={readings.refresh} />
        ) : !data.length ? (
          <EmptyState title="No readings in this range" />
        ) : (
          <>
            <HistoryTemperatureChart
              readings={data}
              forecast={showForecast ? forecast.data : null}
              lower={selectedZone?.lower_limit ?? 0}
              upper={selectedZone?.upper_limit ?? 0}
              showEvents
              height={320}
            />
            <div className="mt-3">
              <ChartLegend
                items={[
                  { label: "Observed", color: CHART.observed },
                  ...(showForecast ? [{ label: "Forecast", color: CHART.forecast, dashed: true }, { label: "Tree spread", color: CHART.band, area: true }] : []),
                  { label: "Limits", color: CHART.limit, dashed: true },
                ]}
              />
            </div>
          </>
        )}
      </Card>

      <Card title="Humidity" icon={<Droplets size={15} />}>
        {readings.loading && !readings.data ? (
          <LoadingState />
        ) : !data.length ? (
          <EmptyState title="No readings in this range" />
        ) : (
          <HumidityChart readings={data} />
        )}
      </Card>
    </div>
  );
}
