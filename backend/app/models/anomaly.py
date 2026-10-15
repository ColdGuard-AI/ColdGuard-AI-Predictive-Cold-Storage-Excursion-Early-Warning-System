"""Sensor-health checks: transparent rules first, Isolation Forest as a secondary signal.

Rules (primary, easy to explain):
* missing data   - readings without a temperature value in the last 10 minutes
* stuck sensor   - identical temperature values for 15+ consecutive minutes
* spike          - a reading far from the recent median, faster than the room can physically change

Isolation Forest (secondary): trained on simulated readings without sensor faults, using
the size of the 1-minute change, deviation from the rolling median and local volatility.
It only marks the sensor suspicious when it flags several recent readings, which keeps
false alarms low.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

MISSING_WINDOW = 10
MISSING_THRESHOLD = 2
STUCK_WINDOW = 15
SPIKE_WINDOW = 10
SPIKE_THRESHOLD_C = 2.5  # °C away from the recent median within one minute
IF_WINDOW = 10
IF_MIN_FLAGS = 3

IF_FEATURES = ["abs_d1", "abs_dev_median", "std_d1"]


def isolation_features(df: pd.DataFrame) -> pd.DataFrame:
    t = pd.to_numeric(df["temperature"], errors="coerce").ffill().bfill()
    d1 = t.diff().fillna(0.0)
    median = t.rolling(SPIKE_WINDOW, min_periods=1).median()
    return pd.DataFrame(
        {
            "abs_d1": d1.abs(),
            "abs_dev_median": (t - median).abs(),
            "std_d1": d1.rolling(SPIKE_WINDOW, min_periods=2).std().fillna(0.0),
        },
        index=df.index,
    )


def train_isolation_forest(df: pd.DataFrame, seed: int = 42) -> IsolationForest:
    frames = []
    for _, group in df.groupby("zone_id"):
        group = group.sort_values("timestamp")
        clean = group["scenario"] != "sensor_anomaly"
        frames.append(isolation_features(group)[clean.to_numpy()])
    X = pd.concat(frames)
    model = IsolationForest(n_estimators=100, contamination=0.003, random_state=seed)
    model.fit(X[IF_FEATURES])
    return model


@dataclass
class SensorCheck:
    status: str  # "normal" | "suspicious" | "no_data"
    issues: list[dict[str, Any]] = field(default_factory=list)
    missing_last_10: int = 0
    stuck_minutes: int = 0
    spike_detected: bool = False
    isolation_forest_flags: int = 0
    isolation_forest_available: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "issues": self.issues,
            "missing_last_10": self.missing_last_10,
            "stuck_minutes": self.stuck_minutes,
            "spike_detected": self.spike_detected,
            "isolation_forest_flags": self.isolation_forest_flags,
            "isolation_forest_window": IF_WINDOW,
            "isolation_forest_available": self.isolation_forest_available,
        }


def _stuck_run(values: pd.Series) -> int:
    vals = values.dropna().to_numpy()
    if len(vals) == 0:
        return 0
    run = 1
    for i in range(len(vals) - 1, 0, -1):
        if vals[i] == vals[i - 1]:
            run += 1
        else:
            break
    return run


def isolation_flags(histories: list[pd.DataFrame], iforest: IsolationForest) -> list[np.ndarray]:
    """Isolation Forest flags for the last IF_WINDOW readings of several zones in one call
    (the model's per-call overhead dominates, so batching zones is much faster)."""
    blocks = [isolation_features(h.tail(IF_WINDOW + SPIKE_WINDOW).reset_index(drop=True)).tail(IF_WINDOW) for h in histories]
    sizes = [len(b) for b in blocks]
    if sum(sizes) == 0:
        return [np.zeros(0, dtype=bool) for _ in histories]
    flags = iforest.predict(pd.concat(blocks)[IF_FEATURES]) == -1
    return list(np.split(flags, np.cumsum(sizes)[:-1]))


def check_sensor(
    df: pd.DataFrame, iforest: IsolationForest | None = None, if_flags: np.ndarray | None = None
) -> SensorCheck:
    """Assess sensor health on the most recent readings of one zone (sorted by time).

    Pass either the trained ``iforest`` or precomputed ``if_flags`` (see :func:`isolation_flags`).
    """
    if df.empty:
        return SensorCheck(status="no_data", issues=[{"type": "missing_data", "detail": "No readings received."}])
    recent = df.tail(max(STUCK_WINDOW, SPIKE_WINDOW + 1, IF_WINDOW) + 5).reset_index(drop=True)
    temps = pd.to_numeric(recent["temperature"], errors="coerce")
    check = SensorCheck(status="normal")

    check.missing_last_10 = int(temps.tail(MISSING_WINDOW).isna().sum())
    if check.missing_last_10 >= MISSING_THRESHOLD:
        check.issues.append({
            "type": "missing_data",
            "detail": f"{check.missing_last_10} of the last {MISSING_WINDOW} readings have no temperature value.",
        })

    check.stuck_minutes = _stuck_run(temps.tail(60))
    if check.stuck_minutes >= STUCK_WINDOW:
        check.issues.append({
            "type": "stuck_sensor",
            "detail": f"Temperature reported as exactly {temps.dropna().iloc[-1]:.2f}°C for {check.stuck_minutes} consecutive readings.",
        })

    filled = temps.ffill()
    window = filled.tail(SPIKE_WINDOW + 1)
    if window.notna().sum() >= 4:
        # Compare each of the last 3 readings with the median of the readings before it.
        for k in range(1, 4):
            if len(window) <= k:
                break
            value = temps.iloc[-k]
            prior = window.iloc[: len(window) - k]
            if pd.notna(value) and prior.notna().sum() >= 3:
                if abs(value - prior.median()) > SPIKE_THRESHOLD_C:
                    check.spike_detected = True
                    check.issues.append({
                        "type": "spike",
                        "detail": f"Reading of {value:.2f}°C deviates {abs(value - prior.median()):.1f}°C from the recent median - faster than the room can physically change.",
                    })
                    break

    if (iforest is not None or if_flags is not None) and temps.notna().sum() >= 3:
        check.isolation_forest_available = True
        flags = if_flags if if_flags is not None else isolation_flags([df], iforest)[0]
        check.isolation_forest_flags = int(np.sum(flags))
        if check.isolation_forest_flags >= IF_MIN_FLAGS:
            check.issues.append({
                "type": "isolation_forest",
                "detail": f"Isolation Forest marked {check.isolation_forest_flags} of the last {IF_WINDOW} readings as unusual.",
            })

    if check.issues:
        check.status = "suspicious"
    return check
