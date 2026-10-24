"""Instant phone notifications for new alerts, delivered through ntfy (https://ntfy.sh).

How it works:
* Each storage manager's phone number maps to a private ntfy topic,
  e.g. +91 82620 36045 -> "coldguard-918262036045".
* The manager installs the free ntfy app (Android / iOS) once and subscribes to that topic.
* Whenever an alert is raised, comes back after clearing, or escalates (real sensors, MQTT or a
  digital-twin scenario), it is pushed to every manager's topic and pops up within seconds.

Pushes go through one background queue (never slows the monitoring loop), are retried when the
network or ntfy rate limit fails, and the same alert is not re-sent more than once per
COLDGUARD_PHONE_ALERT_REPEAT_SECONDS unless its severity got worse.
"""
from __future__ import annotations

import logging
import os
import queue
import re
import threading
import time
from typing import Any

import httpx

from app.simulator.zones import ZONES

log = logging.getLogger("coldguard.notifier")

# ntfy priority: 5 = max (alarm sound / "keep alerting" on the phone), 4 = high.
PRIORITY = {"critical": 5, "warning": 5, "info": 3}
SEVERITY_RANK = {"info": 0, "warning": 1, "critical": 2}
RETRY_DELAYS = (2, 5, 10, 20)  # seconds between attempts when a push fails
TAGS = {"critical": ["rotating_light"], "warning": ["warning"], "info": ["information_source"]}


def topic_for_phone(phone: str | None) -> str | None:
    digits = re.sub(r"\D", "", phone or "")
    if len(digits) < 8:
        return None
    return f"{os.getenv('NTFY_TOPIC_PREFIX', 'coldguard-')}{digits}"


