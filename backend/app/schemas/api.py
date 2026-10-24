"""Request/response schemas for the REST API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ScenarioName = Literal[
    "normal", "door_open", "compressor_failure", "ambient_increase",
    "sensor_anomaly", "cooling_degradation", "abnormal_humidity", "fire_runaway", "fan_off"
]
WhatIfScenario = Literal["normal", "door_open", "compressor_failure", "ambient_increase", "cooling_degradation", "fan_off"]
Severity = Literal["info", "warning", "critical"]


class HealthResponse(BaseModel):
    status: str
    version: str
    data_source: str
    model_loaded: bool
    model_error: Optional[str] = None
    simulator_running: bool
    sim_time: Optional[datetime] = None
    tick_seconds: float
    readings_stored: int
    is_synthetic: bool = True


class Reading(BaseModel):
    timestamp: datetime
    zone_id: str
    sensor_id: str
    temperature: Optional[float] = Field(None, description="°C; null when the sensor reported no value")
    humidity: Optional[float] = Field(None, description="Relative humidity, %")
    compressor_status: str
    compressor_load_pct: Optional[float] = None
    power_consumption_kw: Optional[float] = None
    sensor_health: Optional[str] = "healthy"
    door_status: str
    door_open_duration_seconds: Optional[int] = 0
    time_since_closure_seconds: Optional[int] = 0
    ambient_temperature: Optional[float] = None
    scenario: str
    residual_rise_predicted: Optional[float] = 0.0
    peak_temp_predicted: Optional[float] = None
    recovery_time_minutes: Optional[float] = 0.0
    recovery_progress_pct: Optional[float] = 100.0
    recovery_phase: Optional[str] = "none"
    is_synthetic: bool = True


class ReadingsResponse(BaseModel):
    zone_id: str
    minutes: int
    count: int
    simulated: bool = True
    readings: list[Reading]


class TelemetryIngestItem(BaseModel):
    timestamp: Optional[datetime] = None
    zone_id: str
    sensor_id: Optional[str] = None
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    ambient_temperature: Optional[float] = None
    compressor_status: Optional[str] = "running"
    compressor_load_pct: Optional[float] = None
    power_consumption_kw: Optional[float] = None
    sensor_health: Optional[str] = "healthy"
    door_status: Optional[str] = "closed"
    door_open_duration_seconds: Optional[int] = 0
    scenario: Optional[str] = "normal"
    cooling_capacity_pct: Optional[float] = None
    thermal_drift_rate_c_hr: Optional[float] = None
    risk_score: Optional[int] = None
    time_to_breach_min: Optional[float] = None


class TelemetryIngestResponse(BaseModel):
    status: str = "ok"
    ingested_count: int
    timestamp: datetime
    zones_updated: list[str]


class TelemetrySourceStatus(BaseModel):
    source: str  # "dataset" | "simulator"
    dataset_name: Optional[str] = "test_dataset.csv"
    playback_index: int = 0
    total_timestamps: int = 0
    progress_pct: float = 0.0
    current_timestamp: Optional[str] = None


class TelemetrySourceChangeRequest(BaseModel):
    source: Literal["dataset", "simulator"]
    dataset_type: Optional[Literal["test", "train", "val", "full"]] = "test"


class Alert(BaseModel):
    id: str
    zone_id: str
    category: str
    category_label: str
    severity: Severity
    title: str
    explanation: str
    recommended_action: str
    created_at: datetime
    last_seen_at: datetime
    occurrences: int
    active: bool
    acknowledged: bool
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    context: dict[str, Any] = {}


class ZoneSummary(BaseModel):
    model_config = ConfigDict(extra="allow")
    zone_id: str
    name: str
    product: str
    sensor_id: str
    setpoint: float
    lower_limit: float
    upper_limit: float
    scenario: str
    scenario_label: str
    timestamp: Optional[datetime]
    temperature: Optional[float]
    humidity: Optional[float]
    ambient_temperature: Optional[float]
    temperature_status: str
    compressor_status: Optional[str]
    door_status: Optional[str]
    door_open_minutes: float
    door_open_seconds: Optional[int] = 0
    compressor_off_minutes: float
    compressor_load_pct: Optional[float] = None
    power_consumption_kw: Optional[float] = None
    sensor_health: Optional[str] = "healthy"
    sensor_status: str
    sensor_issues: list[dict[str, Any]]
    risk_score: Optional[int]
    risk_category: str
    trend_per_hour: float
    time_to_breach_minutes: Optional[float]
    warning_time_to_breach_minutes: Optional[float] = None
    residual_rise_predicted: Optional[float] = 0.0
    peak_temp_predicted: Optional[float] = None
    recovery_time_minutes: Optional[float] = 0.0
    recovery_progress_pct: Optional[float] = 100.0
    recovery_phase: Optional[str] = "none"
    time_since_closure_minutes: Optional[float] = 0.0
    door_events_count_24h: Optional[int] = 0
    cumulative_open_minutes_24h: Optional[float] = 0.0
    active_alert_count: int
    latest_alert: Optional[Alert]
    is_synthetic: bool = True


class ForecastPoint(BaseModel):
    timestamp: datetime
    minutes_ahead: int
    temperature: float
    lower: Optional[float] = None
    upper: Optional[float] = None


class ForecastResponse(BaseModel):
    zone_id: str
    available: bool
    reason: Optional[str] = None
    horizon_minutes: int
    issued_at: Optional[datetime] = None
    base_temperature: Optional[float] = None
    points: list[ForecastPoint] = []
    excursion_expected: bool = False
    time_to_breach_minutes: Optional[float] = None
    breach_side: Optional[str] = None
    warning_time_to_breach_minutes: Optional[float] = Field(None, description="Breach time under the conservative early-warning rule")
    warning_breach_side: Optional[str] = None
    warning_rule: Optional[str] = None
    lower_limit: float
    upper_limit: float
    residual_rise_predicted: Optional[float] = 0.0
    peak_temp_predicted: Optional[float] = None
    limited_history: bool = False
    note: Optional[str] = None
    model: str = "RandomForestRegressor (multi-output), trained on simulated data"
    band_note: str = "Shaded band = 10th-90th percentile across trees (uncertainty indicator, not a calibrated interval)."


class RiskFactorOut(BaseModel):
    key: str
    label: str
    points: float
    max_points: float
    detail: str


class RiskResponse(BaseModel):
    zone_id: str
    score: Optional[int]
    category: str
    horizon_minutes: int
    recovery_progress_pct: Optional[float] = 100.0
    predicted_peak_temperature: Optional[float] = None
    residual_rise: Optional[float] = 0.0
    factors: list[RiskFactorOut]
    method: str
    method_note: str
    forecast_available: bool


class HorizonPrediction(BaseModel):
    horizon_minutes: int
    horizon_label: str
    predicted_temperature: float
    temperature_delta: float
    risk_score: int
    risk_category: str
    risk_label: str
    excursion_expected: bool
    time_to_breach_minutes: Optional[float] = None
    breach_side: Optional[str] = None
    predicted_peak_temperature: Optional[float] = None
    residual_rise: Optional[float] = 0.0
    recovery_progress_pct: Optional[float] = 100.0


class RecoveryStatusResponse(BaseModel):
    zone_id: str
    door_status: str
    door_open_duration_seconds: int = 0
    door_open_minutes: float = 0.0
    time_since_closure_seconds: int = 0
    time_since_closure_minutes: float = 0.0
    last_door_duration_seconds: int = 0
    last_door_duration_minutes: float = 0.0
    temp_at_open: Optional[float] = None
    temp_at_close: Optional[float] = None
    residual_rise_predicted: float = 0.0
    peak_temp_predicted: Optional[float] = None
    recovery_time_minutes: float = 0.0
    recovery_progress_pct: float = 100.0
    recovery_phase: str = "none"
    safe_upper_limit: float
    setpoint: float
    current_temperature: Optional[float] = None
    ambient_temperature: Optional[float] = None
    events_count_24h: int = 0
    cumulative_open_minutes_24h: float = 0.0


class DoorControlRequest(BaseModel):
    action: Literal["open", "close"]
    duration_minutes: Optional[int] = Field(None, ge=1, le=120, description="Duration in minutes if auto-closing")


class DoorEventItem(BaseModel):
    id: int
    zone_id: str
    opened_at: datetime
    closed_at: Optional[datetime] = None
    duration_seconds: int = 0
    ambient_temp_at_open: Optional[float] = None
    temp_at_open: Optional[float] = None
    temp_at_close: Optional[float] = None
    compressor_state: Optional[str] = None
    residual_rise_predicted: float = 0.0
    peak_temp_predicted: float = 0.0
    recovery_time_minutes: float = 0.0
    recovery_progress_pct: float = 0.0
    status: str
    previous_events_count_24h: int = 0
    cumulative_open_seconds_24h: int = 0
    notes: Optional[str] = None


class InventorySpoilageRisk(BaseModel):
    zone_name: str
    inventory_category: str
    total_inventory_value_usd: str
    spoilage_status: str  # "Nominal (Protected)" | "Warning (Thermal Drift)" | "Critical (Spoilage Imminent / In Progress)"
    vulnerable_items: list[str]
    critical_threshold_c: float
    time_to_spoilage_minutes: Optional[float] = None
    spoilage_mechanism: str
    financial_impact_risk: str
    mitigation_urgency: str


class AIExplanationResponse(BaseModel):
    headline: str
    severity: str
    narrative: str
    contributing_factors: list[str]
    summary_text: str
    recommended_actions: list[str]
    sensor_fault_analysis: Optional[dict[str, Any]] = None
    inventory_spoilage_risk: Optional[InventorySpoilageRisk] = None


class ZonePredictionOverview(BaseModel):
    zone_id: str
    zone_name: str
    current_temperature: Optional[float]
    ambient_temperature: Optional[float]
    safe_lower_limit: float
    safe_upper_limit: float
    setpoint: float
    selected_horizon: int
    horizons: dict[str, HorizonPrediction]
    ai_explanation: AIExplanationResponse
    forecast_points: list[ForecastPoint]
    recovery_status: Optional[RecoveryStatusResponse] = None
    is_synthetic: bool = True


class EventItem(BaseModel):
    id: str
    time: str
    zone_id: str
    zone_name: str
    event: str
    severity: str
    status: str
    created_at: datetime
    recommended_action: Optional[str] = None


class HorizonEvaluation(BaseModel):
    horizon_minutes: int
    horizon_label: str
    mae_model: float
    mae_persistence: float
    mae_trend: float
    improvement_over_persistence_pct: float
    improvement_over_trend_pct: float


class ModelEvaluationResponse(BaseModel):
    model_architecture: str
    data_source: str
    validation_split: str
    n_train_samples: int
    n_test_samples: int
    horizons_evaluation: list[HorizonEvaluation]
    excursion_classification_30m: dict[str, Any]
    disclaimer: str


class AcknowledgeRequest(BaseModel):
    user: str = Field("operator", min_length=1, max_length=60)


class ScenarioRequest(BaseModel):
    zone_id: str = Field(..., examples=["zone-a"])
    scenario: ScenarioName
    ambient_delta: Optional[float] = Field(None, ge=1, le=30, description="°C, ambient_increase only")


class ResetRequest(BaseModel):
    mode: Literal["scenario", "full"] = Field(
        "scenario", description="'scenario' returns zones to normal operation; 'full' wipes data and restarts the demo"
    )
    zone_id: Optional[str] = None


class ControlRequest(BaseModel):
    running: Optional[bool] = None
    tick_seconds: Optional[float] = Field(None, ge=0.2, le=10)


class AdvanceRequest(BaseModel):
    minutes: int = Field(..., ge=1, le=240)


class WhatIfRequest(BaseModel):
    zone_id: str = Field(..., examples=["zone-a"])
    scenario: Optional[WhatIfScenario] = Field("compressor_failure")
    duration_minutes: Optional[int] = Field(30, ge=1, le=240, description="How long the change lasts; null = whole projection")
    ambient_delta: float = Field(15.0, ge=1, le=30)
    projection_minutes: int = Field(90, ge=30, le=240)
    user_query: Optional[str] = Field(None, description="Free-text custom question or scenario description")
    language: Optional[str] = Field("en", description="Target response language: 'en', 'es', 'fr', 'de', 'hi', 'pt', 'zh', 'ja', 'ar'")
    dataset_source: Optional[str] = Field("live", description="Data source: 'live', 'synthetic_full', 'synthetic_train', 'synthetic_val', 'synthetic_test'")


class MessageResponse(BaseModel):
    ok: bool = True
    message: str
    data: dict[str, Any] = {}


class TranscribeRequest(BaseModel):
    audio_base64: str = Field(..., description="Base64 encoded audio string (webm/wav/mp3)")
    provider: Optional[str] = Field("groq", description="Whisper provider: 'groq' or 'openai' or 'custom'")
    api_key: Optional[str] = Field(None, description="Optional API key for Whisper provider")
    custom_endpoint: Optional[str] = Field(None, description="Optional custom Whisper HTTP endpoint URL")
    language: Optional[str] = Field("en", description="Spoken language code (e.g. 'en')")
    prompt: Optional[str] = Field(
        "ColdGuard AI predictive cold storage monitoring, refrigeration excursion, setpoint breach. "
        "Vaccine Store A, Dairy Chiller B, Meat Freezer C, Pharma Cold Room D, Produce Staging E. "
        "Compressor, condenser, evaporator coil, defrost cycle, glycol loop, RTD sensor, degrees Celsius, "
        "ambient heatwave, power cut, door open, door ajar, WHO PQS, insulin, mRNA vaccines, biologics. "
        "मराठी आणि हिंदी भाषा समर्थन: तापमान, शीतगृह, कंप्रेसर, अलार्म, लस, धोका, कोल्ड स्टोरेज, बिजली कटौती.",
        description="Prompt to guide Whisper vocabulary towards cold storage terms"
    )


class TranscribeResponse(BaseModel):
    ok: bool
    transcript: str
    provider: str
    duration_ms: Optional[float] = None
    error: Optional[str] = None
