import pandas as pd

from app.models.anomaly import check_sensor
from app.services.risk import compute_risk, risk_category, temperature_status
from app.simulator.zones import ZONES

ZONE = ZONES["zone-a"]
STEPS = [5, 10, 15, 20, 25, 30]


def test_normal_conditions_give_low_risk():
    r = compute_risk(ZONE, 5.0, [5.0] * 6, STEPS, 0.0, True, 0, False, 30)
    assert r.score < 10 and r.category == "low"
    assert r.to_dict()["factors"] == []


def test_compressor_failure_with_forecast_breach_is_high_risk():
    r = compute_risk(ZONE, 6.5, [6.9, 7.3, 7.7, 8.1, 8.4, 8.8], STEPS, 0.08, False, 0, False, 30)
    assert r.score >= 60 and r.category in ("high", "critical")
    keys = {f["key"] for f in r.to_dict()["factors"]}
    assert {"forecast", "trend", "equipment"} <= keys


def test_risk_only_explains_present_factors():
    r = compute_risk(ZONE, 5.0, [5.0] * 6, STEPS, 0.0, True, 7, False, 30)
    factors = r.to_dict()["factors"]
    assert {f["key"] for f in factors} == {"equipment"}
    assert "door open for 7 min" in factors[0]["detail"]


def test_risk_horizon_changes_forecast_component():
    fc = [5.5, 6.0, 6.5, 7.0, 7.5, 8.5]
    short = compute_risk(ZONE, 5.0, fc, STEPS, 0.0, True, 0, False, 15)
    long = compute_risk(ZONE, 5.0, fc, STEPS, 0.0, True, 0, False, 30)
    assert long.score > short.score


def test_risk_is_capped_and_categorised():
    r = compute_risk(ZONE, 12.0, [14.0] * 6, STEPS, 0.5, False, 30, True, 30)
    assert r.score == 100
    assert [risk_category(s) for s in (0, 24, 25, 49, 50, 74, 75, 100)] == \
        ["low", "low", "medium", "medium", "high", "high", "critical", "critical"]


def test_risk_without_forecast_or_reading_still_works():
    r = compute_risk(ZONE, None, [], [], 0.0, True, 0, True, 30)
    assert r.score == 10


def test_temperature_status():
    assert temperature_status(ZONE, 5.0) == "normal"
    assert temperature_status(ZONE, 7.2) == "warning"
    assert temperature_status(ZONE, 8.3) == "critical"
    assert temperature_status(ZONE, 1.0) == "critical"
    assert temperature_status(ZONE, None) == "unknown"


def _readings(temps):
    return pd.DataFrame({"timestamp": pd.date_range("2026-01-01", periods=len(temps), freq="min"),
                         "temperature": temps, "zone_id": "zone-a"})


def test_sensor_normal_readings_pass(models):
    temps = [5.0 + 0.03 * ((i * 7) % 5 - 2) for i in range(30)]
    check = check_sensor(_readings(temps), models.iforest)
    assert check.status == "normal", check.issues


def test_sensor_stuck_detected():
    check = check_sensor(_readings([5.0 + 0.03 * (i % 3) for i in range(10)] + [5.11] * 20))
    assert check.status == "suspicious"
    assert any(i["type"] == "stuck_sensor" for i in check.issues)


def test_sensor_missing_detected():
    temps = [5.0 + 0.01 * i for i in range(20)] + [5.0, None, 5.0, None, None]
    check = check_sensor(_readings(temps))
    assert any(i["type"] == "missing_data" for i in check.issues)


def test_sensor_spike_detected():
    temps = [5.0 + 0.02 * (i % 3) for i in range(20)] + [11.5]
    check = check_sensor(_readings(temps))
    assert check.spike_detected and check.status == "suspicious"


def test_sensor_empty_data():
    assert check_sensor(_readings([])).status == "no_data"