class PhoneNotifier:
    def __init__(self, fallback_phone: str | None = None) -> None:
        self.server = os.getenv("NTFY_SERVER", "https://ntfy.sh").rstrip("/")
        self.enabled = os.getenv("COLDGUARD_PHONE_ALERTS", "1").strip().lower() in {"1", "true", "yes", "on"}
        # Which severities trigger a phone pop-up (comma separated).
        self.severities = {s.strip() for s in os.getenv("COLDGUARD_PHONE_ALERT_SEVERITIES", "critical,warning").split(",") if s.strip()}
        # Optional: public URL of the dashboard, opened when the notification is tapped.
        self.dashboard_url = os.getenv("COLDGUARD_DASHBOARD_URL", "").strip()
        # Optional: public URL of this API, enables an "Acknowledge" button inside the notification.
        self.public_api_url = os.getenv("COLDGUARD_PUBLIC_API_URL", "").strip().rstrip("/")
        self.fallback_phone = fallback_phone
        self.repeat_seconds = float(os.getenv("COLDGUARD_PHONE_ALERT_REPEAT_SECONDS", "30"))
        self.sent_count = 0
        self.failed_count = 0
        self.last_error: str | None = None
        self._last_sent: dict[tuple[str, str], tuple[float, str]] = {}  # (zone, category) -> (time, severity)
        self._queue: queue.Queue[dict[str, Any]] = queue.Queue()
        self._worker: threading.Thread | None = None
        self._worker_lock = threading.Lock()

    # ------------------------------------------------------------------ recipients
    def manager_recipients(self) -> list[dict[str, str]]:
        """Approved storage managers with a phone number (plus the bootstrap manager phone)."""
        people: dict[str, dict[str, str]] = {}
        try:
            from database.connection import SessionLocal
            from database.models import User

            with SessionLocal() as s:
                rows = (
                    s.query(User)
                    .filter(User.actual_role == "cold_storage_manager", User.approval_status == "APPROVED")
                    .all()
                )
                for u in rows:
                    topic = topic_for_phone(u.phone)
                    if topic:
                        people[topic] = {"name": u.name, "phone": u.phone, "topic": topic}
        except Exception as exc:  # auth DB unavailable -> still use fallback phone
            log.debug("Could not load managers from auth DB: %s", exc)
        topic = topic_for_phone(self.fallback_phone)
        if topic and topic not in people:
            people[topic] = {"name": "Storage Manager", "phone": self.fallback_phone or "", "topic": topic}
        return list(people.values())

    # ------------------------------------------------------------------ sending
    def notify(self, alerts: list[dict[str, Any]]) -> None:
        """Called with new / re-activated / escalated alerts; returns immediately."""
        if not self.enabled or not alerts:
            return
        now = time.monotonic()
        for alert in alerts:
            severity = alert.get("severity", "warning")
            if severity not in self.severities:
                continue
            key = (alert.get("zone_id", ""), alert.get("category", ""))
            last = self._last_sent.get(key)
            if last and now - last[0] < self.repeat_seconds and SEVERITY_RANK.get(severity, 0) <= SEVERITY_RANK.get(last[1], 0):
                log.info("Phone alert for %s/%s skipped: already sent %.0fs ago", *key, now - last[0])
                continue
            self._last_sent[key] = (now, severity)
            self._queue.put(alert)
        self._ensure_worker()

    def forget(self, zone_id: str | None = None) -> None:
        """Clear the repeat guard (for one room, or all) so the next alert is always pushed."""
        for key in list(self._last_sent):
            if zone_id is None or key[0] == zone_id:
                self._last_sent.pop(key, None)

    def _ensure_worker(self) -> None:
        with self._worker_lock:
            if self._worker is None or not self._worker.is_alive():
                self._worker = threading.Thread(target=self._run, name="phone-notifier", daemon=True)
                self._worker.start()

    def _run(self) -> None:
        with httpx.Client(timeout=10) as client:
            while True:
                alert = self._queue.get()
                try:
                    recipients = self.manager_recipients()
                    if not recipients:
                        log.warning("Phone alert skipped: no storage manager has a phone number")
                        continue
                    payload = self._payload(alert)
                    for r in recipients:
                        self._publish_with_retry(client, r["topic"], payload)
                except Exception:
                    log.exception("Phone notifier error")
                finally:
                    self._queue.task_done()

    def _publish_with_retry(self, client: httpx.Client, topic: str, payload: dict[str, Any]) -> bool:
        for delay in (0, *RETRY_DELAYS):
            time.sleep(delay)
            ok, retry_after, retryable = self._post(client, topic, payload)
            if ok:
                return True
            if not retryable:
                break
            if retry_after:
                time.sleep(min(retry_after, 60))
        self.failed_count += 1
        log.error("Phone alert to %s FAILED after retries: %s (%s)", topic, payload["title"], self.last_error)
        return False

    def _payload(self, alert: dict[str, Any]) -> dict[str, Any]:
        severity = alert.get("severity", "warning")
        zone = ZONES.get(alert.get("zone_id", ""))
        zone_name = zone.name if zone else alert.get("zone_id", "")
        payload: dict[str, Any] = {
            "title": f"{severity.upper()} - {zone_name}: {alert.get('title', 'Alert')}",
            "message": f"{alert.get('explanation', '')}\n\nAction: {alert.get('recommended_action', '')}\nAlert ID: {alert.get('id', '')}",
            "priority": PRIORITY.get(severity, 4),
            "tags": TAGS.get(severity, ["warning"]),
        }
        if self.dashboard_url:
            payload["click"] = f"{self.dashboard_url.rstrip('/')}/alerts"
        if self.public_api_url and alert.get("id"):
            payload["actions"] = [{
                "action": "http", "label": "Acknowledge", "method": "POST", "clear": True,
                "url": f"{self.public_api_url}/api/alerts/{alert['id']}/acknowledge",
                "headers": {"Content-Type": "application/json"},
                "body": '{"user": "manager (phone)"}',
            }]
        return payload

    def _post(self, client: httpx.Client, topic: str, payload: dict[str, Any]) -> tuple[bool, float | None, bool]:
        """One attempt. Returns (ok, extra wait if rate-limited, worth retrying)."""
        try:
            res = client.post(self.server, json={"topic": topic, **payload})
            if res.status_code == 429:
                self.last_error = "HTTP 429 rate limited by ntfy"
                log.warning("Phone alert to %s rate limited, will retry", topic)
                try:
                    return False, float(res.headers.get("Retry-After", "5")), True
                except ValueError:
                    return False, 5.0, True
            if res.status_code >= 400:
                self.last_error = f"HTTP {res.status_code} {res.text[:120]}"
                log.warning("Phone alert to %s failed: %s", topic, self.last_error)
                return False, None, res.status_code >= 500  # 5xx: server hiccup, retry; 4xx: bad request
            self.sent_count += 1
            self.last_error = None
            log.info("Phone alert sent to topic %s: %s", topic, payload["title"])
            return True, None, False
        except Exception as exc:
            self.last_error = f"network error: {exc}"
            log.warning("Phone alert to %s failed (%s), will retry", topic, exc)
            return False, None, True

    def _publish(self, client: httpx.Client, topic: str, payload: dict[str, Any]) -> bool:
        return self._post(client, topic, payload)[0]

    def send_test(self) -> dict[str, Any]:
        """Synchronous test push to every manager; used by the Settings page."""
        recipients = self.manager_recipients()
        results = []
        with httpx.Client(timeout=10) as client:
            for r in recipients:
                ok = self._publish(client, r["topic"], {
                    "title": "ColdGuard AI - Test alert",
                    "message": "Phone alerts are working. You will be notified here the moment a cold room has a problem.",
                    "priority": 5,  # max, so it plays the same alarm as critical alerts
                    "tags": ["white_check_mark"],
                })
                results.append({**r, "delivered": ok})
        return {"recipients": results, "error": self.last_error if not all(x["delivered"] for x in results) else None}

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "provider": "ntfy",
            "server": self.server,
            "severities": sorted(self.severities),
            "recipients": self.manager_recipients(),
            "sent_count": self.sent_count,
            "failed_count": self.failed_count,
            "queued": self._queue.qsize(),
            "last_error": self.last_error,
        }
