"""Turns recent readings into an ML temperature forecast."""
from __future__ import annotations

from datetime import timedelta
from typing import Any

import numpy as np
import pandas as pd

from app.models.features import FORECAST_STEPS, build_features, prepare_readings
from app.models.forecaster import WARNING_QUANTILE, TemperatureForecaster
from app.simulator.zones import ZoneConfig

# Lags/rolling windows need ~30 minutes of history for fully informed features.
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
) -> dict[str, Any]:
    """Forecast the next 60 minutes from the latest readings of one zone."""
    if forecaster is None:
        return {"available": False, "reason": "Forecasting model is not available (training failed or not loaded).", "points": []}
    if len(history) < MIN_HISTORY_FOR_FORECAST:
        return {"available": False, "reason": f"Need at least {MIN_HISTORY_FOR_FORECAST} readings to forecast; have {len(history)}.", "points": []}
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
    for j, h in enumerate(FORECAST_STEPS):
        point = {"timestamp": t0 + timedelta(minutes=h), "minutes_ahead": h, "temperature": round(base + float(mean[j]), 2)}
        if with_band:
            point["lower"] = round(base + float(p10[j]), 2)
            point["upper"] = round(base + float(p90[j]), 2)
        points.append(point)

    temps = [p["temperature"] for p in points]
    breach_minutes, breach_side = first_crossing(base, temps, FORECAST_STEPS, config.lower_limit, config.upper_limit)
    # Conservative early-warning estimate: upper quartile of tree forecasts for upper-limit risk.
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
