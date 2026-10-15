import { useCallback, useEffect, useRef, useState } from "react";

export interface PollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean; // true only until the first response (success or failure)
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
}

/**
 * Calls `fetcher` immediately and then every `intervalMs`. Keeps the last good data when
 * a request fails (so charts don't blank out) and exposes the error separately.
 * Re-runs from scratch whenever `deps` change.
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[] = []): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const generation = useRef(0);

  const run = useCallback(async (gen: number) => {
    try {
      const result = await fetcherRef.current();
      if (gen !== generation.current) return;
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (gen !== generation.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (gen === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const gen = ++generation.current;
    setLoading(true);
    setData(null);
    setError(null);
    void run(gen);
    if (intervalMs <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void run(gen);
    }, intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, run, ...deps]);

  const refresh = useCallback(() => run(generation.current), [run]);
  return { data, error, loading, lastUpdated, refresh };
}
