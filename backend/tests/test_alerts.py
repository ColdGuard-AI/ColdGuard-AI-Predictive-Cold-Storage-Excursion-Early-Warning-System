from datetime import datetime, timedelta

from app.database.db import Database
from app.services.alerts import AlertManager, Condition, ZoneSignals, evaluate_conditions
from app.simulator.zones import ZONES

T0 = datetime(2026, 1, 1, 8, 0)
ZONE = ZONES["zone-a"]


def cond(category="door_open", severity="warning"):
    return Condition(category, severity, "t", "explanation", "Check the door seal and close the door.")


def signals(**kw):
    base = dict(config=ZONE, timestamp=T0, current_temp=5.0, last_valid_temps=[5.0, 5.0], compressor_off_minutes=0,
                door_open_minutes=0, sensor_issues=[], forecast={"available": True}, alert_horizon=30, slope_per_min=0.0)
    base.update(kw)
    return ZoneSignals(**base)


def test_repeated_condition_creates_single_alert():
    db = Database(":memory:")
    mgr = AlertManager(db, cooldown_minutes=20)
    created = [mgr.process("zone-a", [cond()], T0 + timedelta(minutes=i)) for i in range(10)]
    assert sum(len(c) for c in created) == 1
    alerts = db.list_alerts()
    assert len(alerts) == 1 and alerts[0]["active"]


def test_alert_resolves_and_cooldown_reactivates():
    db = Database(":memory:")
    mgr = AlertManager(db, cooldown_minutes=20)
    mgr.process("zone-a", [cond()], T0)
    mgr.process("zone-a", [], T0 + timedelta(minutes=1))
    assert db.list_alerts()[0]["active"] is False
    assert mgr.process("zone-a", [cond()], T0 + timedelta(minutes=5)) == []  # within cooldown
    alerts = db.list_alerts()
    assert len(alerts) == 1 and alerts[0]["active"] and alerts[0]["occurrences"] == 2
    mgr.process("zone-a", [], T0 + timedelta(minutes=6))
    assert len(mgr.process("zone-a", [cond()], T0 + timedelta(minutes=40))) == 1  # after cooldown
    assert len(db.list_alerts()) == 2


def test_severity_escalates_while_active():
    db = Database(":memory:")
    mgr = AlertManager(db)
    mgr.process("zone-a", [cond(severity="warning")], T0)
    mgr.process("zone-a", [cond(severity="critical")], T0 + timedelta(minutes=1))
    mgr.process("zone-a", [cond(severity="warning")], T0 + timedelta(minutes=2))
    assert db.list_alerts()[0]["severity"] == "critical"


def test_acknowledge():
    db = Database(":memory:")
    mgr = AlertManager(db)
    alert = mgr.process("zone-a", [cond()], T0)[0]
    acked = mgr.acknowledge(alert["id"], "alice", T0 + timedelta(minutes=1))
    assert acked["acknowledged"] and acked["acknowledged_by"] == "alice"
    assert mgr.acknowledge("ALT-NOPE", "x", T0) is None
    assert db.list_alerts(acknowledged=False) == []


def test_rules_link_recommendations_to_observed_conditions():
    conds = {c.category: c for c in evaluate_conditions(signals(compressor_off_minutes=3))}
    assert "Inspect the compressor and verify power supply" in conds["compressor_failure"].recommended_action
    conds = {c.category: c for c in evaluate_conditions(signals(door_open_minutes=6))}
    assert conds["door_open"].recommended_action == "Check the door seal and close the door."
    conds = {c.category: c for c in evaluate_conditions(signals(sensor_issues=[{"type": "spike", "detail": "x"}]))}
    assert "independent measurement" in conds["sensor_anomaly"].recommended_action
    assert evaluate_conditions(signals()) == []


