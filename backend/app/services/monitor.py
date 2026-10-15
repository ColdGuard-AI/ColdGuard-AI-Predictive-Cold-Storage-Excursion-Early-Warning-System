"""Monitoring service: owns the live simulators, runs the analytics pipeline on every tick
(forecast -> sensor checks -> risk -> alerts) and serves results to the API layer."""
from __future__ import annotations

import asyncio
import logging
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import pandas as pd

from app.config import Settings
from app.database.db import Database
from app.models.anomaly import check_sensor, isolation_flags
from app.models.features import FORECAST_STEPS, build_features, prepare_readings
from app.models.registry import ModelBundle
from app.simulator.engine import SCENARIOS, Scenario, ZoneSimulator
from app.simulator.history import seed_live_history
from app.simulator.zones import ZONES, ZoneConfig

from .alerts import CATEGORY_LABELS, AlertManager, ZoneSignals, evaluate_conditions
from .forecasting import forecast_from_history
from .risk import compute_risk, temperature_status
from .whatif import run_what_if

log = logging.getLogger("coldguard.monitor")

ANALYSIS_WINDOW = 120  # readings used for each assessment
MAX_READINGS_PER_ZONE = 2880  # keep two simulated days in the live database


@dataclass
class ZoneAssessment:
    zone_id: str
    timestamp: datetime | None
    latest: dict[str, Any] | None
    temperature_status: str
    forecast: dict[str, Any]
    sensor: dict[str, Any]
    risk: dict[str, Any]
    slope_per_min: float
    door_open_minutes: float
    compressor_off_minutes: float


