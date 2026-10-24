import type {
  Alert,
  Forecast,
  Health,
  Horizon,
  MessageResponse,
  ModelMetricsResponse,
  ReadingsResponse,
  Risk,
  ScenarioId,
  Severity,
  SimulatorStatus,
  WhatIfRequest,
  WhatIfResponse,
  ZoneSummary,
  ManagerOverview,
  ZonePredictionOverview,
  EventItem,
  RecoveryStatus,
  DoorEventItem,
  ModelEvaluationResponse,
  TranscribeRequest,
  TranscribeResponse,
} from "../types/api";

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Integration point for the team login module: set a bearer token to send with every request. */
export function setAuthToken(token: string | null) {
  authToken = token;
}

/** Called when the backend rejects the session (expired / revoked) so the UI can sign out. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message: string, public status: number | null) {
    super(message);
    this.name = "ApiError";
  }
}

/** Turns FastAPI error payloads ({detail: string | [{msg, loc}]}) into readable text. */
export function describeErrorBody(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d) => {
          const item = d as { msg?: string; loc?: unknown[] };
          const where = Array.isArray(item.loc) ? item.loc.filter((l) => l !== "body").join(".") : "";
          return where ? `${where}: ${item.msg}` : item.msg ?? "Invalid request";
        })
        .join("; ");
    }
  }
  if (status === 500) {
    return "Backend service unavailable or internal error (500). Please ensure the backend is running on port 8000.";
  }
  return `Request failed with status ${status}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === "AbortError";
    throw new ApiError(
      aborted ? "The backend did not respond in time." : "Cannot reach the ColdGuard backend. Is it running on port 8000?",
      null,
    );
  } finally {
    clearTimeout(timer);
  }
  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }
  if (res.status === 401 && authToken) onUnauthorized?.();
  if (!res.ok) throw new ApiError(describeErrorBody(body, res.status), res.status);
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

export const api = {
  health: () => request<Health>("/api/health"),
  zones: () => request<ZoneSummary[]>("/api/zones"),
  zone: (zoneId: string) => request<ZoneSummary>(`/api/zones/${zoneId}`),
  readings: (zoneId: string, minutes: number) =>
    request<ReadingsResponse>(`/api/zones/${zoneId}/readings${qs({ minutes })}`),
  forecast: (zoneId: string, horizon: Horizon) => request<Forecast>(`/api/zones/${zoneId}/forecast${qs({ horizon })}`),
  risk: (zoneId: string, horizon: Horizon) => request<Risk>(`/api/zones/${zoneId}/risk${qs({ horizon })}`),
  alerts: (filters: { severity?: Severity | ""; zone_id?: string; acknowledged?: boolean; active?: boolean; limit?: number } = {}) =>
    request<Alert[]>(`/api/alerts${qs(filters)}`),
  acknowledge: (alertId: string) => post<Alert>(`/api/alerts/${alertId}/acknowledge`),
  simulatorStatus: () => request<SimulatorStatus>("/api/simulator/status"),
  setScenario: (zoneId: string, scenario: ScenarioId, ambientDelta?: number) =>
    post<MessageResponse>("/api/simulator/scenario", { zone_id: zoneId, scenario, ambient_delta: ambientDelta ?? null }),
  reset: (mode: "scenario" | "full", zoneId?: string) =>
    post<MessageResponse>("/api/simulator/reset", { mode, zone_id: zoneId ?? null }),
  control: (body: { running?: boolean; tick_seconds?: number }) => post<MessageResponse>("/api/simulator/control", body),
  advance: (minutes: number) => post<MessageResponse>("/api/simulator/advance", { minutes }),
  whatIf: (body: WhatIfRequest) => post<WhatIfResponse>("/api/simulator/what-if", body),
  modelMetrics: () => request<ModelMetricsResponse>("/api/model/metrics"),
  managerOverview: (windowMinutes = 240) =>
    request<ManagerOverview>(`/api/manager/overview${qs({ window_minutes: windowMinutes })}`),
  predictionOverview: (zoneId: string, horizon: number = 30) =>
    request<ZonePredictionOverview>(`/api/zones/${zoneId}/prediction-overview${qs({ horizon })}`),
  events: (limit: number = 20) => request<EventItem[]>(`/api/events${qs({ limit })}`),
  controlDoor: (zoneId: string, action: "open" | "close", durationMinutes?: number) =>
    post<RecoveryStatus>(`/api/zones/${zoneId}/door`, { action, duration_minutes: durationMinutes ?? null }),
  setDoor: (zoneId: string, action: "open" | "close" | "closed", durationSeconds?: number) =>
    post<RecoveryStatus>(`/api/zones/${zoneId}/door`, {
      action: action === "closed" ? "close" : action,
      duration_minutes: durationSeconds ? durationSeconds / 60 : null,
    }),
  recoveryStatus: (zoneId: string) => request<RecoveryStatus>(`/api/zones/${zoneId}/recovery-status`),
  doorEvents: (zoneId: string, limit: number = 50) => request<DoorEventItem[]>(`/api/zones/${zoneId}/door-events${qs({ limit })}`),
  modelEvaluation: () => request<ModelEvaluationResponse>("/api/model/evaluation"),
  transcribe: (body: TranscribeRequest) => post<TranscribeResponse>("/api/transcribe", body),
  chat: (body: { message: string; history?: { role: string; content: string }[]; language?: string }) =>
    post<any>("/api/chat/message", body),
  chatVoice: (body: {
    audio_base64: string;
    language?: string;
    history?: { role: string; content: string }[];
    provider?: string;
    api_key?: string | null;
    custom_endpoint?: string | null;
  }) => post<any>("/api/chat/voice", body),
  chatQuickPrompts: (lang = "en") => request<string[]>(`/api/chat/quick-prompts${qs({ lang })}`),
  getTelemetrySource: () => request<import("../types/api").TelemetrySourceStatus>("/api/telemetry/source"),
  setTelemetrySource: (source: "dataset" | "simulator", datasetType?: string) =>
    post<import("../types/api").TelemetrySourceStatus>("/api/telemetry/source", { source, dataset_type: datasetType ?? "test" }),
  integrityStatus: () => request<import("../types/api").IntegrityStatusResponse>("/api/integrity/status"),
  integrityVerifications: (limit = 20) =>
    request<import("../types/api").VerificationRecord[]>(`/api/integrity/verifications${qs({ limit })}`),
  blockchainBlocks: (limit = 10) =>
    request<import("../types/api").BlockchainBlockItem[]>(`/api/integrity/blocks${qs({ limit })}`),
  anchorBatch: () => post<{ status: string; block?: unknown; message?: string }>("/api/integrity/anchor"),
  auditReading: (readingId: number) =>
    request<import("../types/api").AuditReadingResponse>(`/api/integrity/audit/${readingId}`),
  demonstrateTamper: (readingId?: number, newTemperature?: number) =>
    post<import("../types/api").TamperDemoResponse>("/api/integrity/demonstrate-tamper", {
      reading_id: readingId,
      new_temperature: newTemperature,
    }),
  restoreReading: (readingId: number, originalTemperature: number) =>
    post<{ status: string; message: string }>("/api/integrity/restore", {
      reading_id: readingId,
      original_temperature: originalTemperature,
    }),
};

