"""Turns recent readings and thermal dynamics into multi-horizon ML temperature forecasts."""
from __future__ import annotations

import math
from datetime import timedelta
from typing import Any

import numpy as np
import pandas as pd

from app.models.features import FORECAST_STEPS, build_features, prepare_readings
from app.models.forecaster import WARNING_QUANTILE, TemperatureForecaster
from app.simulator.zones import ZoneConfig

MIN_HISTORY_FOR_FORECAST = 5
FULL_HISTORY_MINUTES = 31


def first_crossing(
    start_temp: float, temps: list[float], steps: list[int], lower: float, upper: float
) -> tuple[float | None, str | None]:
    """Minutes until the trajectory first leaves [lower, upper], linearly interpolated."""
    prev_t, prev_h = start_temp, 0
    for t, h in zip(temps, steps):
        for limit, side in ((upper, "upper"), (lower, "lower")):
            crossed = t > limit if side == "upper" else t < limit
            if crossed:
                prev_inside = prev_t <= limit if side == "upper" else prev_t >= limit
                if not prev_inside:
                    return float(prev_h), side
                frac = (limit - prev_t) / (t - prev_t) if t != prev_t else 1.0
                return round(prev_h + frac * (h - prev_h), 1), side
        prev_t, prev_h = t, h
    return None, None


