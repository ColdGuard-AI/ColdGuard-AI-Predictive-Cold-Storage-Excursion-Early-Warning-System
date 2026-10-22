"""Shared fixtures: a small model trained once per test session on simulated data."""
from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import Settings  # noqa: E402
from app.database.db import Database  # noqa: E402
from app.models.anomaly import train_isolation_forest  # noqa: E402
from app.models.forecaster import train_and_evaluate  # noqa: E402
from app.models.registry import ModelBundle  # noqa: E402
from app.services.monitor import MonitoringService  # noqa: E402
from app.simulator.history import generate_training_dataset  # noqa: E402

START = datetime(2026, 10, 15, 9, 0)


@pytest.fixture(scope="session")
def training_df():
    return generate_training_dataset(days=5, seed=3)


@pytest.fixture(scope="session")
def models(training_df) -> ModelBundle:
    forecaster = train_and_evaluate(training_df, seed=3, n_estimators=30)
    return ModelBundle(forecaster=forecaster, iforest=train_isolation_forest(training_df, seed=3))


@pytest.fixture()
def test_settings(tmp_path) -> Settings:
    return Settings(
        db_path=tmp_path / "test.db",
        artifacts_dir=tmp_path / "artifacts",
        tick_seconds=0.5,
        autostart_simulator=False,
        seed_history_minutes=90,
        seed=7,
    )


@pytest.fixture()
def monitor(test_settings, models) -> MonitoringService:
    m = MonitoringService(test_settings, models, Database(":memory:"))
    m.initialize(START)
    return m


@pytest.fixture()
def client(test_settings, models):
    from fastapi.testclient import TestClient
    from app.main import create_app
    app = create_app(test_settings, models=models, autostart=False)
    with TestClient(app) as c:
        yield c

