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
        out[col] = pd.to_numeric(out[col], errors="coerce").ffill().bfill()
    return out


def build_features(df: pd.DataFrame, config: ZoneConfig) -> pd.DataFrame:
    """Compute model features for every row of a prepared (1-minute) reading frame."""
    p = df if "temp_filled" in df.columns else prepare_readings(df)
    t = p["temp_filled"].astype(float)
    door = p["door_status"].eq("open")
    comp_off = p["compressor_status"].eq("stopped")
    cols = {
        "dev_setpoint": t - config.setpoint,
        "dev_upper": t - config.upper_limit,
        "ambient_gap": p["ambient_temperature"].astype(float) - t,
        **{f"d{lag}": (t - t.shift(lag)).fillna(0.0) for lag in (1, 5, 15, 30)},
        "std15": t.rolling(15, min_periods=2).std().fillna(0.0),
        "humidity": p["humidity"].astype(float),
        "door_open": door.astype(float),
        "door_open_minutes": _run_length(door),
        "compressor_on": (~comp_off).astype(float),
        "compressor_off_minutes": _run_length(comp_off),
        "missing_10": p["temp_missing"].astype(float).rolling(10, min_periods=1).sum(),
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
