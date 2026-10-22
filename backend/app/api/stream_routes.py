"""Server-Sent Events (SSE) streaming endpoint for real-time telemetry.

Pushes zone summaries, risk scores, alerts, and forecasts every tick
so the frontend can render a live excursion-monitoring dashboard
without polling.
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.services.monitor import MonitoringService

log = logging.getLogger("coldguard.stream")
router = APIRouter(prefix="/api/stream")


def get_monitor(request: Request) -> MonitoringService:
    return request.app.state.monitor


def _serialize(obj: Any) -> str:
    """JSON serialiser that handles datetime and numpy scalars."""
    import numpy as np

    def default(o: Any) -> Any:
        if isinstance(o, datetime):
            return o.isoformat(timespec="seconds")
        if isinstance(o, np.integer):
            return int(o)
        if isinstance(o, np.floating):
            return float(o)
        if isinstance(o, np.ndarray):
            return o.tolist()
        raise TypeError(f"Not serializable: {type(o)}")

    return json.dumps(obj, default=default)


async def _event_generator(monitor: MonitoringService, request: Request):
    """Yields SSE frames with real-time zone telemetry and risk data."""
    from app.simulator.zones import ZONES

    while True:
        # Check client disconnect
        if await request.is_disconnected():
            break

        try:
            payload: dict[str, Any] = {
                "timestamp": monitor.sim_time.isoformat(timespec="seconds") if monitor.sim_time else None,
                "tick_count": monitor.tick_count,
                "running": monitor.running,
                "zones": [],
                "alerts": [],
                "facility_risk": 0,
                "total_power_kw": 0.0,
                "is_synthetic": True,
            }

            zone_risks = []
            total_power = 0.0
            for zone_id in ZONES:
                try:
                    summary = monitor.zone_summary(zone_id)
                    assessment = monitor.get_assessment(zone_id)
                    forecast = monitor.forecast(zone_id, 30)

                    power_kw = summary.get("power_consumption_kw")
                    if power_kw is not None:
                        total_power += power_kw

                    zone_data = {
                        "zone_id": summary["zone_id"],
                        "name": summary["name"],
                        "product": summary["product"],
                        "temperature": summary["temperature"],
                        "humidity": summary["humidity"],
                        "ambient_temperature": summary["ambient_temperature"],
                        "temperature_status": summary["temperature_status"],
                        "compressor_status": summary["compressor_status"],
                        "compressor_load_pct": summary.get("compressor_load_pct", 0.0),
                        "power_consumption_kw": power_kw,
                        "sensor_health": summary.get("sensor_health", "healthy"),
                        "door_status": summary["door_status"],
                        "door_open_minutes": summary["door_open_minutes"],
                        "compressor_off_minutes": summary["compressor_off_minutes"],
                        "sensor_status": summary["sensor_status"],
                        "sensor_issues": summary["sensor_issues"],
                        "risk_score": summary["risk_score"],
                        "risk_category": summary["risk_category"],
                        "trend_per_hour": summary["trend_per_hour"],
                        "time_to_breach_minutes": summary["time_to_breach_minutes"],
                        "warning_time_to_breach_minutes": summary["warning_time_to_breach_minutes"],
                        "active_alert_count": summary["active_alert_count"],
                        "setpoint": summary["setpoint"],
                        "lower_limit": summary["lower_limit"],
                        "upper_limit": summary["upper_limit"],
                        "scenario": summary["scenario"],
                        "scenario_label": summary["scenario_label"],
                        "forecast_available": forecast.get("available", False),
                        "forecast_points": forecast.get("points", [])[:6],
                        "excursion_expected": forecast.get("excursion_expected", False),
                        "slope_per_min": assessment.slope_per_min,
                        "is_synthetic": True,
                    }
                    payload["zones"].append(zone_data)
                    if summary["risk_score"] is not None:
                        zone_risks.append(summary["risk_score"])
                except Exception:
                    log.exception("Error building zone %s stream data", zone_id)

            # Facility-level risk and power
            payload["facility_risk"] = max(zone_risks) if zone_risks else 0
            payload["total_power_kw"] = round(total_power, 2)

            # Active alerts
            try:
                active_alerts = monitor.db.list_alerts(active=True, limit=20)
                payload["alerts"] = [
                    {
                        "id": a["id"],
                        "zone_id": a["zone_id"],
                        "category": a["category"],
                        "severity": a["severity"],
                        "title": a["title"],
                        "explanation": a["explanation"],
                        "recommended_action": a["recommended_action"],
                        "created_at": a["created_at"],
                        "occurrences": a["occurrences"],
                        "acknowledged": a["acknowledged"],
                    }
                    for a in active_alerts
                ]
            except Exception:
                log.exception("Error fetching alerts for stream")

            data = _serialize(payload)
            yield f"data: {data}\n\n"

        except Exception:
            log.exception("SSE generator error")
            yield f"data: {_serialize({'error': 'Internal error'})}\n\n"

        await asyncio.sleep(1.0)


@router.get("/telemetry", tags=["stream"])
async def stream_telemetry(request: Request, monitor: MonitoringService = Depends(get_monitor)):
    """SSE endpoint that streams real-time zone telemetry every second.

    Connect with EventSource:
        const es = new EventSource('/api/stream/telemetry');
        es.onmessage = (e) => console.log(JSON.parse(e.data));
    """
    return StreamingResponse(
        _event_generator(monitor, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/datasets/info", tags=["datasets"])
async def dataset_info():
    """Returns physics metadata, calibration specifications, and chronological split stats."""
    from pathlib import Path
    meta_path = Path(__file__).resolve().parents[2] / "data" / "synthetic" / "dataset_metadata.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Synthetic dataset metadata not generated yet")
    with open(meta_path, "r") as f:
        return json.load(f)


@router.get("/datasets/download/{dataset_type}", tags=["datasets"])
async def download_synthetic_dataset(dataset_type: str):
    """Downloads one of the generated synthetic CSV datasets: train, val, test, or full."""
    from fastapi.responses import FileResponse
    from pathlib import Path

    valid_types = {
        "train": "train_dataset.csv",
        "val": "val_dataset.csv",
        "test": "test_dataset.csv",
        "full": "synthetic_sensor_readings_full.csv",
    }
    if dataset_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid dataset type '{dataset_type}'. Valid: {list(valid_types.keys())}")

    filename = valid_types[dataset_type]
    file_path = Path(__file__).resolve().parents[2] / "data" / "synthetic" / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File {filename} not found")

    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="text/csv",
    )
