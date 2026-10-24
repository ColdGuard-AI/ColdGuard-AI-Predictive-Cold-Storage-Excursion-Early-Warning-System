"""REST endpoints. Every value the dashboard shows comes from here."""
from __future__ import annotations

from typing import Any, List, Optional, Union

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app import __version__
from app.schemas.api import (
    AcknowledgeRequest,
    AdvanceRequest,
    Alert,
    ControlRequest,
    DoorControlRequest,
    DoorEventItem,
    EventItem,
    ForecastResponse,
    HealthResponse,
    MessageResponse,
    ModelEvaluationResponse,
    ReadingsResponse,
    RecoveryStatusResponse,
    ResetRequest,
    RiskResponse,
    ScenarioRequest,
    Severity,
    TelemetryIngestItem,
    TelemetryIngestResponse,
    TelemetrySourceChangeRequest,
    TelemetrySourceStatus,
    WhatIfRequest,
    ZonePredictionOverview,
    ZoneSummary,
)
from app.services.alerts import CATEGORY_LABELS
from app.services.monitor import MonitoringService
from app.simulator.engine import SCENARIOS
from app.simulator.zones import ZONES

router = APIRouter(prefix="/api")


def get_monitor(request: Request) -> MonitoringService:
    return request.app.state.monitor


def _zone_or_404(zone_id: str) -> str:
    if zone_id not in ZONES:
        raise HTTPException(status_code=404, detail=f"Zone '{zone_id}' not found. Valid zones: {', '.join(ZONES)}")
    return zone_id


def _alert_out(alert: dict[str, Any]) -> dict[str, Any]:
    return {**alert, "category_label": CATEGORY_LABELS.get(alert["category"], alert["category"])}


