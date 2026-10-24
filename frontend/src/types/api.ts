// Types mirroring the FastAPI response schemas (backend/app/schemas/api.py).

export type Severity = "info" | "warning" | "critical";
export type RiskCategory = "low" | "medium" | "high" | "critical" | "unknown";
export type TempStatus = "normal" | "warning" | "critical" | "unknown";
export type ScenarioId =
  | "normal"
  | "door_open"
  | "compressor_failure"
  | "ambient_increase"
  | "sensor_anomaly"
  | "cooling_degradation"
  | "abnormal_humidity"
  | "fire_runaway"
  | "fan_off";
export type WhatIfScenarioId = ScenarioId;
export type Horizon = 15 | 30 | 60 | 360 | 1440;

export interface HorizonPrediction {
  horizon_minutes: number;
  horizon_label: string;
  predicted_temperature: number;
  temperature_delta: number;
  risk_score: number;
  risk_category: string;
  risk_label: string;
  excursion_expected: boolean;
  time_to_breach_minutes: number | null;
  breach_side: string | null;
  predicted_peak_temperature?: number | null;
  residual_rise?: number;
  recovery_progress_pct?: number;
}

export interface RecoveryStatus {
  zone_id: string;
  door_status: "open" | "closed";
  door_open_duration_seconds: number;
  door_open_minutes: number;
  time_since_closure_seconds: number;
  time_since_closure_minutes: number;
  last_door_duration_seconds: number;
  last_door_duration_minutes: number;
  temp_at_open: number | null;
  temp_at_close: number | null;
  residual_rise_predicted: number;
  peak_temp_predicted: number | null;
  recovery_time_minutes: number;
  recovery_progress_pct: number;
  recovery_phase: "none" | "door_open" | "residual_rise" | "active_recovery" | "recovered" | string;
  safe_upper_limit: number;
  setpoint: number;
  current_temperature: number | null;
  ambient_temperature: number | null;
  events_count_24h: number;
  cumulative_open_minutes_24h: number;
}

export interface DoorEventItem {
  id: number;
  zone_id: string;
  opened_at: string;
  closed_at: string | null;
  duration_seconds: number;
  ambient_temp_at_open: number | null;
  temp_at_open: number | null;
  temp_at_close: number | null;
  compressor_state: string | null;
  residual_rise_predicted: number;
  peak_temp_predicted: number;
  recovery_time_minutes: number;
  recovery_progress_pct: number;
  status: "open" | "recovering" | "recovered" | string;
  previous_events_count_24h: number;
  cumulative_open_seconds_24h: number;
  notes?: string | null;
}

export interface HorizonEvaluation {
  horizon_minutes: number;
  horizon_label: string;
  mae_model: number;
  mae_persistence: number;
  mae_trend: number;
  improvement_over_persistence_pct: number;
  improvement_over_trend_pct: number;
}

export interface ModelEvaluationResponse {
  model_architecture: string;
  data_source: string;
  validation_split: string;
  n_train_samples: number;
  n_test_samples: number;
  horizons_evaluation: HorizonEvaluation[];
  excursion_classification_30m: {
    precision: number;
    recall: number;
    f1_score: number;
    false_alarm_rate_pct: number;
  };
  disclaimer: string;
}

export interface InventorySpoilageRisk {
  zone_name: string;
  inventory_category: string;
  total_inventory_value_usd: string;
  spoilage_status: string;
  vulnerable_items: string[];
  critical_threshold_c: number;
  time_to_spoilage_minutes: number | null;
  spoilage_mechanism: string;
  financial_impact_risk: string;
  mitigation_urgency: string;
}

export interface AIExplanation {
  headline: string;
  severity: "critical" | "warning" | "info" | "normal";
  narrative: string;
  contributing_factors: string[];
  summary_text: string;
  recommended_actions: string[];
  sensor_fault_analysis?: Record<string, unknown> | null;
  inventory_spoilage_risk?: InventorySpoilageRisk | null;
}

export interface ZonePredictionOverview {
  zone_id: string;
  zone_name: string;
  current_temperature: number | null;
  ambient_temperature: number | null;
  safe_lower_limit: number;
  safe_upper_limit: number;
  setpoint: number;
  selected_horizon: number;
  horizons: Record<string, HorizonPrediction>;
  ai_explanation: AIExplanation;
  forecast_points: ForecastPoint[];
  recovery_status?: RecoveryStatus | null;
  is_synthetic?: boolean;
}

export interface EventItem {
  id: string;
  time: string;
  zone_id: string;
  zone_name: string;
  event: string;
  severity: "high" | "medium" | "low";
  status: "active" | "resolved";
  created_at: string;
  recommended_action?: string | null;
}

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
  is_synthetic?: boolean;
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
  compressor_status: "running" | "stopped" | "idle" | "degraded" | "failed" | string | null;
  fans_active?: boolean;
  fan_status?: string;
  fan_off_seconds?: number;
  compressor_load_pct?: number | null;
  power_consumption_kw?: number | null;
  sensor_health?: string;
  door_status: "open" | "closed" | null;
  door_open_minutes: number;
  door_open_seconds?: number;
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
  forecast_available?: boolean;
  forecast_points?: any[];
  excursion_expected?: boolean;
  slope_per_min?: number;
  residual_rise_predicted?: number;
  peak_temp_predicted?: number | null;
  recovery_time_minutes?: number;
  recovery_progress_pct?: number;
  recovery_phase?: string;
  time_since_closure_minutes?: number;
  door_events_count_24h?: number;
  cumulative_open_minutes_24h?: number;
  is_synthetic?: boolean;
}

