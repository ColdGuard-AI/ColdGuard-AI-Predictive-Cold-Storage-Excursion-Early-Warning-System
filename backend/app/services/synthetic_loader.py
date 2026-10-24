"""Synthetic CSV Dataset Loader for ColdGuard AI What-If Simulator.

Loads and parses telemetry readings from calibrated synthetic CSV files:
- backend/data/synthetic/synthetic_sensor_readings_full.csv (Full 14-day 60k-reading series)
- backend/data/synthetic/train_dataset.csv (Train split)
- backend/data/synthetic/val_dataset.csv (Validation split)
- backend/data/synthetic/test_dataset.csv (Test split)

Provides fast indexed lookup by zone, scenario slices, and automatic schema conversion
to match ColdGuard's analytical pipeline and feature engineering.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Optional

import pandas as pd

log = logging.getLogger("coldguard.synthetic_loader")

SYNTHETIC_DIR = Path(__file__).resolve().parents[2] / "data" / "synthetic"

DATASET_FILES = {
    "full": "synthetic_sensor_readings_full.csv",
    "synthetic_full": "synthetic_sensor_readings_full.csv",
    "train": "train_dataset.csv",
    "synthetic_train": "train_dataset.csv",
    "val": "val_dataset.csv",
    "synthetic_val": "val_dataset.csv",
    "test": "test_dataset.csv",
    "synthetic_test": "test_dataset.csv",
}

# Cache DataFrames in memory to avoid repetitive disk I/O on large CSVs
_DATAFRAME_CACHE: dict[str, pd.DataFrame] = {}


def get_synthetic_dir() -> Path:
    return SYNTHETIC_DIR


def list_available_synthetic_datasets() -> list[dict[str, Any]]:
    """Return available synthetic CSV files with metadata."""
    datasets = []
    meta_path = SYNTHETIC_DIR / "dataset_metadata.json"
    metadata = {}
    if meta_path.exists():
        try:
            metadata = json.loads(meta_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    for key, filename in [
        ("synthetic_full", "synthetic_sensor_readings_full.csv"),
        ("synthetic_train", "train_dataset.csv"),
        ("synthetic_val", "val_dataset.csv"),
        ("synthetic_test", "test_dataset.csv"),
    ]:
        fpath = SYNTHETIC_DIR / filename
        if fpath.exists():
            size_mb = round(fpath.stat().st_size / (1024 * 1024), 2)
            label = {
                "synthetic_full": "Full Synthetic Dataset (14-Day Simulation)",
                "synthetic_train": "Train Partition (70% Calibrated Split)",
                "synthetic_val": "Validation Partition (15% Split)",
                "synthetic_test": "Test Partition (15% Out-of-Sample Split)",
            }.get(key, filename)
            datasets.append({
                "id": key,
                "filename": filename,
                "label": label,
                "size_mb": size_mb,
                "available": True,
            })
    return datasets


def load_synthetic_readings(
    zone_id: str,
    dataset_type: str = "full",
    limit: int = 120,
    scenario_filter: Optional[str] = None,
) -> pd.DataFrame:
    """Load historical sensor readings for a zone directly from a synthetic CSV dataset.

    Returns a DataFrame conforming to ColdGuard's analytical pipeline schema.
    """
    normalized_key = dataset_type.lower().replace("-", "_")
    filename = DATASET_FILES.get(normalized_key, DATASET_FILES["full"])
    file_path = SYNTHETIC_DIR / filename

    if not file_path.exists():
        log.warning("Synthetic file %s not found in %s", filename, SYNTHETIC_DIR)
        return pd.DataFrame()

    # Read from cache or load from disk
    cache_key = f"{filename}_{zone_id}"
    if filename not in _DATAFRAME_CACHE:
        try:
            df_full = pd.read_csv(file_path)
            if "timestamp" in df_full.columns:
                df_full["timestamp"] = pd.to_datetime(df_full["timestamp"])
            _DATAFRAME_CACHE[filename] = df_full
        except Exception as exc:
            log.error("Failed to load synthetic CSV %s: %s", file_path, exc)
            return pd.DataFrame()

    df = _DATAFRAME_CACHE[filename]
    zone_df = df[df["zone_id"] == zone_id].copy()
    if zone_df.empty:
        return pd.DataFrame()

    if scenario_filter and "scenario" in zone_df.columns:
        scen_match = zone_df[zone_df["scenario"] == scenario_filter]
        if not scen_match.empty:
            zone_df = scen_match

    # Ensure required columns for ColdGuard pipeline
    if "door_open_duration_seconds" not in zone_df.columns:
        zone_df["door_open_duration_seconds"] = (
            zone_df["door_status"].apply(lambda s: 60 if str(s).lower() == "open" else 0)
        )
    if "time_since_closure_seconds" not in zone_df.columns:
        zone_df["time_since_closure_seconds"] = (
            zone_df["door_status"].apply(lambda s: 0 if str(s).lower() == "open" else 180)
        )
    if "is_synthetic" not in zone_df.columns:
        zone_df["is_synthetic"] = 1

    # Take the tail limit rows (oldest first)
    tail_df = zone_df.tail(limit).reset_index(drop=True)
    return tail_df
