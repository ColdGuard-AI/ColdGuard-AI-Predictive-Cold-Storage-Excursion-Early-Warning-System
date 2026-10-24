"""Physics-informed, explainable risk assessment (0-100) with stateful post-closure thermal memory.

The risk score is a documented rule-based combination of:

| Component            | Max | Driven by                                                                 |
|----------------------|-----|---------------------------------------------------------------------------|
| Forecast proximity   | 40  | ML forecast within the horizon approaching/crossing safe limit             |
| Current position     | 20  | How close the current reading is to a safe limit (20 if outside)          |
| Temperature trend    | 15  | 15-minute rate of change toward a limit                                   |
| Equipment & Door     | 20  | Compressor status, active door openings, AND post-closure recovery phase   |
| Sensor reliability   | 10  | Sensor flagged suspicious (reduces confidence in telemetry)               |

CRITICAL SAFETY PROPERTY:
Closing a door never resets risk to zero. While residual trapped heat causes post-closure rise
or the refrigeration system is pulling temperature down, risk remains elevated until full
thermal recovery to within safe setpoint bounds.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.simulator.zones import ZoneConfig

DOOR_OPEN_ALERT_MINUTES = 5
TREND_FULL_SCALE = 0.10  # °C/min toward a limit that earns the full trend score


@dataclass
class RiskFactor:
    key: str
    label: str
    points: float
    max_points: float
    detail: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "label": self.label,
            "points": round(self.points, 1),
            "max_points": self.max_points,
            "detail": self.detail,
        }


@dataclass
class RiskResult:
    score: int
    category: str
    factors: list[RiskFactor] = field(default_factory=list)
    horizon_minutes: int = 30
    recovery_progress_pct: float = 100.0
    predicted_peak_temperature: float | None = None
    residual_rise: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "category": self.category,
            "horizon_minutes": self.horizon_minutes,
            "recovery_progress_pct": round(self.recovery_progress_pct, 1),
            "predicted_peak_temperature": self.predicted_peak_temperature,
            "residual_rise": round(self.residual_rise, 2),
            "factors": [f.to_dict() for f in self.factors if f.points >= 0.5],
            "method": "physics_ml_hybrid",
            "method_note": "Rule-based score combining ML forecast, thermal inertia, equipment state, and post-closure cooling recovery.",
        }


def risk_category(score: float) -> str:
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def _clip01(x: float) -> float:
    return max(0.0, min(1.0, x))


def compute_risk(
    config: ZoneConfig,
    current_temp: float | None,
    forecast_temps: list[float],
    forecast_steps: list[int],
    slope_per_min: float,
    compressor_on: bool,
    door_open_minutes: float,
    sensor_suspicious: bool,
    horizon_minutes: int = 30,
    time_since_closure_minutes: float = 0.0,
    last_door_duration_minutes: float = 0.0,
    residual_rise_predicted: float = 0.0,
    peak_temp_predicted: float | None = None,
    recovery_progress_pct: float = 100.0,
    recovery_phase: str = "none",
    scenario: str = "normal",
) -> RiskResult:
    half_band = config.range_width / 2.0
    factors: list[RiskFactor] = []

    # 1. Forecast proximity: how close does the forecast get to a limit within the horizon?
    in_horizon = [t for t, h in zip(forecast_temps, forecast_steps) if h <= horizon_minutes]
    is_active_recovery = (
        door_open_minutes > 0
        or recovery_phase in ("residual_rise", "active_recovery", "door_open")
    ) and recovery_progress_pct < 100.0

    effective_peak = (
        peak_temp_predicted
        if (is_active_recovery and peak_temp_predicted is not None)
        else (current_temp or config.setpoint)
    )
    if in_horizon:
        hi, lo = max(in_horizon), min(in_horizon)
        if effective_peak > hi:
            hi = effective_peak
        margin_hi = config.upper_limit - hi
        margin_lo = lo - config.lower_limit
        margin = min(margin_hi, margin_lo)
        which = "upper" if margin_hi <= margin_lo else "lower"
        limit = config.upper_limit if which == "upper" else config.lower_limit
        extreme = hi if which == "upper" else lo

        pts = 40.0 * _clip01(1.0 - margin / (0.6 * half_band))
        if margin <= 0:
            detail = f"Forecast reaches {extreme:.1f}°C within {horizon_minutes} min, breaching {which} limit ({limit:.1f}°C)."
        else:
            detail = f"Forecast peaks at {extreme:.1f}°C within {horizon_minutes} min ({margin:.1f}°C from {which} limit of {limit:.1f}°C)."
        factors.append(RiskFactor("forecast", "Forecast approaches limit", pts, 40, detail))
    elif is_active_recovery and peak_temp_predicted is not None and peak_temp_predicted > config.setpoint:
        margin_hi = config.upper_limit - peak_temp_predicted
        pts = 40.0 * _clip01(1.0 - margin_hi / (0.6 * half_band))
        factors.append(RiskFactor("forecast", "Predicted peak approaches limit", pts, 40,
                                  f"Predicted thermal peak is {peak_temp_predicted:.1f}°C ({margin_hi:.1f}°C buffer)."))

    # 2. Current position within the safe band.
    if current_temp is not None:
        dist = min(config.upper_limit - current_temp, current_temp - config.lower_limit)
        if dist < 0:
            pts, detail = 20.0, f"Current reading {current_temp:.1f}°C is outside the safe range ({config.lower_limit:.0f} to {config.upper_limit:.0f}°C)."
        else:
            pts = 20.0 * _clip01(1.0 - dist / (0.6 * half_band))
            detail = f"Current reading {current_temp:.1f}°C is {dist:.1f}°C from the nearest limit."
        factors.append(RiskFactor("current", "Current temperature position", pts, 20, detail))

    # 3. Trend toward a limit.
    if current_temp is not None:
        toward_upper = current_temp >= config.setpoint
        rate = slope_per_min if toward_upper else -slope_per_min
        pts = 15.0 * _clip01(rate / TREND_FULL_SCALE)
        if pts > 0:
            direction = "rising" if slope_per_min > 0 else "falling"
            detail = f"Temperature is {direction} at {abs(slope_per_min) * 60:.1f}°C/hour (15-min trend)."
            factors.append(RiskFactor("trend", f"Temperature {direction} consistently", pts, 15, detail))

    # 4. Equipment & Stateful Door Condition (CRITICAL: Risk does not zero on door closure!)
    equip_pts = 0.0
    equip_notes = []

    if not compressor_on:
        equip_pts += 15.0
        equip_notes.append("compressor is stopped")

    if door_open_minutes >= DOOR_OPEN_ALERT_MINUTES:
        equip_pts += 12.0
        equip_notes.append(f"door open for {int(door_open_minutes)} min")
    elif door_open_minutes > 0:
        equip_pts += 5.0
        equip_notes.append("door is open")
    elif recovery_phase == "residual_rise" or (time_since_closure_minutes < 12 and residual_rise_predicted > 0.1):
        # Door just closed: residual heating is actively occurring
        rise_pts = min(14.0, 6.0 + (residual_rise_predicted * 6.0))
        equip_pts += rise_pts
        equip_notes.append(
            f"door closed {int(time_since_closure_minutes)}m ago; residual thermal rise in progress (+{residual_rise_predicted:.2f}°C, peak {peak_temp_predicted:.1f}°C)"
        )
    elif recovery_phase == "active_recovery" or (recovery_progress_pct < 90.0 and (current_temp or 0) > config.setpoint + 0.3):
        # In active pull-down recovery
        rec_pts = min(10.0, max(2.5, 10.0 * (1.0 - recovery_progress_pct / 100.0)))
        equip_pts += rec_pts
        equip_notes.append(f"chamber undergoing cooling recovery ({recovery_progress_pct:.0f}% restored)")

    if equip_pts > 0:
        factors.append(
            RiskFactor("equipment", "Equipment & thermal recovery status", min(equip_pts, 20.0), 20,
                       "The " + " and ".join(equip_notes) + ".")
        )

    # 5. Sensor reliability.
    if sensor_suspicious:
        factors.append(RiskFactor("sensor", "Sensor readings suspicious", 10.0, 10,
                                  "Sensor telemetry anomaly detected - readings and forecast may be unreliable."))

    # 6. Specific Situation Impact & Fault Injections
    if scenario == "fire_runaway":
        factors.append(RiskFactor("fire_hazard", "Sensor Fire / Thermal Runaway", 35.0, 35,
                                  "Critical thermal runaway active on sensor node; +2°C/min heat influx with emergency failsafe."))
    elif scenario == "fan_off":
        factors.append(RiskFactor("fan_trip", "Evaporator Fan Tripped (Zero Forced Airflow)", 28.0, 28,
                                  "Evaporator circulation fans offline; heat cannot be extracted from cooling coils, causing rapid thermal stratification."))
    elif scenario == "cooling_degradation":
        factors.append(RiskFactor("degradation", "Cooling Capacity Degraded 45%", 20.0, 20,
                                  "Condenser fouling or refrigerant loss; cooling efficiency derated by 45% under continuous compressor strain."))
    elif scenario == "sensor_anomaly":
        if not sensor_suspicious:
            factors.append(RiskFactor("sensor_fault", "Sensor Telemetry Fault", 20.0, 20,
                                      "Sensor anomaly active; telemetry stream corrupted or frozen."))

    score = int(round(min(100.0, sum(f.points for f in factors))))
    factors.sort(key=lambda f: f.points, reverse=True)
    return RiskResult(
        score=score,
        category=risk_category(score),
        factors=factors,
        horizon_minutes=horizon_minutes,
        recovery_progress_pct=recovery_progress_pct,
        predicted_peak_temperature=peak_temp_predicted,
        residual_rise=residual_rise_predicted,
    )


def temperature_status(config: ZoneConfig, temp: float | None) -> str:
    if temp is None:
        return "unknown"
    if temp > config.upper_limit or temp < config.lower_limit:
        return "critical"
    warn_margin = 0.2 * config.range_width
    if temp > config.upper_limit - warn_margin or temp < config.lower_limit + warn_margin:
        return "warning"
    return "normal"
