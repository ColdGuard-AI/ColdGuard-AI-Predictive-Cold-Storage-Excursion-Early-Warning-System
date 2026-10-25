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
} from "../types/api";

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}
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
  if (status === 500) return "Backend service unavailable (500). Please ensure the backend is running on port 8000.";
  return `Request failed with status ${status}`;
}

async function request<T>(path: string, init?: RequestInit, customTimeoutMs?: number): Promise<T> {
  const controller = new AbortController();
  const timeout = customTimeoutMs ?? TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeout);
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
    try { body = JSON.parse(text); } catch { body = null; }
  }
  if (res.status === 401 && authToken) onUnauthorized?.();
  if (!res.ok) throw new ApiError(describeErrorBody(body, res.status), res.status);
  return body as T;
}

const get = <T>(path: string, timeoutMs?: number) => request<T>(path, undefined, timeoutMs);
const post = <T>(path: string, body?: unknown, timeoutMs?: number) =>
  request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, timeoutMs);

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export interface LoginPayload { email: string; password: string; }
export interface RegisterPayload {
  full_name: string; email: string; password: string;
  phone?: string; requested_role: string; organization?: string;
}
export interface ChangePasswordPayload {
  email: string; current_password: string; new_password: string;
}
export interface ReviewUserPayload {
  user_id: number; action: "approve" | "reject" | "suspend" | "activate"; reason?: string;
}

export const auth = {
  login: (payload: LoginPayload) => post<any>("/api/auth/login", payload),
  register: (payload: RegisterPayload) => post<any>("/api/auth/register", payload),
  changePassword: (payload: ChangePasswordPayload) => post<any>("/api/auth/change-password", payload),
  getRoles: () => get<any[]>("/api/roles"),
  getFacilities: () => get<any>("/api/facilities"),
  // Manager admin
  getPendingUsers: (status?: string) => get<any[]>(`/api/admin/pending-users${status ? `?status=${status}` : ""}`),
  getAllUsers: () => get<any[]>("/api/admin/all-users"),
  reviewUser: (payload: ReviewUserPayload) => post<any>("/api/admin/review-user", payload),
};

// ─── Sensor / Core API ────────────────────────────────────────────────────────
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
  restoreTamper: (readingId: number, originalTemperature: number) =>
    post<{ status: string; message: string }>("/api/integrity/restore", {
      reading_id: readingId,
      original_temperature: originalTemperature,
    }),
  assistantStatus: () =>
    request<{
      ollama: { connected: boolean; url: string; models: string[]; default_model: string; notice?: string };
      supported_languages: Record<string, { name: string; locale: string; greeting: string }>;
      rag_sources: string[];
    }>("/api/assistant/status"),
  assistantChat: (payload: {
    message: string;
    language?: string;
    model?: string;
    history?: { role: string; content: string }[];
  }) =>
    post<{
      reply: string;
      language: string;
      model: string;
      engine: string;
      telemetry_context_used: boolean;
      telemetry_snapshot: any;
      suggested_actions: string[];
    }>("/api/assistant/chat", payload, 60000),
};