export interface Reading {
  timestamp: string;
  zone_id: string;
  sensor_id: string;
  temperature: number | null;
  true_temperature?: number | null;
  humidity: number | null;
  compressor_status: string;
  compressor_load_pct?: number | null;
  power_consumption_kw?: number | null;
  sensor_health?: string;
  door_status: string;
  ambient_temperature: number | null;
  scenario: string;
  residual_rise_predicted?: number | null;
  peak_temp_predicted?: number | null;
  recovery_time_minutes?: number | null;
  recovery_progress_pct?: number | null;
  recovery_phase?: string | null;
  is_synthetic?: boolean;
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
  scenario?: WhatIfScenarioId;
  duration_minutes?: number | null;
  ambient_delta?: number;
  projection_minutes?: number;
  user_query?: string | null;
  language?: string;
  dataset_source?: string;
}

export interface TranscribeRequest {
  audio_base64: string;
  provider?: "groq" | "openai" | "custom" | string;
  api_key?: string | null;
  custom_endpoint?: string | null;
  language?: string;
  prompt?: string;
}

export interface TranscribeResponse {
  ok: boolean;
  transcript: string;
  provider: string;
  duration_ms?: number | null;
  error?: string | null;
}

export interface WhatIfTimelineMilestone {
  minute: number;
  label: string;
  detail: string;
}

export interface WhatIfProductImpact {
  product_name: string;
  exposure_summary: string;
  thermal_stress_level: "low" | "moderate" | "severe";
  critical_action_deadline_minutes: number | null;
}

export interface WhatIfLoraMetadata {
  adapter: string;
  base_architecture: string;
  rank: number;
  alpha: number;
  active_status: string;
  compound_effects_detected: string[];
  domain_framework?: string;
}

export interface WhatIfAiAnswer {
  user_query?: string | null;
  resolved_query?: string;
  is_custom_query?: boolean;
  headline: string;
  verdict: "safe" | "warning" | "critical";
  direct_answer: string;
  speech_text?: string;
  language?: string;
  detailed_analysis?: string;
  timeline_milestones: WhatIfTimelineMilestone[];
  product_impact: WhatIfProductImpact;
  key_factors: string[];
  recommended_actions: string[];
  parsed_scenario: {
    inferred_scenario: string;
    inferred_duration_minutes: number | null;
    inferred_ambient_delta: number;
  };
  lora_metadata?: WhatIfLoraMetadata;
  real_world_situation?: {
    title: string;
    description: string;
    incident_cause: string;
    inventory_risk_usd: number;
    inventory_risk_inr: number;
    regulatory_standard: string;
    protocol_code: string;
    immediate_sop_steps: string[];
  };
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
  dataset_source?: string;
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
  user_query?: string | null;
  ai_answer?: WhatIfAiAnswer;
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

export interface TelemetrySourceStatus {
  source: "dataset" | "simulator";
  dataset_name: string | null;
  playback_index: number;
  total_timestamps: number;
  progress_pct: number;
  current_timestamp: string | null;
}

export interface TelemetrySourceChangeRequest {
  source: "dataset" | "simulator";
  dataset_type?: "test" | "train" | "val" | "full";
}

export interface IntegrityStatusResponse {
  mqtt: {
    broker_host: string;
    broker_port: number;
    topic: string;
    is_connected: boolean;
    is_running: boolean;
    use_tls: boolean;
    mode: "live_broker" | "internal_bridge";
  };
  metrics: {
    total_messages_received: number;
    verified_count: number;
    tampered_count: number;
    duplicate_count: number;
    sequence_anomaly_count: number;
    anchored_count: number;
    pending_anchor_count: number;
    total_blocks_anchored: number;
    latest_block_height: number;
    latest_block_hash: string | null;
    latest_merkle_root: string | null;
    hash_chain_status: "intact" | "broken";
  };
  blockchain: {
    ledger_type: string;
    total_blocks: number;
    chain_valid: boolean;
    difficulty: number;
    latest_block_hash: string | null;
    latest_merkle_root: string | null;
  };
  timestamp: string;
}

export interface VerificationRecord {
  id: number;
  reading_id: number | null;
  zone_id: string;
  device_id: string;
  sequence_number: number;
  timestamp: string;
  payload_hash: string;
  prev_hash: string;
  canonical_payload: string;
  verification_status: "verified" | "tampered" | "duplicate" | "sequence_anomaly";
  verification_message: string | null;
  anchor_status: "anchored" | "unanchored";
  block_height: number | null;
  block_hash: string | null;
  tx_hash: string | null;
  merkle_root: string | null;
  merkle_proof: string | null;
  merkle_index: number | null;
  verified_at: string;
  current_temperature?: number | null;
  current_humidity?: number | null;
}

export interface BlockchainBlockItem {
  block_height: number;
  block_hash: string;
  prev_block_hash: string;
  merkle_root: string;
  timestamp: string;
  nonce: number;
  difficulty: number;
  tx_count: number;
  tx_hashes: string[];
  status: string;
}

export interface AuditReadingResponse {
  reading_id: number;
  tamper_detected: boolean;
  status: string;
  current_reading: {
    id: number;
    zone_id: string;
    sensor_id: string;
    timestamp: string;
    temperature: number;
    humidity: number;
    door_status: string;
    compressor_status: string;
  } | null;
  cryptographic_audit: {
    stored_hash: string;
    recomputed_hash: string;
    hash_match: boolean;
    canonical_payload: string;
  };
  blockchain_audit: {
    anchor_status: string;
    block_height: number | null;
    block_hash: string | null;
    tx_hash: string | null;
    merkle_root: string | null;
    merkle_proof_valid: boolean;
    proof_steps_count: number;
    ledger_chain_intact: boolean;
  };
  audit_timestamp: string;
}

export interface TamperDemoResponse {
  message: string;
  reading_id: number;
  original_temperature: number;
  tampered_temperature: number;
  audit_result: AuditReadingResponse;
}

