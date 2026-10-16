import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../services/api";
import type { Health, ZoneSummary } from "../types/api";
import { POLL_MS } from "../lib/format";
import { usePolling } from "./usePolling";

interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface AppState {
  zones: ZoneSummary[] | null;
  zonesError: string | null;
  zonesLoading: boolean;
  refreshZones: () => Promise<void>;
  health: Health | null;
  healthError: string | null;
  selectedZoneId: string;
  setSelectedZoneId: (id: string) => void;
  selectedZone: ZoneSummary | null;
  toasts: Toast[];
  notify: (kind: Toast["kind"], message: string) => void;
  dismiss: (id: number) => void;
}

const AppContext = createContext<AppState | null>(null);
const STORAGE_KEY = "coldguard.selectedZone";

function readStoredZone(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "zone-a";
  } catch {
    return "zone-a";
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const zonesPoll = usePolling(api.zones, POLL_MS);
  const healthPoll = usePolling(api.health, 4000);
  const [selectedZoneId, setSelected] = useState<string>(readStoredZone);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
    if (zonesPoll.data?.length && !zonesPoll.data.some((z) => z.zone_id === selectedZoneId)) {
      setSelectedZoneId(zonesPoll.data[0].zone_id);
    }
  }, [zonesPoll.data, selectedZoneId, setSelectedZoneId]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (kind: Toast["kind"], message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
    },
    [dismiss],
  );

  // Single store mode: restrict active zones to the primary store (zone-a)
  const singleStoreList = useMemo(() => {
    if (!zonesPoll.data?.length) return null;
    return [zonesPoll.data[0]];
  }, [zonesPoll.data]);

  const value = useMemo<AppState>(
    () => ({
      zones: singleStoreList,
      zonesError: zonesPoll.error,
      zonesLoading: zonesPoll.loading,
      refreshZones: zonesPoll.refresh,
      health: healthPoll.data,
      healthError: healthPoll.error,
      selectedZoneId: "zone-a",
      setSelectedZoneId,
      selectedZone: zonesPoll.data?.[0] ?? null,
      toasts,
      notify,
      dismiss,
    }),
    [singleStoreList, zonesPoll.data, zonesPoll.error, zonesPoll.loading, zonesPoll.refresh, healthPoll.data, healthPoll.error,
      setSelectedZoneId, toasts, notify, dismiss],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
