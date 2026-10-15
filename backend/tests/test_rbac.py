"""Role-based access control tests."""
import pytest
from fastapi.testclient import TestClient

from app.auth.service import hash_password, verify_password
from app.main import create_app


@pytest.fixture()
def app_client(test_settings, models):
    app = create_app(test_settings, models=models, autostart=False)
    with TestClient(app) as c:
        yield c


def login(client, username, password=None):
    r = client.post("/api/auth/login", json={"username": username, "password": password or f"{username}123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_password_hashing():
    stored = hash_password("s3cret")
    assert verify_password("s3cret", stored)
    assert not verify_password("wrong", stored)
    assert not verify_password("x", "garbage")


def test_login_and_me(app_client):
    assert app_client.post("/api/auth/login", json={"username": "manager", "password": "nope"}).status_code == 401
    h = login(app_client, "manager")
    me = app_client.get("/api/auth/me", headers=h).json()
    assert me["role"] == "manager" and "what_if" in me["permissions"] and "simulate" not in me["permissions"]


def test_unauthenticated_requests_are_rejected(app_client):
    assert app_client.get("/api/health").status_code == 200  # health stays public
    assert app_client.get("/api/zones").status_code == 401
    assert app_client.get("/api/zones", headers={"Authorization": "Bearer invalid"}).status_code == 401


@pytest.mark.parametrize(
    "role,expected",
    [
        ("operator", {"view": 200, "manager": 403, "whatif": 403, "simulate": 403, "model": 403, "users": 403}),
        ("manager", {"view": 200, "manager": 200, "whatif": 200, "simulate": 403, "model": 200, "users": 403}),
        ("admin", {"view": 200, "manager": 200, "whatif": 200, "simulate": 200, "model": 200, "users": 200}),
    ],
)
def test_permission_matrix(app_client, role, expected):
    h = login(app_client, role)
    got = {
        "view": app_client.get("/api/zones", headers=h).status_code,
        "manager": app_client.get("/api/manager/overview", headers=h).status_code,
        "whatif": app_client.post("/api/simulator/what-if", headers=h,
                                  json={"zone_id": "zone-a", "scenario": "door_open", "projection_minutes": 30}).status_code,
        "simulate": app_client.post("/api/simulator/scenario", headers=h, json={"zone_id": "zone-a", "scenario": "normal"}).status_code,
        "model": app_client.get("/api/model/metrics", headers=h).status_code,
        "users": app_client.get("/api/auth/users", headers=h).status_code,
    }
    assert got == expected


def test_forbidden_message_is_helpful(app_client):
    r = app_client.post("/api/simulator/advance", headers=login(app_client, "operator"), json={"minutes": 1})
    assert r.status_code == 403 and "Operator" in r.json()["detail"]


def test_operator_can_acknowledge_and_is_recorded(app_client):
    admin = login(app_client, "admin")
    app_client.post("/api/simulator/scenario", headers=admin, json={"zone_id": "zone-a", "scenario": "door_open"})
    app_client.post("/api/simulator/advance", headers=admin, json={"minutes": 8})
    op = login(app_client, "operator")
    alert = app_client.get("/api/alerts", headers=op).json()[0]
    acked = app_client.post(f"/api/alerts/{alert['id']}/acknowledge", headers=op).json()
    assert acked["acknowledged"] and "Omar Operator" in acked["acknowledged_by"]


def test_admin_can_change_roles_and_it_applies_immediately(app_client):
    admin = login(app_client, "admin")
    op = login(app_client, "operator")
    assert app_client.get("/api/manager/overview", headers=op).status_code == 403
    r = app_client.patch("/api/auth/users/operator", headers=admin, json={"role": "manager"})
    assert r.status_code == 200 and r.json()["role"] == "manager"
    assert app_client.get("/api/manager/overview", headers=op).status_code == 200
    assert app_client.patch("/api/auth/users/admin", headers=admin, json={"role": "operator"}).status_code == 409
    assert app_client.patch("/api/auth/users/ghost", headers=admin, json={"role": "manager"}).status_code == 404
    assert app_client.patch("/api/auth/users/operator", headers=admin, json={"role": "boss"}).status_code == 422


def test_logout_invalidates_token(app_client):
    h = login(app_client, "manager")
    app_client.post("/api/auth/logout", headers=h)
    assert app_client.get("/api/zones", headers=h).status_code == 401


def test_manager_overview_content(app_client):
    h = login(app_client, "manager")
    ov = app_client.get("/api/manager/overview", headers=h).json()
    assert ov["totals"]["zones"] == 3 and ov["totals"]["zones_ok"] == 3
    z = ov["zones"][0]
    assert z["time_in_range_pct"] == 100.0 and len(z["sparkline"]) == 60
    assert app_client.get("/api/manager/overview?window_minutes=5", headers=h).status_code == 422