class MonitoringService:
    def __init__(self, settings: Settings, models: ModelBundle, db: Database) -> None:
        self.settings = settings
        self.models = models
        self.db = db
        self.alerts = AlertManager(db, cooldown_minutes=settings.alert_cooldown_minutes)
        self.sims: dict[str, ZoneSimulator] = {}
        self.assessments: dict[str, ZoneAssessment] = {}
        self.running = False
        self.tick_seconds = settings.tick_seconds
        self.tick_count = 0
        self._lock = threading.RLock()
        self._task: asyncio.Task | None = None

    # ------------------------------------------------------------------ lifecycle
    def initialize(self, start_time: datetime | None = None) -> None:
        """Fresh, reproducible start: clear storage, seed simulators and normal history."""
        with self._lock:
            self.db.reset()
            now = (start_time or datetime.now()).replace(second=0, microsecond=0)
            self.sims = {}
            history = []
            for i, (zone_id, cfg) in enumerate(ZONES.items()):
                sim = ZoneSimulator(cfg, seed=self.settings.seed + i * 17, start_time=now)
                history.extend(seed_live_history(cfg, sim, self.settings.seed_history_minutes))
                self.sims[zone_id] = sim
            self.db.insert_readings(history)
            self.tick_count = 0
            for zone_id in ZONES:
                self._assess(zone_id, raise_alerts=False)

    @property
    def sim_time(self) -> datetime | None:
        if not self.sims:
            return None
        return max(s.time for s in self.sims.values())

    def tick(self) -> list[dict[str, Any]]:
        """Advance every zone by one simulated minute and re-run the analytics pipeline."""
        created: list[dict[str, Any]] = []
        with self._lock:
            readings = [sim.step() for sim in self.sims.values()]
            self.db.insert_readings(readings)
            histories = {zid: self.db.recent_readings(zid, ANALYSIS_WINDOW) for zid in self.sims}
            flags = self._if_flags(histories)
            for zone_id, history in histories.items():
                created.extend(self._assess(zone_id, raise_alerts=True, history=history, if_flags=flags.get(zone_id)))
            self.tick_count += 1
            if self.tick_count % 200 == 0:
                self.db.prune_readings(MAX_READINGS_PER_ZONE)
        return created

    def advance(self, minutes: int) -> int:
        created = 0
        for _ in range(minutes):
            created += len(self.tick())
        return created

    async def run_loop(self) -> None:
        log.info("Simulator loop started (%.2fs per simulated minute)", self.tick_seconds)
        while True:
            try:
                if self.running:
                    await asyncio.to_thread(self.tick)
            except Exception:  # keep the loop alive; errors are logged
                log.exception("Simulator tick failed")
            await asyncio.sleep(self.tick_seconds)

    def start_background(self) -> None:
        self.running = True
        if self._task is None or self._task.done():
            self._task = asyncio.get_event_loop().create_task(self.run_loop())

    async def stop_background(self) -> None:
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    # ------------------------------------------------------------------ analytics
    def _if_flags(self, histories: dict[str, pd.DataFrame]) -> dict[str, Any]:
        if self.models.iforest is None:
            return {}
        nonempty = {z: h for z, h in histories.items() if not h.empty}
        if not nonempty:
            return {}
        try:
            return dict(zip(nonempty, isolation_flags(list(nonempty.values()), self.models.iforest)))
        except Exception:
            log.exception("Isolation Forest scoring failed; continuing with rule-based checks")
            return {}

    def _assess(
        self, zone_id: str, raise_alerts: bool, history: pd.DataFrame | None = None, if_flags: Any = None
    ) -> list[dict[str, Any]]:
        cfg = ZONES[zone_id]
        if history is None:
            history = self.db.recent_readings(zone_id, ANALYSIS_WINDOW)
        forecaster = self.models.forecaster
        if if_flags is None and not history.empty:
            if_flags = self._if_flags({zone_id: history}).get(zone_id)
        sensor = check_sensor(history, if_flags=if_flags)

        if history.empty:
            forecast = forecast_from_history(history, cfg, forecaster)
            self.assessments[zone_id] = ZoneAssessment(zone_id, None, None, "unknown", forecast, sensor.to_dict(),
                                                       {"score": None, "category": "unknown", "factors": []}, 0.0, 0.0, 0.0)
            return []

        prepared = prepare_readings(history)
        all_feats = build_features(prepared, cfg)
        forecast = forecast_from_history(history, cfg, forecaster, prepared=prepared, features=all_feats)
        feats = all_feats.iloc[-1]
        latest_row = history.iloc[-1].to_dict()
        latest_row["timestamp"] = pd.Timestamp(latest_row["timestamp"]).to_pydatetime()
        if pd.isna(latest_row.get("temperature")):
            latest_row["temperature"] = None
        valid = history["temperature"].dropna().astype(float).to_list()
        current = latest_row["temperature"]
        # When the latest value is missing, risk uses the last valid value.
        current_for_risk = current if current is not None else (valid[-1] if valid else None)
        slope = float(feats["d15"]) / 15.0
        door_min = float(feats["door_open_minutes"])
        comp_off_min = float(feats["compressor_off_minutes"])

        risk = self._risk_from(cfg, forecast, current_for_risk, slope, comp_off_min, door_min,
                               sensor.status == "suspicious", self.settings.alert_horizon_minutes)
        self.assessments[zone_id] = ZoneAssessment(
            zone_id=zone_id,
            timestamp=latest_row["timestamp"],
            latest=latest_row,
            temperature_status=temperature_status(cfg, current_for_risk),
            forecast=forecast,
            sensor=sensor.to_dict(),
            risk=risk,
            slope_per_min=slope,
            door_open_minutes=door_min,
            compressor_off_minutes=comp_off_min,
        )
        if not raise_alerts:
            return []
        signals = ZoneSignals(
            config=cfg, timestamp=latest_row["timestamp"], current_temp=current_for_risk, last_valid_temps=valid,
            compressor_off_minutes=comp_off_min, door_open_minutes=door_min, sensor_issues=sensor.issues,
            forecast=forecast, alert_horizon=self.settings.alert_horizon_minutes, slope_per_min=slope,
        )
        return self.alerts.process(zone_id, evaluate_conditions(signals), latest_row["timestamp"])

    @staticmethod
    def _risk_from(cfg: ZoneConfig, forecast: dict[str, Any], current: float | None, slope: float,
                   comp_off_min: float, door_min: float, suspicious: bool, horizon: int) -> dict[str, Any]:
        temps = [p["temperature"] for p in forecast.get("points", [])] if forecast.get("available") else []
        steps = FORECAST_STEPS[: len(temps)]
        result = compute_risk(cfg, current, temps, steps, slope, comp_off_min == 0, door_min, suspicious, horizon)
        out = result.to_dict()
        out["forecast_available"] = bool(temps)
        if not temps:
            out["method_note"] += " Forecast unavailable - score uses current readings only."
        return out

    # ------------------------------------------------------------------ queries
    def get_assessment(self, zone_id: str) -> ZoneAssessment:
        if zone_id not in ZONES:
            raise KeyError(zone_id)
        with self._lock:
            if zone_id not in self.assessments:
                self._assess(zone_id, raise_alerts=False)
            return self.assessments[zone_id]

    def zone_summary(self, zone_id: str) -> dict[str, Any]:
        cfg = ZONES[zone_id]
        a = self.get_assessment(zone_id)
        latest = a.latest or {}
        active = self.db.active_alerts(zone_id)
        recent = self.db.list_alerts(zone_id=zone_id, limit=1)
        return {
            "zone_id": cfg.zone_id,
            "name": cfg.name,
            "product": cfg.product,
            "sensor_id": cfg.sensor_id,
            "setpoint": cfg.setpoint,
            "lower_limit": cfg.lower_limit,
            "upper_limit": cfg.upper_limit,
            "scenario": self.sims[zone_id].scenario if zone_id in self.sims else "normal",
            "scenario_label": SCENARIOS[self.sims[zone_id].scenario] if zone_id in self.sims else SCENARIOS["normal"],
            "timestamp": a.timestamp,
            "temperature": latest.get("temperature"),
            "humidity": latest.get("humidity"),
            "ambient_temperature": latest.get("ambient_temperature"),
            "temperature_status": a.temperature_status,
            "compressor_status": latest.get("compressor_status"),
            "door_status": latest.get("door_status"),
            "door_open_minutes": a.door_open_minutes,
            "compressor_off_minutes": a.compressor_off_minutes,
            "sensor_status": a.sensor["status"],
            "sensor_issues": a.sensor["issues"],
            "risk_score": a.risk.get("score"),
            "risk_category": a.risk.get("category"),
            "trend_per_hour": round(a.slope_per_min * 60, 2),
            "time_to_breach_minutes": a.forecast.get("time_to_breach_minutes"),
            "warning_time_to_breach_minutes": a.forecast.get("warning_time_to_breach_minutes"),
            "active_alert_count": len(active),
            "latest_alert": recent[0] if recent else None,
        }

    def readings(self, zone_id: str, minutes: int) -> pd.DataFrame:
        return self.db.recent_readings(zone_id, minutes)

    def forecast(self, zone_id: str, horizon: int) -> dict[str, Any]:
        a = self.get_assessment(zone_id)
        fc = dict(a.forecast)
        fc["points"] = [p for p in fc.get("points", []) if p["minutes_ahead"] <= horizon]
        ttb = fc.get("time_to_breach_minutes")
        fc["horizon_minutes"] = horizon
        fc["excursion_expected"] = ttb is not None and ttb <= horizon
        if ttb is not None and ttb > horizon:
            fc["time_to_breach_minutes"] = None
            fc["breach_side"] = None
        wtb = fc.get("warning_time_to_breach_minutes")
        if wtb is not None and wtb > horizon:
            fc["warning_time_to_breach_minutes"] = None
            fc["warning_breach_side"] = None
        return fc

    def risk(self, zone_id: str, horizon: int) -> dict[str, Any]:
        cfg = ZONES[zone_id]
        a = self.get_assessment(zone_id)
        current = (a.latest or {}).get("temperature")
        if current is None:
            current = a.forecast.get("base_temperature")
        return self._risk_from(cfg, a.forecast, current, a.slope_per_min, a.compressor_off_minutes,
                               a.door_open_minutes, a.sensor["status"] == "suspicious", horizon)

    # ------------------------------------------------------------------ control
    def set_scenario(self, zone_id: str, scenario: str, ambient_delta: float | None = None) -> None:
        with self._lock:
            kwargs = {"ambient_delta": ambient_delta} if ambient_delta is not None else {}
            self.sims[zone_id].set_scenario(Scenario(kind=scenario, **kwargs))

    def reset(self, mode: str, zone_id: str | None = None) -> None:
        with self._lock:
            if mode == "full":
                self.initialize()
                return
            for zid, sim in self.sims.items():
                if zone_id is None or zid == zone_id:
                    sim.set_scenario("normal")

    def what_if(self, zone_id: str, scenario: str, duration_minutes: int | None, ambient_delta: float,
                projection_minutes: int) -> dict[str, Any]:
        with self._lock:
            sim = self.sims[zone_id]
            history = self.db.recent_readings(zone_id, ANALYSIS_WINDOW)
            current_risk = self.get_assessment(zone_id).risk.get("score")
            return run_what_if(sim, history, self.models.forecaster, scenario, duration_minutes, ambient_delta,
                               projection_minutes, current_risk, seed=self.settings.seed + 999)

    def status(self) -> dict[str, Any]:
        return {
            "running": self.running,
            "tick_seconds": self.tick_seconds,
            "sim_time": self.sim_time,
            "tick_count": self.tick_count,
            "zones": {zid: {"scenario": s.scenario, "label": SCENARIOS[s.scenario],
                            "scenario_minutes": s.state.scenario_minutes} for zid, s in self.sims.items()},
            "available_scenarios": [{"id": k, "label": v} for k, v in SCENARIOS.items()],
            "alert_categories": CATEGORY_LABELS,
        }

    # ------------------------------------------------------------------ manager view
    def manager_overview(self, window_minutes: int = 240) -> dict[str, Any]:
        """Facility-level summary for the storage manager: status, compliance and actions per zone."""
        zones = []
        for zone_id, cfg in ZONES.items():
            summary = self.zone_summary(zone_id)
            df = self.db.recent_readings(zone_id, window_minutes)
            temps = pd.to_numeric(df["temperature"], errors="coerce") if not df.empty else pd.Series(dtype=float)
            valid = temps.dropna()
            in_range = valid.between(cfg.lower_limit, cfg.upper_limit)
            spark = df.tail(60)
            alerts = self.db.list_alerts(zone_id=zone_id, limit=200)
            summary.update({
                "window_minutes": window_minutes,
                "readings_in_window": int(len(df)),
                "time_in_range_pct": round(float(in_range.mean() * 100), 1) if len(valid) else None,
                "excursion_minutes": int((~in_range).sum()) if len(valid) else 0,
                "missing_readings": int(temps.isna().sum()) if len(df) else 0,
                "min_temperature": round(float(valid.min()), 2) if len(valid) else None,
                "max_temperature": round(float(valid.max()), 2) if len(valid) else None,
                "door_open_minutes_window": int((df["door_status"] == "open").sum()) if len(df) else 0,
                "compressor_off_minutes_window": int((df["compressor_status"] == "stopped").sum()) if len(df) else 0,
                "sparkline": [None if pd.isna(t) else round(float(t), 2) for t in spark["temperature"]] if len(spark) else [],
                "unacknowledged_alerts": sum(1 for a in alerts if not a["acknowledged"]),
                "active_critical_alerts": sum(1 for a in alerts if a["active"] and a["severity"] == "critical"),
            })
            zones.append(summary)
        action_items = [a for a in self.db.list_alerts(acknowledged=False, limit=100)]
        action_items.sort(key=lambda a: a["created_at"], reverse=True)  # newest first...
        action_items.sort(key=lambda a: (not a["active"], a["severity"] != "critical"))  # ...within active-critical first
        ok = sum(1 for z in zones if z["temperature_status"] == "normal" and z["risk_category"] == "low")
        pcts = [z["time_in_range_pct"] for z in zones if z["time_in_range_pct"] is not None]
        return {
            "sim_time": self.sim_time,
            "window_minutes": window_minutes,
            "totals": {
                "zones": len(zones),
                "zones_ok": ok,
                "zones_attention": len(zones) - ok,
                "active_alerts": sum(z["active_alert_count"] for z in zones),
                "unacknowledged_alerts": len(action_items),
                "facility_time_in_range_pct": round(sum(pcts) / len(pcts), 1) if pcts else None,
                "highest_risk_zone": max(zones, key=lambda z: z["risk_score"] or 0)["zone_id"] if zones else None,
            },
            "zones": zones,
            "action_items": action_items[:8],
        }