# ---------------------------------------------------------------------- health
@router.get("/health", response_model=HealthResponse, tags=["system"])
def health(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    return {
        "status": "ok" if monitor.models.forecaster is not None else "degraded",
        "version": __version__,
        "data_source": "simulated",
        "model_loaded": monitor.models.forecaster is not None,
        "model_error": monitor.models.error,
        "simulator_running": monitor.running,
        "sim_time": monitor.sim_time,
        "tick_seconds": monitor.tick_seconds,
        "readings_stored": monitor.db.count_readings(),
    }


# ---------------------------------------------------------------------- zones
@router.get("/zones", response_model=list[ZoneSummary], tags=["zones"])
def list_zones(monitor: MonitoringService = Depends(get_monitor)) -> list[dict[str, Any]]:
    return [_with_alert(monitor.zone_summary(zid)) for zid in ZONES]


def _with_alert(summary: dict[str, Any]) -> dict[str, Any]:
    if summary.get("latest_alert"):
        summary["latest_alert"] = _alert_out(summary["latest_alert"])
    return summary


@router.get("/zones/{zone_id}", response_model=ZoneSummary, tags=["zones"])
def get_zone(zone_id: str, monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    return _with_alert(monitor.zone_summary(_zone_or_404(zone_id)))


@router.get("/zones/{zone_id}/readings", response_model=ReadingsResponse, tags=["zones"])
def zone_readings(
    zone_id: str,
    minutes: int = Query(180, ge=1, le=1440, description="How many minutes of history to return"),
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    _zone_or_404(zone_id)
    df = monitor.readings(zone_id, minutes)
    records = df.astype(object).where(pd.notna(df), None).to_dict(orient="records") if not df.empty else []
    return {"zone_id": zone_id, "minutes": minutes, "count": len(records), "readings": records}


# ---------------------------------------------------------------------- stateful door & recovery
@router.post("/zones/{zone_id}/door", response_model=RecoveryStatusResponse, tags=["door"])
def control_door(
    zone_id: str,
    body: DoorControlRequest,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    _zone_or_404(zone_id)
    return monitor.set_door(zone_id, body.action, body.duration_minutes)


@router.get("/zones/{zone_id}/recovery-status", response_model=RecoveryStatusResponse, tags=["door"])
def zone_recovery_status(
    zone_id: str,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    _zone_or_404(zone_id)
    return monitor.get_recovery_status(zone_id)


@router.get("/zones/{zone_id}/door-events", response_model=list[DoorEventItem], tags=["door"])
def list_zone_door_events(
    zone_id: str,
    limit: int = Query(50, ge=1, le=200),
    monitor: MonitoringService = Depends(get_monitor),
) -> list[dict[str, Any]]:
    _zone_or_404(zone_id)
    return monitor.db.list_door_events(zone_id=zone_id, limit=limit)


# ---------------------------------------------------------------------- prediction
@router.get("/zones/{zone_id}/forecast", response_model=ForecastResponse, tags=["prediction"])
def zone_forecast(
    zone_id: str,
    horizon: int = Query(30, description="Forecast horizon in minutes (15, 30, 60, 360, 1440)"),
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    _zone_or_404(zone_id)
    if horizon not in (15, 30, 60, 360, 1440):
        raise HTTPException(status_code=422, detail="horizon must be one of 15, 30, 60, 360, or 1440 minutes")
    fc = monitor.forecast(zone_id, horizon)
    cfg = ZONES[zone_id]
    return {**fc, "zone_id": zone_id, "lower_limit": cfg.lower_limit, "upper_limit": cfg.upper_limit}


@router.get("/zones/{zone_id}/risk", response_model=RiskResponse, tags=["prediction"])
def zone_risk(
    zone_id: str,
    horizon: int = Query(30, description="Forecast horizon in minutes (15, 30, 60, 360, 1440)"),
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    _zone_or_404(zone_id)
    if horizon not in (15, 30, 60, 360, 1440):
        raise HTTPException(status_code=422, detail="horizon must be one of 15, 30, 60, 360, or 1440 minutes")
    return {**monitor.risk(zone_id, horizon), "zone_id": zone_id}


@router.get("/zones/{zone_id}/prediction-overview", response_model=ZonePredictionOverview, tags=["prediction"])
def zone_prediction_overview(
    zone_id: str,
    horizon: int = Query(30, description="Selected chart horizon in minutes (30, 60, 360, 1440)"),
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    _zone_or_404(zone_id)
    if horizon not in (15, 30, 60, 360, 1440):
        horizon = 30
    return monitor.get_zone_prediction_overview(zone_id, selected_horizon=horizon)


@router.get("/events", response_model=list[EventItem], tags=["alerts"])
def list_events(
    limit: int = Query(20, ge=1, le=100),
    monitor: MonitoringService = Depends(get_monitor),
) -> list[dict[str, Any]]:
    return monitor.get_active_events_log(limit=limit)


@router.get("/zones/{zone_id}/sensor-health", tags=["prediction"])
def zone_sensor_health(zone_id: str, monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    _zone_or_404(zone_id)
    return {"zone_id": zone_id, **monitor.get_assessment(zone_id).sensor}


# ---------------------------------------------------------------------- alerts
@router.get("/alerts", response_model=list[Alert], tags=["alerts"])
def list_alerts(
    severity: Optional[Severity] = None,
    zone_id: Optional[str] = None,
    acknowledged: Optional[bool] = None,
    active: Optional[bool] = None,
    limit: int = Query(100, ge=1, le=500),
    monitor: MonitoringService = Depends(get_monitor),
) -> list[dict[str, Any]]:
    if zone_id:
        _zone_or_404(zone_id)
    rows = monitor.db.list_alerts(zone_id=zone_id, severity=severity, acknowledged=acknowledged, active=active, limit=limit)
    return [_alert_out(a) for a in rows]


@router.get("/alerts/{alert_id}", response_model=Alert, tags=["alerts"])
def get_alert(alert_id: str, monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    alert = monitor.db.get_alert(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    return _alert_out(alert)


@router.post("/alerts/{alert_id}/acknowledge", response_model=Alert, tags=["alerts"])
def acknowledge_alert(
    alert_id: str, body: Optional[AcknowledgeRequest] = None, monitor: MonitoringService = Depends(get_monitor)
) -> dict[str, Any]:
    user = body.user if body else "operator"
    alert = monitor.alerts.acknowledge(alert_id, user, monitor.sim_time or pd.Timestamp.now().to_pydatetime())
    if alert is None:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found")
    return _alert_out(alert)


# ---------------------------------------------------------------------- phone alerts
@router.get("/notifications/phone", tags=["alerts"])
def phone_alert_status(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    return monitor.notifier.status()


@router.post("/notifications/phone/test", tags=["alerts"])
def phone_alert_test(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    return monitor.notifier.send_test()


# ---------------------------------------------------------------------- simulator
@router.get("/simulator/status", tags=["simulator"])
def simulator_status(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    return monitor.status()


@router.post("/simulator/scenario", response_model=MessageResponse, tags=["simulator"])
def activate_scenario(body: ScenarioRequest, monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    _zone_or_404(body.zone_id)
    monitor.set_scenario(body.zone_id, body.scenario, body.ambient_delta)
    return {"message": f"Scenario '{SCENARIOS[body.scenario]}' activated for {ZONES[body.zone_id].name}.",
            "data": monitor.status()}


@router.post("/simulator/reset", response_model=MessageResponse, tags=["simulator"])
def reset_simulator(body: Optional[ResetRequest] = None, monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    body = body or ResetRequest()
    if body.zone_id:
        _zone_or_404(body.zone_id)
    monitor.reset(body.mode, body.zone_id)
    msg = ("All data cleared and demo restarted from normal operation." if body.mode == "full"
           else "Normal operation restored; temperatures will recover over the next minutes.")
    return {"message": msg, "data": monitor.status()}


@router.post("/simulator/control", response_model=MessageResponse, tags=["simulator"])
def control_simulator(body: ControlRequest, monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    if body.tick_seconds is not None:
        monitor.tick_seconds = body.tick_seconds
    if body.running is not None:
        monitor.running = body.running
    return {"message": "Simulator updated.", "data": monitor.status()}


@router.post("/simulator/advance", response_model=MessageResponse, tags=["simulator"])
def advance_simulator(body: AdvanceRequest, monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    created = monitor.advance(body.minutes)
    return {"message": f"Advanced {body.minutes} simulated minutes; {created} new alert(s).", "data": monitor.status()}


@router.post("/simulator/what-if", tags=["simulator"])
def what_if(body: WhatIfRequest, monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    _zone_or_404(body.zone_id)
    try:
        return monitor.what_if(body.zone_id, body.scenario, body.duration_minutes, body.ambient_delta, body.projection_minutes)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


# ---------------------------------------------------------------------- model & validation
@router.get("/model/metrics", tags=["model"])
def model_metrics(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    fc = monitor.models.forecaster
    if fc is None:
        return {"available": False, "reason": monitor.models.error or "Model not trained.", "metrics": None}
    return {"available": True, "metrics": fc.metrics}


@router.get("/model/evaluation", response_model=ModelEvaluationResponse, tags=["model"])
def model_evaluation(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    return monitor.get_model_evaluation()


# ---------------------------------------------------------------------- manager
@router.get("/manager/overview", tags=["manager"])
def manager_overview(
    window_minutes: int = Query(240, ge=30, le=1440, description="Compliance window in minutes"),
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    overview = monitor.manager_overview(window_minutes)
    for zone in overview["zones"]:
        _with_alert(zone)
    overview["action_items"] = [_alert_out(a) for a in overview["action_items"]]
    return overview


# ---------------------------------------------------------------------- telemetry ingestion & source
@router.post("/telemetry/ingest", response_model=TelemetryIngestResponse, tags=["telemetry"])
def ingest_telemetry(
    body: Union[List[TelemetryIngestItem], TelemetryIngestItem],
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    items = [body.model_dump()] if isinstance(body, TelemetryIngestItem) else [i.model_dump() for i in body]
    return monitor.ingest_readings(items)


@router.get("/telemetry/source", response_model=TelemetrySourceStatus, tags=["telemetry"])
def get_telemetry_source(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    return monitor.get_telemetry_source_status()


@router.post("/telemetry/source", response_model=TelemetrySourceStatus, tags=["telemetry"])
def set_telemetry_source(
    body: TelemetrySourceChangeRequest,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    return monitor.set_telemetry_source(body.source, body.dataset_type or "test")

