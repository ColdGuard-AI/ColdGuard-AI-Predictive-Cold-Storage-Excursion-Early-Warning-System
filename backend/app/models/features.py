"""Time-series feature engineering shared by training, live inference and What-If projections."""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.simulator.zones import ZoneConfig

# Forecast steps (minutes ahead) produced by the multi-output model.
FORECAST_STEPS: list[int] = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]

FEATURE_COLUMNS: list[str] = [
    "dev_setpoint",  # temperature minus zone setpoint
    "dev_upper",  # temperature minus upper limit
    "ambient_gap",  # ambient minus temperature (drives heat leak)
    "d1",  # 1-minute change
    "d5",  # 5-minute change
    "d15",  # 15-minute change
    "d30",  # 30-minute change
    "std15",  # rolling 15-minute standard deviation
    "humidity",
    "door_open",
    "door_open_minutes",
    "compressor_on",
    "compressor_off_minutes",
    "missing_10",  # missing readings in the last 10 minutes
    "door_heat_flux",  # instantaneous convective thermal flux (ambient_gap * door_open)
    "thermal_ingress_accum",  # cumulative thermal ingress across active door opening
    "compressor_load_pct",  # mechanical cooling capacity load %
    "power_consumption_kw",  # electrical power consumption (kW)
    "cooling_strain",  # compressor load vs positive temperature rise
    "thermal_acceleration",  # second derivative of temperature rate of change
    "hour_sin",  # diurnal solar cycle sine harmonic
    "hour_cos",  # diurnal solar cycle cosine harmonic
]


def _run_length(flag: pd.Series) -> pd.Series:
    """Consecutive count of True values ending at each row (0 where flag is False)."""
    flag = flag.astype(bool)
    groups = (~flag).cumsum()
    return flag.groupby(groups).cumsum().astype(float)


def prepare_readings(df: pd.DataFrame) -> pd.DataFrame:
    """Sort chronologically and fill gaps so downstream features are well defined.

    Missing temperatures are forward-filled (then back-filled for leading gaps); the
    original missingness is preserved in ``temp_missing`` and used as a feature.
    """
    if df.empty:
        return df.copy()
    out = df.sort_values("timestamp").reset_index(drop=True).copy()
    out["temperature"] = pd.to_numeric(out["temperature"], errors="coerce")
    out["temp_missing"] = out["temperature"].isna()
    out["temp_filled"] = out["temperature"].ffill().bfill()
    for col in ("humidity", "ambient_temperature"):
        out[col] = pd.to_numeric(out.get(col, 0.0), errors="coerce").ffill().bfill().fillna(0.0)
    for col in ("compressor_load_pct", "power_consumption_kw"):
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce").ffill().bfill().fillna(0.0)
        else:
            out[col] = 0.0
    return out


def build_features(df: pd.DataFrame, config: ZoneConfig) -> pd.DataFrame:
    """Compute multi-parameter model features for every row of a prepared reading frame."""
    p = df if "temp_filled" in df.columns else prepare_readings(df)
    t = p["temp_filled"].astype(float)
    door = p["door_status"].eq("open") if "door_status" in p.columns else pd.Series(False, index=p.index)
    comp_off = p["compressor_status"].eq("stopped") if "compressor_status" in p.columns else pd.Series(False, index=p.index)
    ambient_gap = p["ambient_temperature"].astype(float) - t
    door_float = door.astype(float)

    # Multi-parameter thermal physics:
    # 1. Instantaneous convective door heat flux
    door_heat_flux = ambient_gap * door_float

    # 2. Cumulative thermal ingress across continuous open door event
    door_groups = (~door).cumsum()
    thermal_ingress_accum = door_heat_flux.groupby(door_groups).cumsum().fillna(0.0)

    # 3. Compressor load & power metrics
    comp_load = pd.to_numeric(p.get("compressor_load_pct", 0.0), errors="coerce").fillna(0.0).astype(float)
    power_kw = pd.to_numeric(p.get("power_consumption_kw", 0.0), errors="coerce").fillna(0.0).astype(float)

    # 4. Cooling Strain: compressor straining under positive thermal drift
    d5 = (t - t.shift(5)).fillna(0.0)
    cooling_strain = (comp_load / 100.0) * np.maximum(0.0, d5)

    # 5. Thermal Acceleration (2nd derivative of temperature)
    d15 = (t - t.shift(15)).fillna(0.0)
    thermal_acceleration = (d5 / 5.0) - (d15 / 15.0)

    # 6. Diurnal solar cycle time harmonic
    ts = pd.to_datetime(p["timestamp"], errors="coerce")
    if ts.isna().all():
        hour_sin = pd.Series(0.0, index=p.index)
        hour_cos = pd.Series(1.0, index=p.index)
    else:
        hours = ts.dt.hour.fillna(12.0)
        hour_sin = np.sin(2 * np.pi * hours / 24.0)
        hour_cos = np.cos(2 * np.pi * hours / 24.0)

    cols = {
        "dev_setpoint": t - config.setpoint,
        "dev_upper": t - config.upper_limit,
        "ambient_gap": ambient_gap,
        "d1": (t - t.shift(1)).fillna(0.0),
        "d5": d5,
        "d15": d15,
        "d30": (t - t.shift(30)).fillna(0.0),
        "std15": t.rolling(15, min_periods=2).std().fillna(0.0),
        "humidity": p["humidity"].astype(float),
        "door_open": door_float,
        "door_open_minutes": _run_length(door),
        "compressor_on": (~comp_off).astype(float),
        "compressor_off_minutes": _run_length(comp_off),
        "missing_10": p["temp_missing"].astype(float).rolling(10, min_periods=1).sum() if "temp_missing" in p.columns else 0.0,
        "door_heat_flux": door_heat_flux,
        "thermal_ingress_accum": thermal_ingress_accum,
        "compressor_load_pct": comp_load,
        "power_consumption_kw": power_kw,
        "cooling_strain": cooling_strain,
        "thermal_acceleration": thermal_acceleration,
        "hour_sin": hour_sin,
        "hour_cos": hour_cos,
    }
    feats = pd.DataFrame(cols, index=p.index)
    return feats[FEATURE_COLUMNS].replace([np.inf, -np.inf], 0.0).fillna(0.0)


def build_targets(df: pd.DataFrame, column: str = "true_temperature") -> pd.DataFrame:
    """Future temperature change at each forecast step, relative to the latest usable reading.

    The future value is the simulator's ground-truth temperature, so the model learns to
    forecast the physical temperature rather than sensor noise or injected spikes.
    NaN where the future is unknown (end of series).
    """
    future = df[column].astype(float)
    now = df["temp_filled"].astype(float)
    return pd.DataFrame({f"h{h}": future.shift(-h) - now for h in FORECAST_STEPS}, index=df.index)
