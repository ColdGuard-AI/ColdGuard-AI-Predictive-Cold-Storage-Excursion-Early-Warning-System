from datetime import datetime

import pytest

from app.simulator.engine import SCENARIOS, Scenario, ZoneSimulator
from app.simulator.history import generate_zone_history
from app.simulator.zones import ZONES

START = datetime(2026, 1, 1, 8, 0)
ZONE = ZONES["zone-a"]

REQUIRED_FIELDS = {"timestamp", "zone_id", "sensor_id", "temperature", "humidity", "compressor_status",
                   "door_status", "ambient_temperature"}


def make_sim(seed: int = 1) -> ZoneSimulator:
    return ZoneSimulator(ZONE, seed=seed, start_time=START, routine_door_openings=False)


def test_reading_has_required_fields_and_advances_clock():
    sim = make_sim()
    r1, r2 = sim.step(), sim.step()
    assert REQUIRED_FIELDS <= set(r1)
    assert (r2["timestamp"] - r1["timestamp"]).total_seconds() == 60
    assert r1["zone_id"] == "zone-a" and r1["sensor_id"] == ZONE.sensor_id


def test_simulation_is_reproducible_with_same_seed():
    a = [r["temperature"] for r in make_sim(5).run(50)]
    b = [r["temperature"] for r in make_sim(5).run(50)]
    c = [r["temperature"] for r in make_sim(6).run(50)]
    assert a == b
    assert a != c


@pytest.mark.parametrize("zone_id", list(ZONES))
def test_normal_operation_stays_in_safe_range(zone_id):
    cfg = ZONES[zone_id]
    readings = ZoneSimulator(cfg, seed=2, start_time=START).run(24 * 60)
    temps = [r["temperature"] for r in readings]
    assert all(cfg.lower_limit < t < cfg.upper_limit for t in temps)
    assert all(r["compressor_status"] == "running" for r in readings)


def test_compressor_failure_stops_compressor_and_raises_temperature():
    sim = make_sim()
    sim.run(30)
    sim.set_scenario("compressor_failure")
    readings = sim.run(60)
    assert all(r["compressor_status"] == "stopped" for r in readings)
    assert readings[-1]["true_temperature"] > ZONE.upper_limit
    temps = [r["true_temperature"] for r in readings]
    assert temps[-1] > temps[10] > temps[0]


def test_door_left_open_raises_temperature_and_humidity():
    sim = make_sim()
    before = sim.run(30)[-1]
    sim.set_scenario("door_open")
    readings = sim.run(45)
    assert all(r["door_status"] == "open" for r in readings)
    assert readings[-1]["true_temperature"] > before["true_temperature"] + 2
    assert readings[-1]["humidity"] > before["humidity"] + 10


def test_ambient_increase_warms_faster_than_normal():
    base = make_sim()
    base.run(30)
    hot = base.clone(seed=9)
    hot.set_scenario(Scenario("ambient_increase", ambient_delta=18))
    normal = base.clone(seed=9)
    hot_r, normal_r = hot.run(60), normal.run(60)
    assert hot_r[-1]["ambient_temperature"] > normal_r[-1]["ambient_temperature"] + 12
    assert hot_r[-1]["true_temperature"] > normal_r[-1]["true_temperature"] + 1.5


def test_sensor_anomaly_produces_spikes_missing_and_stuck_values():
    sim = make_sim()
    sim.run(20)
    sim.set_scenario("sensor_anomaly")
    readings = sim.run(45)
    temps = [r["temperature"] for r in readings]
    true = [r["true_temperature"] for r in readings]
    spikes = [i for i in range(12) if temps[i] is not None and abs(temps[i] - true[i]) > 4]
    assert spikes, "expected spikes in the first phase"
    assert any(t is None for t in temps[12:22]), "expected missing values"
    assert len(set(temps[25:45])) == 1, "expected a stuck value"
    # The physical temperature is unaffected by a faulty sensor.
    assert all(ZONE.lower_limit < t < ZONE.upper_limit for t in true)


def test_scenario_with_duration_reverts_to_normal():
    sim = make_sim()
    sim.set_scenario(Scenario("compressor_failure", duration_minutes=10))
    readings = sim.run(15)
    assert readings[9]["compressor_status"] == "stopped"
    assert readings[11]["compressor_status"] == "running"
    assert sim.scenario == "normal"


def test_reset_to_normal_recovers_temperature():
    sim = make_sim()
    sim.set_scenario("compressor_failure")
    sim.run(40)
    sim.set_scenario("normal")
    readings = sim.run(60)
    assert abs(readings[-1]["true_temperature"] - ZONE.setpoint) < 0.3


def test_invalid_scenario_rejected():
    with pytest.raises(ValueError):
        Scenario("meteor_strike")
    assert set(SCENARIOS) == {
        "normal",
        "door_open",
        "compressor_failure",
        "ambient_increase",
        "sensor_anomaly",
        "cooling_degradation",
        "abnormal_humidity",
        "fire_runaway",
    }


def test_history_generator_contains_episodes():
    df = generate_zone_history(ZONE, minutes=3 * 24 * 60, seed=4)
    assert len(df) == 3 * 24 * 60
    assert df["timestamp"].is_monotonic_increasing
    assert (df["scenario"] != "normal").any()
