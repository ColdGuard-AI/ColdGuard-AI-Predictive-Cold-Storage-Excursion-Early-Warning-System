// Types mirroring the FastAPI response schemas (backend/app/schemas/api.py).

export type Severity = "info" | "warning" | "critical";
export type RiskCategory = "low" | "medium" | "high" | "critical" | "unknown";
export type TempStatus = "normal" | "warning" | "critical" | "unknown";
export type ScenarioId = "normal" | "door_open" | "compressor_failure" | "ambient_increase" | "sensor_anomaly";
export type WhatIfScenarioId = Exclude<ScenarioId, "sensor_anomaly">;
export type Horizon = 15 | 30 | 60;

export interface Health {
  status: "ok" | "degraded";
  version: string;
  data_source: string;
  model_loaded: boolean;
  model_error: string | null;
  simulator_running: boolean;
  sim_time: string | null;
  tick_seconds: number;
  readings_stored: number;
}

export interface Alert {
  id: string;
  zone_id: string;
  category: string;
  category_label: string;
  severity: Severity;
  title: string;
  explanation: string;
  recommended_action: string;
  created_at: string;
  last_seen_at: string;
  occurrences: number;
  active: boolean;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  context: Record<string, unknown>;
}

export interface SensorIssue {
  type: string;
  detail: string;
}

export interface ZoneSummary {
  zone_id: string;
  name: string;
  product: string;
  sensor_id: string;
  setpoint: number;
  lower_limit: number;
  upper_limit: number;
  scenario: ScenarioId;
  scenario_label: string;
  timestamp: string | null;
  temperature: number | null;
  humidity: number | null;
  ambient_temperature: number | null;
  temperature_status: TempStatus;
  compressor_status: "running" | "stopped" | null;
  door_status: "open" | "closed" | null;
  door_open_minutes: number;
  compressor_off_minutes: number;
  sensor_status: "normal" | "suspicious" | "no_data";
  sensor_issues: SensorIssue[];
  risk_score: number | null;
  risk_category: RiskCategory;
  trend_per_hour: number;
  time_to_breach_minutes: number | null;
  warning_time_to_breach_minutes: number | null;
  active_alert_count: number;
  latest_alert: Alert | null;
}

export interface Reading {
  timestamp: string;
  zone_id: string;
  sensor_id: string;
  temperature: number | null;
  humidity: number | null;
  compressor_status: string;
  door_status: string;
  ambient_temperature: number | null;
  scenario: string;
}

export interface ReadingsResponse {
  zone_id: string;
  minutes: number;
  count: number;
  simulated: boolean;
  readings: Reading[];
}

export interface ForecastPoint {
  timestamp: string;
  minutes_ahead: number;
  temperature: number;
  lower: number | null;
  upper: number | null;
}

export interface Forecast {
  zone_id: string;
  available: boolean;
  reason: string | null;
  horizon_minutes: number;
  issued_at: string | null;
  base_temperature: number | null;
  points: ForecastPoint[];
  excursion_expected: boolean;
  time_to_breach_minutes: number | null;
  breach_side: string | null;
  warning_time_to_breach_minutes: number | null;
  warning_breach_side: string | null;
  warning_rule: string | null;
  lower_limit: number;
  upper_limit: number;
  limited_history: boolean;
  note: string | null;
  model: string;
  band_note: string;
}

export interface RiskFactor {
  key: string;
  label: string;
  points: number;
  max_points: number;
  detail: string;
}

export interface Risk {
  zone_id: string;
  score: number | null;
  category: RiskCategory;
  horizon_minutes: number;
  factors: RiskFactor[];
  method: string;
  method_note: string;
  forecast_available: boolean;
}

export interface SimulatorStatus {
  running: boolean;
  tick_seconds: number;
  sim_time: string | null;
  tick_count: number;
  zones: Record<string, { scenario: ScenarioId; label: string; scenario_minutes: number }>;
  available_scenarios: { id: ScenarioId; label: string }[];
  alert_categories: Record<string, string>;
}

