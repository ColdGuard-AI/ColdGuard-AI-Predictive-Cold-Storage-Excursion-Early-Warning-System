"""API tests, including the full 2-minute demo flow driven through the REST endpoints."""
import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client(test_settings, models):
    app = create_app(test_settings, models=models, autostart=False)
    with TestClient(app) as c:
        token = c.post("/api/auth/login", json={"username": "admin", "password": "admin123"}).json()["access_token"]
        c.headers["Authorization"] = f"Bearer {token}"
        yield c


def advance(client, minutes):
    r = client.post("/api/simulator/advance", json={"minutes": minutes})
    assert r.status_code == 200, r.text


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok" and body["model_loaded"] and body["data_source"] == "simulated"
    assert body["readings_stored"] > 0


def test_zones_and_readings(client):
    zones = client.get("/api/zones").json()
    assert len(zones) >= 3
    z = zones[0]
    for key in ("temperature", "humidity", "compressor_status", "door_status", "sensor_status", "risk_score", "latest_alert"):
        assert key in z
    r = client.get(f"/api/zones/{z['zone_id']}/readings", params={"minutes": 60}).json()
    assert r["count"] == 60 and r["simulated"] is True
    assert client.get("/api/zones/nope").status_code == 404
    assert client.get("/api/zones/zone-a/readings", params={"minutes": 0}).status_code == 422


def test_forecast_and_risk_endpoints(client):
    fc = client.get("/api/zones/zone-a/forecast", params={"horizon": 15}).json()
    assert fc["available"] and len(fc["points"]) == 3 and fc["upper_limit"] == 8.0
    assert client.get("/api/zones/zone-a/forecast", params={"horizon": 45}).status_code == 422
    risk = client.get("/api/zones/zone-a/risk").json()
    assert 0 <= risk["score"] <= 100 and risk["method"] == "heuristic"
    assert client.get("/api/zones/zone-a/sensor-health").json()["status"] == "normal"


def test_request_validation(client):
    assert client.post("/api/simulator/scenario", json={"zone_id": "zone-a", "scenario": "meteor"}).status_code == 422
    assert client.post("/api/simulator/scenario", json={"zone_id": "zone-x", "scenario": "door_open"}).status_code == 404
    assert client.post("/api/simulator/advance", json={"minutes": 0}).status_code == 422
    assert client.post("/api/simulator/what-if", json={"zone_id": "zone-a", "scenario": "x"}).status_code == 422
    assert client.post("/api/alerts/ALT-MISSING/acknowledge").status_code == 404


def test_model_metrics(client):
    m = client.get("/api/model/metrics").json()
    assert m["available"] and m["metrics"]["horizons"]
    assert any("simulated" in lim.lower() for lim in m["metrics"]["limitations"])


def test_demo_flow_compressor_failure(client):
    # 1. Normal operation: no alerts, low risk.
    advance(client, 15)
    assert client.get("/api/alerts").json() == []
    assert client.get("/api/zones/zone-a").json()["risk_category"] == "low"

    # 2. Activate compressor failure in Zone A.
    r = client.post("/api/simulator/scenario", json={"zone_id": "zone-a", "scenario": "compressor_failure"})
    assert r.status_code == 200
    first_warning_minute = breach_minute = None
    risks = []
    for minute in range(1, 61):
        advance(client, 1)
        zone = client.get("/api/zones/zone-a").json()
        risks.append(zone["risk_score"])
        cats = {a["category"] for a in client.get("/api/alerts", params={"zone_id": "zone-a"}).json()}
        if first_warning_minute is None and "predicted_excursion" in cats:
            first_warning_minute = minute
            assert zone["temperature"] < zone["upper_limit"]
        if breach_minute is None and "high_temperature" in cats:
            breach_minute = minute
    assert zone["compressor_status"] == "stopped"
    assert risks[-1] > risks[0] and risks[-1] >= 75
    assert first_warning_minute is not None and breach_minute is not None
    assert first_warning_minute < breach_minute, "early warning must precede the actual excursion"

    # 3. Alert detail and acknowledgement.
    alerts = client.get("/api/alerts", params={"zone_id": "zone-a"}).json()
    comp = next(a for a in alerts if a["category"] == "compressor_failure")
    assert "Inspect the compressor" in comp["recommended_action"]
    acked = client.post(f"/api/alerts/{comp['id']}/acknowledge").json()
    assert acked["acknowledged"] is True and "admin" in acked["acknowledged_by"]
    # De-duplication: still exactly one compressor alert after many ticks.
    assert sum(a["category"] == "compressor_failure" for a in alerts) == 1
    assert client.get("/api/alerts", params={"severity": "critical"}).status_code == 200

    # 4. What-if: resuming normal operation vs the ongoing failure.
    wi = client.post("/api/simulator/what-if", json={"zone_id": "zone-a", "scenario": "normal", "projection_minutes": 60}).json()
    assert wi["scenario_result"]["final_temperature"] < wi["baseline"]["final_temperature"]
    assert wi["scenario_result"]["starts_out_of_range"] is True
    assert wi["scenario_result"]["time_to_limit_minutes"] is None
    assert wi["scenario_result"]["returns_to_range_minute"] is not None
    assert wi["baseline"]["returns_to_range_minute"] is None

    # 5. Reset.
    assert client.post("/api/simulator/reset", json={"mode": "scenario"}).status_code == 200
    advance(client, 3)
    assert client.get("/api/zones/zone-a").json()["compressor_status"] == "running"
    assert client.post("/api/simulator/reset", json={"mode": "full"}).status_code == 200
    assert client.get("/api/alerts").json() == []


def test_what_if_compressor_failure_vs_baseline(client):
    r = client.post("/api/simulator/what-if", json={
        "zone_id": "zone-a", "scenario": "compressor_failure", "duration_minutes": 60, "projection_minutes": 90})
    assert r.status_code == 200
    body = r.json()
    sc, base = body["scenario_result"], body["baseline"]
    assert sc["max_temperature"] > base["max_temperature"] + 2
    assert sc["time_to_limit_minutes"] is not None and base["time_to_limit_minutes"] is None
    assert sc["peak_risk"] > base["peak_risk"]
    assert sc["ai_first_warning_minute"] is not None and sc["ai_lead_time_minutes"] > 0
    assert body["recommendations"]
    # The live simulation is untouched by a what-if run.
    assert client.get("/api/zones/zone-a").json()["compressor_status"] == "running"


def test_simulator_control(client):
    r = client.post("/api/simulator/control", json={"running": False, "tick_seconds": 2})
    assert r.status_code == 200 and r.json()["data"]["tick_seconds"] == 2
    assert client.post("/api/simulator/control", json={"tick_seconds": 0.01}).status_code == 422
    assert client.get("/api/simulator/status").json()["zones"]["zone-a"]["scenario"] == "normal"


def test_sensor_anomaly_scenario_raises_sensor_alerts(client):
    client.post("/api/simulator/scenario", json={"zone_id": "zone-b", "scenario": "sensor_anomaly"})
    advance(client, 40)
    cats = {a["category"] for a in client.get("/api/alerts", params={"zone_id": "zone-b"}).json()}
    assert {"sensor_anomaly", "missing_data"} <= cats
    assert "high_temperature" not in cats and "predicted_excursion" not in cats
