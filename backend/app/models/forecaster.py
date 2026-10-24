"""Random Forest temperature forecaster with honest, chronological evaluation.

One multi-output RandomForestRegressor predicts the temperature change at
5, 10, ..., 60 minutes ahead. Evaluation uses a chronological split per zone (with a
60-minute embargo so no training target overlaps the test period) and compares against:

* persistence baseline  - "the temperature stays where it is"
* linear-trend baseline - "the last 15-minute trend continues"

All data is simulated; metrics describe performance on simulated data only.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

from app.simulator.zones import ZONES, ZoneConfig

from .features import FEATURE_COLUMNS, FORECAST_STEPS, build_features, build_targets, prepare_readings

MODEL_FILE = "forecaster.joblib"
METRICS_FILE = "model_metrics.json"
TRAINING_CSV = "training_readings.csv"
TEST_FRACTION = 0.2
EMBARGO_MINUTES = max(FORECAST_STEPS)
MIN_TRAINING_ROWS = 500
# Early warnings fire when the 75th percentile of tree forecasts crosses a limit. Averaging
# trees pulls forecasts toward "nothing happens", so the mean alone misses many excursions;
# the upper quartile trades some precision for much better recall (see model metrics).
WARNING_QUANTILE = 75


class InsufficientDataError(RuntimeError):
    pass


@dataclass
class TemperatureForecaster:
    model: RandomForestRegressor
    metrics: dict[str, Any] = field(default_factory=dict)
    steps: list[int] = field(default_factory=lambda: list(FORECAST_STEPS))

    def predict_deltas(self, X: pd.DataFrame) -> np.ndarray:
        """Mean predicted temperature change, shape (n_rows, n_steps)."""
        pred = self.model.predict(X[FEATURE_COLUMNS])
        return np.atleast_2d(pred)

    def predict_quantiles(self, X: pd.DataFrame, quantiles: tuple[float, ...] = (10, 75, 90)) -> tuple[np.ndarray, dict[float, np.ndarray]]:
        """Mean prediction plus percentiles across the individual trees.

        The tree spread reflects disagreement between trees - a rough uncertainty indicator,
        not a calibrated prediction interval. The 75th percentile drives the conservative
        early-warning rule (see ``WARNING_QUANTILE``).
        """
        values = np.ascontiguousarray(X[FEATURE_COLUMNS].to_numpy(dtype=np.float32))
        # Call the low-level tree predictor directly: same result as tree.predict(), without
        # sklearn's per-call input validation (which dominates runtime for one-row inputs).
        per_tree = np.stack([tree.tree_.predict(values)[:, :, 0] for tree in self.model.estimators_])  # (trees, rows, steps)
        return per_tree.mean(axis=0), {q: np.percentile(per_tree, q, axis=0) for q in quantiles}

    def save(self, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": self.model, "steps": self.steps, "features": FEATURE_COLUMNS}, directory / MODEL_FILE)
        (directory / METRICS_FILE).write_text(json.dumps(self.metrics, indent=2), encoding="utf-8")

    @classmethod
    def load(cls, directory: Path) -> "TemperatureForecaster":
        bundle = joblib.load(directory / MODEL_FILE)
        if bundle.get("features") != FEATURE_COLUMNS or bundle.get("steps") != FORECAST_STEPS:
            raise ValueError("Saved model was trained with a different feature set; retrain required.")
        metrics_path = directory / METRICS_FILE
        metrics = json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.exists() else {}
        bundle["model"].n_jobs = 1  # single-row inference: thread start-up costs more than it saves
        return cls(model=bundle["model"], metrics=metrics, steps=bundle["steps"])


def _zone_frames(df: pd.DataFrame) -> list[tuple[ZoneConfig, pd.DataFrame, pd.DataFrame, pd.DataFrame]]:
    out = []
    frame = df.copy()
    if "zone_id" not in frame.columns:
        frame["zone_id"] = "zone-a"
    for zone_id, group in frame.groupby("zone_id"):
        config = ZONES.get(str(zone_id), list(ZONES.values())[0])
        prepared = prepare_readings(group)
        out.append((config, prepared, build_features(prepared, config), build_targets(prepared)))
    return out


def _excursion_scores(actual_breach: np.ndarray, predicted_breach: np.ndarray) -> dict[str, Any]:
    tp = int(np.sum(actual_breach & predicted_breach))
    fp = int(np.sum(~actual_breach & predicted_breach))
    fn = int(np.sum(actual_breach & ~predicted_breach))
    tn = int(np.sum(~actual_breach & ~predicted_breach))
    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * precision * recall / (precision + recall) if precision and recall else None
    return {"true_positives": tp, "false_positives": fp, "false_negatives": fn, "true_negatives": tn,
            "precision": precision, "recall": recall, "f1": f1}


def train_and_evaluate(df: pd.DataFrame, seed: int = 42, n_estimators: int = 100) -> TemperatureForecaster:
    """Chronological train/test split per zone, fit, evaluate against baselines, refit on all data."""
    started = time.perf_counter()
    train_X, train_y, test_parts = [], [], []
    for config, prepared, feats, targets in _zone_frames(df):
        valid = targets.notna().all(axis=1)
        n = len(prepared)
        split = int(n * (1 - TEST_FRACTION))
        idx = np.arange(n)
        train_mask = valid & (idx < split - EMBARGO_MINUTES)
        test_mask = valid & (idx >= split)
        train_X.append(feats[train_mask])
        train_y.append(targets[train_mask])
        test_parts.append((config, prepared[test_mask], feats[test_mask], targets[test_mask]))

    X_train = pd.concat(train_X)
    y_train = pd.concat(train_y)
    if len(X_train) < MIN_TRAINING_ROWS:
        raise InsufficientDataError(
            f"Only {len(X_train)} training rows available; at least {MIN_TRAINING_ROWS} are required."
        )

    # Every 2nd minute is enough for neighbouring, highly-correlated samples.
    X_fit, y_fit = X_train.iloc[::2], y_train.iloc[::2]
    model = RandomForestRegressor(
        n_estimators=n_estimators, max_depth=16, min_samples_leaf=3, max_features=0.65, n_jobs=-1, random_state=seed
    )
    model.fit(X_fit, y_fit)

    # ---- evaluation on the held-out (later) period
    per_step = {h: {"model": [], "persistence": [], "trend": [], "actual": []} for h in FORECAST_STEPS}
    exc_actual, exc_model, exc_rule, exc_trend = [], [], [], []
    for config, prepared, feats, targets in test_parts:
        if feats.empty:
            continue
        pred = model.predict(feats)
        values = np.ascontiguousarray(feats.to_numpy(dtype=np.float32))
        per_tree = np.stack([tree.tree_.predict(values)[:, :, 0] for tree in model.estimators_])
        pred_q = np.percentile(per_tree, WARNING_QUANTILE, axis=0)
        trend_rate = feats["d15"].to_numpy() / 15.0
        now = prepared["temp_filled"].to_numpy()
        for j, h in enumerate(FORECAST_STEPS):
            actual = targets[f"h{h}"].to_numpy()
            per_step[h]["actual"].append(actual)
            per_step[h]["model"].append(pred[:, j])
            per_step[h]["persistence"].append(np.zeros_like(actual))
            per_step[h]["trend"].append(trend_rate * h)
        # Early-warning task: will the temperature exceed the upper limit within 30 minutes?
        in_range = (now <= config.upper_limit) & (now >= config.lower_limit)
        cols = [j for j, h in enumerate(FORECAST_STEPS) if h <= 30]
        actual_abs = now[:, None] + targets[[f"h{FORECAST_STEPS[j]}" for j in cols]].to_numpy()
        model_abs = now[:, None] + pred[:, cols]
        rule_abs = now[:, None] + pred_q[:, cols]
        trend_abs = now[:, None] + trend_rate[:, None] * np.array([FORECAST_STEPS[j] for j in cols])[None, :]
        exc_actual.append((actual_abs > config.upper_limit).any(axis=1)[in_range])
        exc_model.append((model_abs > config.upper_limit).any(axis=1)[in_range])
        exc_rule.append((rule_abs > config.upper_limit).any(axis=1)[in_range])
        exc_trend.append((trend_abs > config.upper_limit).any(axis=1)[in_range])

    horizon_metrics = []
    for h in FORECAST_STEPS:
        actual = np.concatenate(per_step[h]["actual"])
        row = {"horizon_minutes": h}
        for name in ("model", "persistence", "trend"):
            row[f"mae_{name}"] = round(float(mean_absolute_error(actual, np.concatenate(per_step[h][name]))), 4)
        horizon_metrics.append(row)

    actual_b = np.concatenate(exc_actual)
    metrics: dict[str, Any] = {
        "model_type": "RandomForestRegressor (multi-output)",
        "target": "Temperature change at 5-60 min ahead (°C)",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "data_source": "SIMULATED sensor data (synthetic cold-room simulator)",
        "n_train_samples": int(len(X_fit)),
        "n_test_samples": int(sum(len(p[2]) for p in test_parts)),
        "split": f"Chronological per zone: first {int((1 - TEST_FRACTION) * 100)}% train, last {int(TEST_FRACTION * 100)}% test, {EMBARGO_MINUTES}-min embargo",
        "n_estimators": n_estimators,
        "features": FEATURE_COLUMNS,
        "horizons": horizon_metrics,
        "excursion_warning_30min": {
            "description": "Held-out minutes where temperature was in range: does the forecast correctly flag an upper-limit breach within 30 min?",
            "positives_in_test": int(actual_b.sum()),
            "negatives_in_test": int((~actual_b).sum()),
            "model_warning_rule": _excursion_scores(actual_b, np.concatenate(exc_rule)),
            "warning_rule": f"Warn when the {WARNING_QUANTILE}th percentile of tree forecasts crosses the limit (used for live alerts)",
            "model_mean": _excursion_scores(actual_b, np.concatenate(exc_model)),
            "trend_baseline": _excursion_scores(actual_b, np.concatenate(exc_trend)),
        },
        "feature_importance": sorted(
            [{"feature": f, "importance": round(float(i), 4)} for f, i in zip(FEATURE_COLUMNS, model.feature_importances_)],
            key=lambda d: d["importance"],
            reverse=True,
        ),
        "limitations": [
            "Trained and evaluated only on simulated data; real-world accuracy is unknown.",
            "Simulator physics are simplified (single thermal mass, proportional thermostat).",
            "Forecast assumes current conditions persist; it cannot anticipate future events such as a door being opened later.",
            "The tree-spread band is an uncertainty indicator, not a calibrated confidence interval.",
            "Not validated for medical, pharmaceutical or food-safety compliance decisions.",
        ],
    }

    # Refit on all available history (train + test) for live use; reported metrics stay
    # those of the held-out evaluation above.
    X_all = pd.concat([X_train] + [p[2] for p in test_parts]).iloc[::2]
    y_all = pd.concat([y_train] + [p[3] for p in test_parts]).iloc[::2]
    final = RandomForestRegressor(
        n_estimators=n_estimators, max_depth=16, min_samples_leaf=3, max_features=0.65, n_jobs=-1, random_state=seed
    )
    final.fit(X_all, y_all)
    final.n_jobs = 1
    metrics["training_seconds"] = round(time.perf_counter() - started, 2)
    return TemperatureForecaster(model=final, metrics=metrics)