def test_predicted_excursion_rule():
    fc = {"available": True, "warning_time_to_breach_minutes": 18.0, "warning_breach_side": "upper"}
    conds = {c.category: c for c in evaluate_conditions(signals(forecast=fc, compressor_off_minutes=4, current_temp=6.2))}
    alert = conds["predicted_excursion"]
    assert alert.severity == "warning" and "compressor stopped" in alert.explanation
    assert "compressor" in alert.recommended_action
    # Not raised when the breach is beyond the alert horizon, or while the sensor is suspicious.
    far = {"available": True, "warning_time_to_breach_minutes": 45.0, "warning_breach_side": "upper"}
    assert not [c for c in evaluate_conditions(signals(forecast=far)) if c.category == "predicted_excursion"]
    sus = evaluate_conditions(signals(forecast=fc, sensor_issues=[{"type": "stuck_sensor", "detail": "x"}]))
    assert not [c for c in sus if c.category == "predicted_excursion"]


def test_high_temperature_requires_two_consecutive_readings():
    one = evaluate_conditions(signals(last_valid_temps=[5.0, 9.0], current_temp=9.0))
    assert not [c for c in one if c.category == "high_temperature"]
    two = evaluate_conditions(signals(last_valid_temps=[8.4, 9.0], current_temp=9.0))
    assert [c for c in two if c.category == "high_temperature"][0].severity == "critical"


# ---------------------------------------------------------------- phone notifications
def test_phone_notify_on_new_reactivated_and_escalated_alerts():
    db = Database(":memory:")
    mgr = AlertManager(db, cooldown_minutes=20)
    sent = []
    mgr.on_notify = lambda alerts: sent.extend((a["category"], a["severity"]) for a in alerts)
    mgr.process("zone-a", [cond(severity="warning")], T0)                         # new
    mgr.process("zone-a", [cond(severity="warning")], T0 + timedelta(minutes=1))  # still active: silent
    mgr.process("zone-a", [cond(severity="critical")], T0 + timedelta(minutes=2))  # escalated
    mgr.process("zone-a", [], T0 + timedelta(minutes=3))                           # cleared
    mgr.process("zone-a", [cond(severity="warning")], T0 + timedelta(minutes=5))  # re-activated in cooldown
    assert sent == [("door_open", "warning"), ("door_open", "critical"), ("door_open", "warning")]


def _notifier(monkeypatch, responses):
    import httpx
    from app.services import notifier as nmod

    monkeypatch.setenv("COLDGUARD_PHONE_ALERTS", "1")
    monkeypatch.setattr(nmod, "RETRY_DELAYS", (0, 0))
    monkeypatch.setattr(nmod.time, "sleep", lambda s: None)
    n = nmod.PhoneNotifier("+911234567890")
    monkeypatch.setattr(n, "manager_recipients", lambda: [{"name": "M", "phone": "x", "topic": "t"}])
    posts = []

    def fake_post(self, url, json=None, **kw):
        posts.append(json)
        r = responses.pop(0) if responses else 200
        if isinstance(r, Exception):
            raise r
        return httpx.Response(r, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.Client, "post", fake_post)
    return n, posts


def test_phone_notifier_retries_network_errors_and_rate_limits(monkeypatch):
    import httpx

    n, posts = _notifier(monkeypatch, [httpx.ConnectError("offline"), 429, 200])
    n.notify([{"id": "A1", "zone_id": "zone-a", "category": "door_open", "severity": "critical", "title": "Door"}])
    n._queue.join()
    assert len(posts) == 3 and n.sent_count == 1 and n.failed_count == 0


def test_phone_notifier_skips_quick_repeats_unless_escalated(monkeypatch):
    n, posts = _notifier(monkeypatch, [])
    a = {"id": "A1", "zone_id": "zone-a", "category": "door_open", "severity": "warning", "title": "Door"}
    n.notify([a])
    n.notify([a])                              # flapping repeat within 30 s: skipped
    n.notify([{**a, "severity": "critical"}])  # got worse: sent
    n._queue.join()
    assert [p["title"].split(" ")[0] for p in posts] == ["WARNING", "CRITICAL"]
