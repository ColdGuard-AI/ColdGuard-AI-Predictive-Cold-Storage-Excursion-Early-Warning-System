"""Alert rules, recommendations and de-duplication.

Each evaluation produces a set of *conditions* for a zone. The :class:`AlertManager`
turns conditions into persisted alerts:

* an alert stays a single record while its condition persists (no duplicates per tick);
* when the condition clears, the alert is marked inactive (resolved);
* if the same condition returns within the cooldown, the previous alert is re-activated
  instead of creating a new one;
* severity only escalates while an alert is active.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable

from app.database.db import Database
from app.simulator.zones import ZoneConfig

from .risk import DOOR_OPEN_ALERT_MINUTES

SEVERITY_RANK = {"info": 0, "warning": 1, "critical": 2}

CATEGORY_LABELS = {
    "predicted_excursion": "Predicted Temperature Excursion",
    "high_temperature": "High Temperature",
    "low_temperature": "Low Temperature",
    "compressor_failure": "Compressor Failure",
    "door_open": "Door Left Open",
    "sensor_anomaly": "Sensor Anomaly",
    "missing_data": "Missing Sensor Data",
    "data_tampering": "Cryptographic Data Tampering Detected",
}

COMPRESSOR_ALERT_MINUTES = 2
DOOR_CRITICAL_MINUTES = 15


@dataclass
class Condition:
    category: str
    severity: str
    title: str
    explanation: str
    recommended_action: str
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class ZoneSignals:
    """Everything the alert rules need about one zone at one moment."""
    config: ZoneConfig
    timestamp: datetime
    current_temp: float | None
    last_valid_temps: list[float]
    compressor_off_minutes: float
    door_open_minutes: float
    sensor_issues: list[dict[str, Any]]
    forecast: dict[str, Any]
    alert_horizon: int
    slope_per_min: float
    tamper_issue: dict[str, Any] | None = None


def _predicted_action(s: ZoneSignals) -> str:
    """Recommendation tied to the conditions that are actually observed."""
    if s.compressor_off_minutes >= 1:
        return "Inspect the compressor and verify power supply; prepare to move stock to backup storage."
    if s.door_open_minutes >= 1:
        return "Close the door and check the door seal; confirm temperature recovers."
    return "Inspect refrigeration performance and prepare corrective action (e.g. backup cold storage)."


def evaluate_conditions(s: ZoneSignals) -> list[Condition]:
    cfg = s.config
    out: list[Condition] = []
    sensor_suspicious = any(i["type"] in ("spike", "stuck_sensor", "isolation_forest") for i in s.sensor_issues)

    # Actual excursion: two consecutive valid readings outside the range (single spikes are ignored).
    last_two = s.last_valid_temps[-2:]
    if len(last_two) == 2 and all(t > cfg.upper_limit for t in last_two):
        out.append(Condition(
            "high_temperature", "critical", f"Temperature above {cfg.upper_limit:.0f}°C",
            f"Last two readings ({last_two[0]:.1f}°C, {last_two[1]:.1f}°C) exceed the configured upper limit of {cfg.upper_limit:.1f}°C.",
            "Inspect refrigeration performance immediately, limit door openings and assess affected stock per your excursion procedure.",
            {"temperature": last_two[1], "limit": cfg.upper_limit},
        ))
    elif len(last_two) == 2 and all(t < cfg.lower_limit for t in last_two):
        out.append(Condition(
            "low_temperature", "critical", f"Temperature below {cfg.lower_limit:.0f}°C",
            f"Last two readings ({last_two[0]:.1f}°C, {last_two[1]:.1f}°C) are below the configured lower limit of {cfg.lower_limit:.1f}°C.",
            "Check thermostat settings and refrigeration controls; assess freeze-sensitive stock.",
            {"temperature": last_two[1], "limit": cfg.lower_limit},
        ))
    else:
        # Early warning: forecast leaves the range within the alert horizon while still in range now.
        ttb = s.forecast.get("warning_time_to_breach_minutes") if s.forecast.get("available") else None
        if ttb is not None and ttb <= s.alert_horizon and not sensor_suspicious and s.current_temp is not None:
            side = s.forecast.get("warning_breach_side") or "upper"
            limit = cfg.upper_limit if side == "upper" else cfg.lower_limit
            drivers = []
            if s.compressor_off_minutes >= 1:
                drivers.append(f"compressor stopped for {int(s.compressor_off_minutes)} min")
            if s.door_open_minutes >= 1:
                drivers.append(f"door open for {int(s.door_open_minutes)} min")
            if abs(s.slope_per_min) >= 0.02:
                drivers.append(f"temperature {'rising' if s.slope_per_min > 0 else 'falling'} at {abs(s.slope_per_min) * 60:.1f}°C/h")
            driver_text = f" Observed: {', '.join(drivers)}." if drivers else ""
            out.append(Condition(
                "predicted_excursion", "critical" if ttb <= 10 else "warning",
                "Excursion predicted within the next minute" if ttb < 1 else f"Excursion predicted in ~{ttb:.0f} min",
                f"The forecasting model predicts the temperature may cross the {side} limit of {limit:.1f}°C "
                f"{'within the next minute' if ttb < 1 else f'in about {ttb:.0f} minutes'} "
                f"(currently {s.current_temp:.1f}°C; conservative upper-quartile forecast).{driver_text}",
                _predicted_action(s),
                {"time_to_breach_minutes": ttb, "limit": limit, "current_temperature": s.current_temp},
            ))

    if s.compressor_off_minutes >= COMPRESSOR_ALERT_MINUTES:
        temp_text = f" while the temperature is {s.current_temp:.1f}°C (setpoint {cfg.setpoint:.0f}°C)" if s.current_temp is not None else ""
        out.append(Condition(
            "compressor_failure", "critical", "Compressor stopped",
            f"The compressor has reported 'stopped' for {int(s.compressor_off_minutes)} consecutive minutes{temp_text}.",
            "Inspect the compressor and verify power supply.",
            {"minutes_stopped": s.compressor_off_minutes},
        ))

    if s.door_open_minutes >= DOOR_OPEN_ALERT_MINUTES:
        out.append(Condition(
            "door_open", "critical" if s.door_open_minutes >= DOOR_CRITICAL_MINUTES else "warning",
            "Door left open",
            f"The door has been open for {int(s.door_open_minutes)} consecutive minutes.",
            "Check the door seal and close the door.",
            {"minutes_open": s.door_open_minutes},
        ))

    anomaly_issues = [i for i in s.sensor_issues if i["type"] in ("spike", "stuck_sensor", "isolation_forest")]
    if anomaly_issues:
        out.append(Condition(
            "sensor_anomaly", "warning", "Suspicious sensor readings",
            " ".join(i["detail"] for i in anomaly_issues),
            "Verify the sensor against an independent measurement (e.g. a calibrated probe) before acting on its readings.",
            {"issues": [i["type"] for i in anomaly_issues]},
        ))

    missing = [i for i in s.sensor_issues if i["type"] == "missing_data"]
    if missing:
        out.append(Condition(
            "missing_data", "warning", "Missing sensor data",
            " ".join(i["detail"] for i in missing),
            "Check sensor power, wiring and gateway connectivity; take a manual reading in the meantime.",
            {},
        ))

    if s.tamper_issue:
        t_data = s.tamper_issue.get("tampered_data") or f"Field '{s.tamper_issue.get('tampered_field', 'telemetry')}' altered"
        t_from = s.tamper_issue.get("tampered_from") or f"Zone {s.config.name} (Device {s.tamper_issue.get('device_id', s.config.sensor_id)})"
        t_ts = s.tamper_issue.get("telemetry_timestamp") or s.timestamp.isoformat()
        t_det = s.tamper_issue.get("detected_at") or s.timestamp.isoformat()
        out.append(Condition(
            "data_tampering",
            "critical",
            f"Tamper Detected: {t_data} in {s.config.name}",
            f"SECURITY ALERT: Cryptographic data tampering detected! {t_data}. Source: {t_from}. Telemetry Timestamp: {t_ts}. Audit Detected At: {t_det}.",
            "QUARANTINE PROTOCOL: Exclude tampered reading from ML engine immediately. Restore database record to verified baseline or re-anchor hash ledger.",
            s.tamper_issue,
        ))

    return out


class AlertManager:
    def __init__(self, db: Database, cooldown_minutes: int = 20) -> None:
        self.db = db
        self.cooldown = timedelta(minutes=cooldown_minutes)
        # Optional callback for phone notifications. Receives every alert that is new,
        # re-activated after clearing, or escalated in severity (not just brand-new ones).
        self.on_notify: Callable[[list[dict[str, Any]]], None] | None = None

    def process(self, zone_id: str, conditions: list[Condition], now: datetime) -> list[dict[str, Any]]:
        """Apply conditions for a zone; returns alerts that were newly created."""
        created = []
        to_notify: list[dict[str, Any]] = []
        present = {c.category: c for c in conditions}
        for category in CATEGORY_LABELS:
            latest = self.db.latest_alert_for(zone_id, category)
            cond = present.get(category)
            if cond is None:
                if latest and latest["active"]:
                    self.db.update_alert(latest["id"], active=False, last_seen_at=now)
                continue
            if latest and latest["active"]:
                severity = latest["severity"]
                if SEVERITY_RANK[cond.severity] > SEVERITY_RANK[severity]:
                    severity = cond.severity
                self.db.update_alert(latest["id"], last_seen_at=now, severity=severity, title=cond.title,
                                     explanation=cond.explanation, context=cond.context)
                if severity != latest["severity"]:  # escalated, e.g. warning -> critical
                    to_notify.append(self.db.get_alert(latest["id"]))
                continue
            if latest and now - datetime.fromisoformat(latest["last_seen_at"]) < self.cooldown:
                # Same condition returned shortly after clearing: re-activate instead of duplicating.
                self.db.update_alert(latest["id"], active=True, last_seen_at=now, severity=cond.severity,
                                     title=cond.title, explanation=cond.explanation, context=cond.context)
                self.db.increment_occurrence(latest["id"])
                to_notify.append(self.db.get_alert(latest["id"]))
                continue
            context = dict(cond.context)
            if category in ("high_temperature", "low_temperature"):
                warning = self.db.latest_alert_for(zone_id, "predicted_excursion")
                if warning:
                    lead = (now - datetime.fromisoformat(warning["created_at"])).total_seconds() / 60
                    if 0 < lead <= 120:
                        context["early_warning_lead_minutes"] = round(lead)
                        cond.explanation += f" An early-warning alert was raised {round(lead)} min before this excursion."
            alert = {
                "id": f"ALT-{uuid.uuid4().hex[:8].upper()}",
                "zone_id": zone_id,
                "category": category,
                "severity": cond.severity,
                "title": cond.title,
                "explanation": cond.explanation,
                "recommended_action": cond.recommended_action,
                "created_at": now,
                "last_seen_at": now,
                "context": context,
            }
            self.db.insert_alert(alert)
            created.append(alert)
            to_notify.append(alert)
        if self.on_notify and to_notify:
            self.on_notify([a for a in to_notify if a])
        return created

    def acknowledge(self, alert_id: str, user: str, now: datetime) -> dict[str, Any] | None:
        alert = self.db.get_alert(alert_id)
        if alert is None:
            return None
        if not alert["acknowledged"]:
            self.db.update_alert(alert_id, acknowledged=True, acknowledged_at=now, acknowledged_by=user)
        return self.db.get_alert(alert_id)
