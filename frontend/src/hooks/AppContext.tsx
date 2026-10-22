import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { Health, ZoneSummary } from "../types/api";
import { POLL_MS } from "../lib/format";
import { usePolling } from "./usePolling";

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

export interface AppState {
  zones: ZoneSummary[] | null;
  allZones: ZoneSummary[] | null;
  zonesError: string | null;
  zonesLoading: boolean;
  refreshZones: () => Promise<void>;
  health: Health | null;
  healthError: string | null;
  selectedZoneId: string;
  setSelectedZoneId: (id: string) => void;
  selectedZone: ZoneSummary | null;
  totalPowerKw: number;
  facilityRisk: number;
  activeAlerts: any[];
  tickCount: number;
  simTimestamp: string | null;
  streamConnected: boolean;
  tempHistories: Record<string, number[]>;
  toasts: Toast[];
  notify: (kind: Toast["kind"], message: string) => void;
  dismiss: (id: number) => void;
}

const AppContext = createContext<AppState | null>(null);
const STORAGE_KEY = "coldguard.selectedZone";
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

function readStoredZone(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "zone-a";
  } catch {
    return "zone-a";
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  // REST Polling as baseline fallback
  const zonesPoll = usePolling(api.zones, POLL_MS);
  const healthPoll = usePolling(api.health, 4000);

  // Real-Time SSE Stream State
  const [streamZones, setStreamZones] = useState<ZoneSummary[] | null>(null);
  const [facilityRisk, setFacilityRisk] = useState<number>(0);
  const [totalPowerKw, setTotalPowerKw] = useState<number>(0);
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  const [tickCount, setTickCount] = useState<number>(0);
  const [simTimestamp, setSimTimestamp] = useState<string | null>(null);
  const [streamConnected, setStreamConnected] = useState<boolean>(false);
  const [tempHistories, setTempHistories] = useState<Record<string, number[]>>({});

  const [selectedZoneId, setSelected] = useState<string>(readStoredZone);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // ═══════════════════════════════════════════════════════════════════
  // UNIFIED REAL-TIME SSE STREAM (Single Source of Truth for Whole App)
  // ═══════════════════════════════════════════════════════════════════
  const connectStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      const es = new EventSource(`${BASE_URL}/api/stream/telemetry`);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStreamConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.zones && Array.isArray(payload.zones)) {
            const mappedZones: ZoneSummary[] = payload.zones.map((z: any) => ({
              zone_id: z.zone_id,
              name: z.name,
              product: z.product,
              sensor_id: z.sensor_id ?? (z.zone_id === "zone-a" ? "TS-A01" : z.zone_id === "zone-b" ? "TS-B01" : "TS-C01"),
              setpoint: z.setpoint,
              lower_limit: z.lower_limit,
              upper_limit: z.upper_limit,
              scenario: z.scenario,
              scenario_label: z.scenario_label,
              timestamp: z.timestamp ?? payload.timestamp,
              temperature: z.temperature,
              humidity: z.humidity,
              ambient_temperature: z.ambient_temperature,
              temperature_status: z.temperature_status,
              compressor_status: z.compressor_status,
              compressor_load_pct: z.compressor_load_pct,
              power_consumption_kw: z.power_consumption_kw,
              sensor_health: z.sensor_health,
              door_status: z.door_status,
              door_open_minutes: z.door_open_minutes,
              compressor_off_minutes: z.compressor_off_minutes,
              sensor_status: z.sensor_status,
              sensor_issues: z.sensor_issues ?? [],
              risk_score: z.risk_score,
              risk_category: z.risk_category,
              trend_per_hour: z.trend_per_hour,
              time_to_breach_minutes: z.time_to_breach_minutes,
              warning_time_to_breach_minutes: z.warning_time_to_breach_minutes,
              active_alert_count: z.active_alert_count,
              latest_alert: z.latest_alert ?? null,
              forecast_available: z.forecast_available,
              forecast_points: z.forecast_points,
              excursion_expected: z.excursion_expected,
              slope_per_min: z.slope_per_min,
              is_synthetic: true,
            }));

            setStreamZones(mappedZones);
            setFacilityRisk(payload.facility_risk ?? 0);
            setTotalPowerKw(payload.total_power_kw ?? 0);
            setActiveAlerts(payload.alerts ?? []);
            setTickCount(payload.tick_count ?? 0);
            setSimTimestamp(payload.timestamp ?? null);
            setStreamConnected(true);

            // Ring buffer of last 60 readings per zone
            setTempHistories((prev) => {
              const next = { ...prev };
              for (const z of mappedZones) {
                if (z.temperature !== null && z.temperature !== undefined) {
                  const arr = [...(next[z.zone_id] ?? []), z.temperature];
                  next[z.zone_id] = arr.slice(-60);
                }
              }
              return next;
            });
          }
        } catch (err) {
          console.error("SSE parsing error in AppContext:", err);
        }
      };

      es.onerror = () => {
        setStreamConnected(false);
        es.close();
        reconnectTimeoutRef.current = window.setTimeout(connectStream, 3000);
      };
    } catch (err) {
      console.warn("SSE connection error in AppContext, relying on REST polling:", err);
      setStreamConnected(false);
    }
  }, []);

  useEffect(() => {
    connectStream();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectStream]);

  // Unified zones list: stream data takes precedence, falls back to REST poll
  const effectiveZones = useMemo(() => {
    if (streamZones && streamZones.length > 0) {
      return streamZones;
    }
    return zonesPoll.data ?? null;
  }, [streamZones, zonesPoll.data]);

  const setSelectedZoneId = useCallback((id: string) => {
    setSelected(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable - selection just won't persist */
    }
  }, []);

  // Fall back to the first zone if the stored one no longer exists.
  useEffect(() => {
    if (effectiveZones?.length && !effectiveZones.some((z) => z.zone_id === selectedZoneId)) {
      setSelectedZoneId(effectiveZones[0].zone_id);
    }
  }, [effectiveZones, selectedZoneId, setSelectedZoneId]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (kind: Toast["kind"], message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  const selectedZone = useMemo(() => {
    if (!effectiveZones?.length) return null;
    return effectiveZones.find((z) => z.zone_id === selectedZoneId) ?? effectiveZones[0];
  }, [effectiveZones, selectedZoneId]);

  const value = useMemo<AppState>(
    () => ({
      zones: effectiveZones,
      allZones: effectiveZones,
      zonesError: zonesPoll.error,
      zonesLoading: !effectiveZones && zonesPoll.loading,
      refreshZones: zonesPoll.refresh,
      health: healthPoll.data,
      healthError: healthPoll.error,
      selectedZoneId,
      setSelectedZoneId,
      selectedZone,
      totalPowerKw,
      facilityRisk,
      activeAlerts,
      tickCount,
      simTimestamp,
      streamConnected,
      tempHistories,
      toasts,
      notify,
      dismiss,
    }),
    [
      effectiveZones,
      zonesPoll.error,
      zonesPoll.loading,
      zonesPoll.refresh,
      healthPoll.data,
      healthPoll.error,
      selectedZoneId,
      setSelectedZoneId,
      selectedZone,
      totalPowerKw,
      facilityRisk,
      activeAlerts,
      tickCount,
      simTimestamp,
      streamConnected,
      tempHistories,
      toasts,
      notify,
      dismiss,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
