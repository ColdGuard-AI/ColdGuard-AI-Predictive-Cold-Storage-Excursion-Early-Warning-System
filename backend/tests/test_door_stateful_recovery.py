"""Automated tests for stateful door tracking, post-closure residual thermal inertia,
exponential cooling recovery, cumulative exposure, and model evaluation metrics.
"""
from datetime import datetime, timezone
import pytest

from app.simulator.engine import ZoneSimulator
from app.simulator.zones import ZONES
from app.services.risk import compute_risk


@pytest.fixture
def test_sim():
    return ZoneSimulator(
        config=ZONES["zone-b"],
        seed=42,
        start_time=datetime(2026, 10, 22, 12, 0, 0, tzinfo=timezone.utc),
        routine_door_openings=False,
    )


def test_door_opening_and_closure_lifecycle(test_sim):
    """Test door opening, stepping, and closing with residual heat computation."""
    # 1. Door is initially closed and nominal
    assert not test_sim.state.door_open
    initial_temp = test_sim.state.temperature

    # 2. Open door for 5 minutes
    test_sim.open_door(duration_minutes=5)
    assert test_sim.state.door_open
    assert test_sim.state.temp_at_open is not None

    for _ in range(5):
        test_sim.step()

    temp_at_end_of_open = test_sim.state.temperature
    assert temp_at_end_of_open > initial_temp

    # 3. Close door
    closure_summary = test_sim.close_door()
    assert not test_sim.state.door_open
    assert closure_summary["residual_rise_predicted"] > 0
    assert closure_summary["peak_temp_predicted"] > closure_summary["temp_at_close"]
    assert closure_summary["recovery_time_minutes"] > 0
    assert closure_summary["recovery_phase"] == "residual_rise"


def test_post_closure_residual_warming_peak_delay(test_sim):
    """Verify that after closure, temperature continues to rise due to trapped heat
    before exponential cooling recovery takes over."""
    test_sim.open_door()
    for _ in range(6):
        test_sim.step()

    temp_at_close = test_sim.state.temperature
    test_sim.close_door()

    # Step through post-closure residual rise period (minutes 1 to 4)
    temps_post_close = []
    for _ in range(4):
        test_sim.step()
        temps_post_close.append(test_sim.state.temperature)

    # Temperature immediately after closure should peak higher than temp_at_close
    assert max(temps_post_close) >= temp_at_close, "Trapped heat must cause residual temperature rise"


def test_risk_not_reset_to_zero_after_door_closed(test_sim):
    """Closing a door must NEVER reset risk to zero while chamber is recovering."""
    test_sim.open_door()
    for _ in range(6):
        test_sim.step()

    test_sim.close_door()
    assert not test_sim.state.door_open

    # Compute risk directly after closure
    risk = compute_risk(
        config=test_sim.config,
        current_temp=test_sim.state.temperature,
        forecast_temps=[test_sim.state.temperature + 1.2, test_sim.state.temperature + 1.4],
        forecast_steps=[15, 30],
        slope_per_min=0.04,
        compressor_on=True,
        door_open_minutes=0.0,
        sensor_suspicious=False,
        horizon_minutes=30,
        time_since_closure_minutes=1.0,
        last_door_duration_minutes=6.0,
        residual_rise_predicted=1.4,
        peak_temp_predicted=test_sim.state.temperature + 1.4,
        recovery_progress_pct=10.0,
        recovery_phase="residual_rise",
    )

    # Risk must remain elevated (> 20) during early recovery
    assert risk.score >= 20, f"Expected elevated risk, got {risk.score}"
    assert any(
        "residual" in f.label.lower()
        or "post-closure" in f.label.lower()
        or "recovery" in f.label.lower()
        or "trapped" in f.detail.lower()
        for f in risk.factors
    )


def test_repeated_door_openings_cumulative_exposure(test_sim):
    """Repeated openings must accumulate 24h exposure count and duration."""
    # First opening: 2 min
    test_sim.open_door()
    for _ in range(2):
        test_sim.step()
    test_sim.close_door()

    # Second opening: 3 min
    test_sim.open_door()
    for _ in range(3):
        test_sim.step()
    test_sim.close_door()

    assert test_sim.state.door_events_count_24h == 2
    assert test_sim.state.cumulative_open_seconds_24h >= 300  # >= 5 minutes


def test_api_door_and_recovery_endpoints(client):
    """Test FastAPI endpoints for stateful door control and recovery status."""
    # 1. Open door
    open_resp = client.post("/api/zones/zone-b/door", json={"action": "open", "duration_minutes": 2})
    assert open_resp.status_code == 200
    data = open_resp.json()
    assert data["door_status"] == "open"
    assert data["zone_id"] == "zone-b"

    # 2. Check recovery status while open
    rec_resp = client.get("/api/zones/zone-b/recovery-status")
    assert rec_resp.status_code == 200
    rec_data = rec_resp.json()
    assert rec_data["door_status"] == "open"

    # 3. Close door and inspect retained risk and recovery status
    close_resp = client.post("/api/zones/zone-b/door", json={"action": "close"})
    assert close_resp.status_code == 200
    close_data = close_resp.json()
    assert close_data["door_status"] == "closed"
    assert close_data["residual_rise_predicted"] >= 0
    assert close_data["recovery_time_minutes"] >= 0

    # 4. Check door events log
    events_resp = client.get("/api/zones/zone-b/door-events", params={"limit": 10})
    assert events_resp.status_code == 200
    assert isinstance(events_resp.json(), list)


def test_api_model_evaluation_benchmarks(client):
    """Verify Model Evaluation endpoint reports MAE, RMSE, and baseline comparisons."""
    eval_resp = client.get("/api/model/evaluation")
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()

    assert "horizons_evaluation" in eval_data
    assert len(eval_data["horizons_evaluation"]) == 4  # 30m, 1h, 6h, 24h
    for h in eval_data["horizons_evaluation"]:
        assert h["mae_model"] <= h["mae_persistence"]
        assert h["improvement_over_persistence_pct"] > 0
    assert "excursion_classification_30m" in eval_data
    assert eval_data["excursion_classification_30m"]["precision"] >= 0.85
    assert "disclaimer" in eval_data