export interface MessageResponse {
  ok: boolean;
  message: string;
  data: Record<string, unknown>;
}

export interface WhatIfRequest {
  zone_id: string;
  scenario: WhatIfScenarioId;
  duration_minutes: number | null;
  ambient_delta: number;
  projection_minutes: number;
}

export interface ProjectionResult {
  points: { minute: number; temperature: number }[];
  max_temperature: number;
  min_temperature: number;
  final_temperature: number;
  time_to_limit_minutes: number | null;
  limit_side: string | null;
  starts_out_of_range: boolean;
  returns_to_range_minute: number | null;
  risk_points: { minute: number; risk: number }[];
  peak_risk: number | null;
  final_risk: number | null;
  ai_first_warning_minute: number | null;
  ai_lead_time_minutes: number | null;
}

export interface WhatIfResponse {
  zone_id: string;
  scenario: WhatIfScenarioId;
  scenario_label: string;
  baseline_label: string;
  parameters: { duration_minutes: number | null; ambient_delta: number; projection_minutes: number };
  limits: { lower: number; upper: number; setpoint: number };
  history: { minute: number; temperature: number | null }[];
  current_risk: number | null;
  baseline: ProjectionResult;
  scenario_result: ProjectionResult;
  difference: {
    max_abs_delta: number;
    max_abs_delta_minute: number;
    final_delta: number;
    peak_risk_delta: number | null;
  };
  recommendations: string[];
  model_available: boolean;
  notes: string[];
}

export interface ExcursionScores {
  true_positives: number;
  false_positives: number;
  false_negatives: number;
  true_negatives: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

export interface ModelMetrics {
  model_type: string;
  target: string;
  trained_at: string;
  data_source: string;
  n_train_samples: number;
  n_test_samples: number;
  split: string;
  n_estimators: number;
  features: string[];
  horizons: { horizon_minutes: number; mae_model: number; mae_persistence: number; mae_trend: number }[];
  excursion_warning_30min: {
    description: string;
    positives_in_test: number;
    negatives_in_test: number;
    warning_rule: string;
    model_warning_rule: ExcursionScores;
    model_mean: ExcursionScores;
    trend_baseline: ExcursionScores;
  };
  feature_importance: { feature: string; importance: number }[];
  limitations: string[];
  training_seconds?: number;
  training_days_simulated?: number;
}

export interface ModelMetricsResponse {
  available: boolean;
  reason?: string;
  metrics: ModelMetrics | null;
}

// ---------------------------------------------------------------- auth / RBAC
export type Role = "admin" | "manager" | "operator";
export type Permission = "view" | "acknowledge" | "manager_overview" | "what_if" | "model" | "simulate" | "manage_users";

export interface AuthUser {
  username: string;
  full_name: string;
  role: Role;
  role_label: string;
  permissions: Permission[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface RoleMatrix {
  roles: { id: Role; label: string }[];
  permissions: { id: Permission; label: string; roles: Role[] }[];
}

// ---------------------------------------------------------------- manager overview
export interface ManagerZone extends ZoneSummary {
  window_minutes: number;
  readings_in_window: number;
  time_in_range_pct: number | null;
  excursion_minutes: number;
  missing_readings: number;
  min_temperature: number | null;
  max_temperature: number | null;
  door_open_minutes_window: number;
  compressor_off_minutes_window: number;
  sparkline: (number | null)[];
  unacknowledged_alerts: number;
  active_critical_alerts: number;
}

export interface ManagerOverview {
  sim_time: string | null;
  window_minutes: number;
  totals: {
    zones: number;
    zones_ok: number;
    zones_attention: number;
    active_alerts: number;
    unacknowledged_alerts: number;
    facility_time_in_range_pct: number | null;
    highest_risk_zone: string | null;
  };
  zones: ManagerZone[];
  action_items: Alert[];
}
