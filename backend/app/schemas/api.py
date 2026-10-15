"""Request/response schemas for the REST API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ScenarioName = Literal["normal", "door_open", "compressor_failure", "ambient_increase", "sensor_anomaly"]
WhatIfScenario = Literal["normal", "door_open", "compressor_failure", "ambient_increase"]
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


class Reading(BaseModel):
    timestamp: datetime
    zone_id: str
    sensor_id: str
    temperature: Optional[float] = Field(None, description="°C; null when the sensor reported no value")
    humidity: Optional[float] = Field(None, description="Relative humidity, %")
    compressor_status: str
    door_status: str
    ambient_temperature: Optional[float] = None
    scenario: str


class ReadingsResponse(BaseModel):
    zone_id: str
    minutes: int
    count: int
    simulated: bool = True
    readings: list[Reading]


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
    compressor_off_minutes: float
    sensor_status: str
    sensor_issues: list[dict[str, Any]]
    risk_score: Optional[int]
    risk_category: str
    trend_per_hour: float
    time_to_breach_minutes: Optional[float]
    warning_time_to_breach_minutes: Optional[float] = None
    active_alert_count: int
    latest_alert: Optional[Alert]


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
    factors: list[RiskFactorOut]
    method: str
    method_note: str
    forecast_available: bool


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
    scenario: WhatIfScenario
    duration_minutes: Optional[int] = Field(30, ge=1, le=240, description="How long the change lasts; null = whole projection")
    ambient_delta: float = Field(15.0, ge=1, le=30)
    projection_minutes: int = Field(90, ge=30, le=240)


class MessageResponse(BaseModel):
    ok: bool = True
    message: str
    data: dict[str, Any] = {}

