"""Heuristic, explainable risk score (0-100).

The risk score is NOT a model output. It is a documented rule-based combination of:

| Component            | Max | Driven by                                                       |
|----------------------|-----|-----------------------------------------------------------------|
| Forecast proximity   | 40  | ML forecast within the horizon approaching/crossing a limit      |
| Current position     | 20  | How close the current reading is to a limit (20 if outside)     |
| Temperature trend    | 15  | 15-minute rate of change toward a limit                         |
| Equipment state      | 20  | Compressor stopped (15), door open (3 brief / 10 for >= 5 min)  |
| Sensor reliability   | 10  | Sensor flagged suspicious (reduces trust in all of the above)   |

Score is capped at 100. Categories: Low < 25 <= Medium < 50 <= High < 75 <= Critical.
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
        return {"key": self.key, "label": self.label, "points": round(self.points, 1),
                "max_points": self.max_points, "detail": self.detail}


@dataclass
class RiskResult:
    score: int
    category: str
    factors: list[RiskFactor] = field(default_factory=list)
    horizon_minutes: int = 30

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "category": self.category,
            "horizon_minutes": self.horizon_minutes,
            "factors": [f.to_dict() for f in self.factors if f.points >= 0.5],
            "method": "heuristic",
            "method_note": "Rule-based score combining the ML forecast with current readings and equipment state. It is not a probability.",
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
) -> RiskResult:
    half_band = config.range_width / 2.0
    factors: list[RiskFactor] = []

    # 1. Forecast proximity: how close does the forecast get to a limit within the horizon?
    in_horizon = [t for t, h in zip(forecast_temps, forecast_steps) if h <= horizon_minutes]
    if in_horizon:
        hi, lo = max(in_horizon), min(in_horizon)
        margin_hi = config.upper_limit - hi
        margin_lo = lo - config.lower_limit
        margin = min(margin_hi, margin_lo)
        which = "upper" if margin_hi <= margin_lo else "lower"
        limit = config.upper_limit if which == "upper" else config.lower_limit
        extreme = hi if which == "upper" else lo
        # Full points once the forecast crosses the limit; scales up over the last 60% of the half-band.
        pts = 40.0 * _clip01(1.0 - margin / (0.6 * half_band))
        if margin <= 0:
            detail = f"Forecast reaches {extreme:.1f}°C within {horizon_minutes} min, beyond the {which} limit of {limit:.1f}°C."
        else:
            detail = f"Forecast peaks at {extreme:.1f}°C within {horizon_minutes} min, {margin:.1f}°C from the {which} limit ({limit:.1f}°C)."
        factors.append(RiskFactor("forecast", "Forecast approaches limit", pts, 40, detail))

    # 2. Current position within the safe band.
    if current_temp is not None:
        dist = min(config.upper_limit - current_temp, current_temp - config.lower_limit)
        if dist < 0:
            pts, detail = 20.0, f"Current reading {current_temp:.1f}°C is outside the safe range ({config.lower_limit:.0f} to {config.upper_limit:.0f}°C)."
        else:
            pts = 20.0 * _clip01(1.0 - dist / (0.6 * half_band))
            detail = f"Current reading {current_temp:.1f}°C is {dist:.1f}°C from the nearest limit."
        factors.append(RiskFactor("current", "Current temperature position", pts, 20, detail))

    # 3. Trend toward a limit (direction matters: rising is bad near the upper limit).
    if current_temp is not None:
        toward_upper = current_temp >= config.setpoint
        rate = slope_per_min if toward_upper else -slope_per_min
        pts = 15.0 * _clip01(rate / TREND_FULL_SCALE)
        if pts > 0:
            direction = "rising" if slope_per_min > 0 else "falling"
            detail = f"Temperature is {direction} at {abs(slope_per_min) * 60:.1f}°C/hour (15-min trend)."
            factors.append(RiskFactor("trend", f"Temperature {direction} consistently", pts, 15, detail))

    # 4. Equipment state.
    equip = 0.0
    notes = []
    if not compressor_on:
        equip += 15.0
        notes.append("compressor is stopped")
    if door_open_minutes >= DOOR_OPEN_ALERT_MINUTES:
        equip += 10.0
        notes.append(f"door open for {int(door_open_minutes)} min")
    elif door_open_minutes > 0:
        equip += 3.0
        notes.append("door is currently open")
    if equip:
        factors.append(RiskFactor("equipment", "Equipment / door condition", min(equip, 20.0), 20,
                                  "The " + " and ".join(notes) + "."))

    # 5. Sensor reliability.
    if sensor_suspicious:
        factors.append(RiskFactor("sensor", "Sensor readings suspicious", 10.0, 10,
                                  "Sensor checks failed - readings and forecast may be unreliable."))

    score = int(round(min(100.0, sum(f.points for f in factors))))
    factors.sort(key=lambda f: f.points, reverse=True)
    return RiskResult(score=score, category=risk_category(score), factors=factors, horizon_minutes=horizon_minutes)


def temperature_status(config: ZoneConfig, temp: float | None) -> str:
    """Normal / Warning / Critical based on the current reading alone."""
    if temp is None:
        return "unknown"
    if temp > config.upper_limit or temp < config.lower_limit:
        return "critical"
    warn_margin = 0.2 * config.range_width
    if temp > config.upper_limit - warn_margin or temp < config.lower_limit + warn_margin:
        return "warning"
    return "normal"