def forecast_from_history(
    history: pd.DataFrame,
    config: ZoneConfig,
    forecaster: TemperatureForecaster | None,
    with_band: bool = True,
    prepared: pd.DataFrame | None = None,
    features: pd.DataFrame | None = None,
    horizon: int = 60,
    residual_rise: float = 0.0,
    peak_temp_predicted: float | None = None,
    recovery_phase: str = "none",
) -> dict[str, Any]:
    """Forecast up to horizon minutes (30, 60, 360, 1440) combining ML predictions
    and physical post-closure thermal inertia."""
    if forecaster is None:
        return {"available": False, "reason": "Forecasting model is not available.", "points": []}
    if len(history) < MIN_HISTORY_FOR_FORECAST:
        return {"available": False, "reason": f"Need at least {MIN_HISTORY_FOR_FORECAST} readings; have {len(history)}.", "points": []}
    prepared = prepare_readings(history) if prepared is None else prepared
    if prepared["temp_filled"].isna().all():
        return {"available": False, "reason": "No valid temperature values in recent readings.", "points": []}

    feats = (build_features(prepared, config) if features is None else features).tail(1)
    last = feats.iloc[-1]
    mean, qs = forecaster.predict_quantiles(feats, (10, WARNING_QUANTILE, 90))
    mean, p10, pw, p90 = mean[0], qs[10][0], qs[WARNING_QUANTILE][0], qs[90][0]

    base = float(prepared["temp_filled"].iloc[-1])
    t0 = pd.Timestamp(prepared["timestamp"].iloc[-1]).to_pydatetime()
    points = []

    # ML forecaster steps with thermal residual wave correction
    ml_steps = [h for h in FORECAST_STEPS if h <= horizon] if horizon < 60 else FORECAST_STEPS
    for j, h in enumerate(FORECAST_STEPS):
        if h in ml_steps:
            pred_delta = float(mean[j])
            # If door recently closed and residual trapped heat is diffusing:
            if residual_rise > 0 and recovery_phase in ("residual_rise", "active_recovery"):
                # Wave peaking around minute 5-7
                wave = residual_rise * (h / 6.0) * math.exp(1.0 - h / 6.0) if h <= 25 else 0.0
                pred_delta = max(pred_delta, wave)

            t_val = round(base + pred_delta, 2)
            point = {"timestamp": t0 + timedelta(minutes=h), "minutes_ahead": h, "temperature": t_val}
            if with_band:
                spread = abs(float(p90[j]) - float(p10[j])) / 2.0
                point["lower"] = round(t_val - max(0.2, spread), 2)
                point["upper"] = round(t_val + max(0.2, spread), 2)
            points.append(point)

    # Physics-informed thermal continuation for extended horizons (6 hours / 24 hours)
    if horizon > 60 and points:
        ambient = float(prepared["ambient_temperature"].iloc[-1]) if "ambient_temperature" in prepared else config.ambient_base
        door_open = bool(last["door_open"])
        compressor_on = bool(last["compressor_on"])
        is_degraded = False
        if "compressor_status" in prepared.columns:
            is_degraded = (prepared["compressor_status"].iloc[-1] == "degraded")

        last_spread = (points[-1].get("upper", points[-1]["temperature"]) - points[-1].get("lower", points[-1]["temperature"])) if with_band else 0.4

        if horizon <= 360:
            extra_steps = [75, 90, 105, 120, 150, 180, 210, 240, 270, 300, 330, 360]
        else:
            extra_steps = [75, 90, 120, 180, 240, 300, 360, 480, 600, 720, 840, 960, 1080, 1200, 1320, 1440]

        extra_steps = [s for s in extra_steps if s <= horizon]
        if extra_steps and extra_steps[-1] != horizon:
            extra_steps.append(horizon)

        step_set = set(extra_steps)
        curr_t = points[-1]["temperature"]
        for m in range(61, horizon + 1):
            hour = (t0.hour + (t0.minute + m) / 60.0) % 24.0
            amb_val = ambient + 1.2 * math.sin(2 * math.pi * (hour - 9.0) / 24.0)
            leak = config.k_leak * (amb_val - curr_t)
            door_leak = (config.k_door * (amb_val - curr_t)) if door_open else 0.0
            if not compressor_on:
                cooling = 0.0
            elif is_degraded:
                cooling = config.cooling_max * 0.48
            else:
                cooling = min(config.cooling_max, config.kp * max(0.0, curr_t - config.setpoint))
            curr_t += leak + door_leak - cooling
            if m in step_set:
                spread = last_spread + 0.035 * math.sqrt(m - 60)
                pt = {
                    "timestamp": t0 + timedelta(minutes=m),
                    "minutes_ahead": m,
                    "temperature": round(curr_t, 2),
                }
                if with_band:
                    pt["lower"] = round(curr_t - spread / 2, 2)
                    pt["upper"] = round(curr_t + spread / 2, 2)
                points.append(pt)

    all_steps = [p["minutes_ahead"] for p in points]
    temps = [p["temperature"] for p in points]
    breach_minutes, breach_side = first_crossing(base, temps, all_steps, config.lower_limit, config.upper_limit)

    warn_temps = [base + float(d) for d in pw]
    warn_minutes, warn_side = first_crossing(base, warn_temps, FORECAST_STEPS, config.lower_limit, config.upper_limit)
    if breach_minutes is not None and (warn_minutes is None or breach_minutes < warn_minutes):
        warn_minutes, warn_side = breach_minutes, breach_side

    limited = len(prepared) < FULL_HISTORY_MINUTES
    return {
        "available": True,
        "issued_at": t0,
        "base_temperature": round(base, 2),
        "points": points,
        "time_to_breach_minutes": breach_minutes,
        "breach_side": breach_side,
        "warning_time_to_breach_minutes": warn_minutes,
        "warning_breach_side": warn_side,
        "warning_rule": f"{WARNING_QUANTILE}th percentile of tree forecasts",
        "slope_per_min": float(last["d15"]) / 15.0,
        "door_open_minutes": float(last["door_open_minutes"]),
        "compressor_off_minutes": float(last["compressor_off_minutes"]),
        "residual_rise_predicted": residual_rise,
        "peak_temp_predicted": peak_temp_predicted or round(max(temps) if temps else base, 2),
        "limited_history": limited,
        "note": "Limited history: lag features are incomplete, forecast is less reliable." if limited else None,
    }


def batch_forecast_deltas(
    frame: pd.DataFrame, config: ZoneConfig, forecaster: TemperatureForecaster
) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Features, mean deltas and warning-rule deltas for every row of a frame (used by What-If)."""
    prepared = prepare_readings(frame)
    feats = build_features(prepared, config)
    mean, qs = forecaster.predict_quantiles(feats, (WARNING_QUANTILE,))
    extra = {f"_f_{c}": feats[c] for c in ("d15", "door_open_minutes", "compressor_on")}
    return prepared.assign(**extra), mean, qs[WARNING_QUANTILE]

