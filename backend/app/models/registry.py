"""Loads trained models from disk, training them on first start if they are missing."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

from app.simulator.history import generate_training_dataset

from .anomaly import train_isolation_forest
from .forecaster import TRAINING_CSV, TemperatureForecaster, train_and_evaluate

log = logging.getLogger("coldguard.models")
IFOREST_FILE = "isolation_forest.joblib"


@dataclass
class ModelBundle:
    forecaster: TemperatureForecaster | None
    iforest: IsolationForest | None
    error: str | None = None


def train_all(artifacts_dir: Path, days: int = 12, seed: int = 42, csv_path: Path | str | None = None) -> ModelBundle:
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    if csv_path:
        csv_file = Path(csv_path)
        log.info("Loading training data from custom CSV: %s...", csv_file)
        df = pd.read_csv(csv_file)
        df.to_csv(artifacts_dir / TRAINING_CSV, index=False)
        training_source = f"Custom CSV ({csv_file.name})"
    else:
        log.info("Generating %d days of simulated training data...", days)
        df = generate_training_dataset(days=days, seed=seed)
        df.to_csv(artifacts_dir / TRAINING_CSV, index=False)
        training_source = f"Simulated {days} days"

    log.info("Training forecaster on %d rows...", len(df))
    forecaster = train_and_evaluate(df, seed=seed)
    forecaster.metrics["training_days_simulated"] = days
    forecaster.metrics["data_source"] = training_source
    forecaster.save(artifacts_dir)
    iforest = train_isolation_forest(df, seed=seed)
    joblib.dump(iforest, artifacts_dir / IFOREST_FILE)
    log.info("Models trained in %.1fs", forecaster.metrics.get("training_seconds", 0))
    return ModelBundle(forecaster=forecaster, iforest=iforest)


def load_or_train(artifacts_dir: Path) -> ModelBundle:
    try:
        forecaster = TemperatureForecaster.load(artifacts_dir)
        iforest = joblib.load(artifacts_dir / IFOREST_FILE)
        log.info("Loaded trained models from %s", artifacts_dir)
        return ModelBundle(forecaster=forecaster, iforest=iforest)
    except FileNotFoundError:
        log.info("No trained models found - training now (first start only).")
    except Exception as exc:  # corrupted or incompatible artifact
        log.warning("Could not load models (%s) - retraining.", exc)
    try:
        return train_all(artifacts_dir)
    except Exception as exc:
        log.exception("Model training failed")
        return ModelBundle(forecaster=None, iforest=None, error=f"Model training failed: {exc}")
