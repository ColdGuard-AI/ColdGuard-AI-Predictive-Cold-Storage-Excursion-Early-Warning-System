"""SQLite persistence for sensor readings and alerts (stdlib sqlite3, thread-safe via a lock)."""
from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    temperature REAL,
    humidity REAL,
    compressor_status TEXT NOT NULL,
    door_status TEXT NOT NULL,
    ambient_temperature REAL,
    scenario TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_readings_zone_ts ON readings(zone_id, timestamp);

CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    zone_id TEXT NOT NULL,
    category TEXT NOT NULL,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    explanation TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    occurrences INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    acknowledged INTEGER NOT NULL DEFAULT 0,
    acknowledged_at TEXT,
    acknowledged_by TEXT,
    context TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_zone_cat ON alerts(zone_id, category);
"""

READING_COLUMNS = ["zone_id", "sensor_id", "timestamp", "temperature", "humidity", "compressor_status",
                   "door_status", "ambient_temperature", "scenario"]


def _ts(value: datetime | str) -> str:
    return value.isoformat(timespec="seconds") if isinstance(value, datetime) else value


class Database:
    def __init__(self, path: Path | str) -> None:
        self.path = str(path)
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock:
            self._conn.executescript(SCHEMA)
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def reset(self) -> None:
        with self._lock:
            self._conn.executescript("DELETE FROM readings; DELETE FROM alerts;")
            self._conn.commit()

    # ------------------------------------------------------------------ readings
    def insert_readings(self, readings: Iterable[dict[str, Any]]) -> None:
        rows = [tuple(_ts(r[c]) if c == "timestamp" else r.get(c) for c in READING_COLUMNS) for r in readings]
        with self._lock:
            self._conn.executemany(
                f"INSERT INTO readings ({','.join(READING_COLUMNS)}) VALUES ({','.join('?' * len(READING_COLUMNS))})",
                rows,
            )
            self._conn.commit()

    def recent_readings(self, zone_id: str, limit: int) -> pd.DataFrame:
        """Most recent ``limit`` readings for a zone, oldest first."""
        with self._lock:
            rows = self._conn.execute(
                f"SELECT {','.join(READING_COLUMNS)} FROM readings WHERE zone_id = ? ORDER BY timestamp DESC LIMIT ?",
                (zone_id, limit),
            ).fetchall()
        df = pd.DataFrame([dict(r) for r in rows], columns=READING_COLUMNS)
        if df.empty:
            return df
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return df.iloc[::-1].reset_index(drop=True)

    def count_readings(self) -> int:
        with self._lock:
            return int(self._conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0])

    def prune_readings(self, keep_per_zone: int) -> None:
        with self._lock:
            self._conn.execute(
                """DELETE FROM readings WHERE id IN (
                       SELECT id FROM (
                           SELECT id, ROW_NUMBER() OVER (PARTITION BY zone_id ORDER BY timestamp DESC) AS rn FROM readings
                       ) WHERE rn > ?)""",
                (keep_per_zone,),
            )
            self._conn.commit()

    # ------------------------------------------------------------------ alerts
    @staticmethod
    def _alert_row(row: sqlite3.Row) -> dict[str, Any]:
        d = dict(row)
        d["active"] = bool(d["active"])
        d["acknowledged"] = bool(d["acknowledged"])
        d["context"] = json.loads(d["context"]) if d.get("context") else {}
        return d

    def insert_alert(self, alert: dict[str, Any]) -> None:
        with self._lock:
            self._conn.execute(
                """INSERT INTO alerts (id, zone_id, category, severity, title, explanation, recommended_action,
                       created_at, last_seen_at, occurrences, active, acknowledged, context)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (alert["id"], alert["zone_id"], alert["category"], alert["severity"], alert["title"],
                 alert["explanation"], alert["recommended_action"], _ts(alert["created_at"]), _ts(alert["last_seen_at"]),
                 1, 1, 0, json.dumps(alert.get("context", {}))),
            )
            self._conn.commit()

    def update_alert(self, alert_id: str, **fields: Any) -> None:
        if not fields:
            return
        if "context" in fields:
            fields["context"] = json.dumps(fields["context"])
        for key in ("last_seen_at", "acknowledged_at"):
            if key in fields and fields[key] is not None:
                fields[key] = _ts(fields[key])
        for key in ("active", "acknowledged"):
            if key in fields:
                fields[key] = int(bool(fields[key]))
        assignments = ", ".join(f"{k} = ?" for k in fields)
        with self._lock:
            self._conn.execute(f"UPDATE alerts SET {assignments} WHERE id = ?", (*fields.values(), alert_id))
            self._conn.commit()

    def increment_occurrence(self, alert_id: str) -> None:
        with self._lock:
            self._conn.execute("UPDATE alerts SET occurrences = occurrences + 1 WHERE id = ?", (alert_id,))
            self._conn.commit()

    def get_alert(self, alert_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,)).fetchone()
        return self._alert_row(row) if row else None

    def latest_alert_for(self, zone_id: str, category: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM alerts WHERE zone_id = ? AND category = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
                (zone_id, category),
            ).fetchone()
        return self._alert_row(row) if row else None

    def list_alerts(
        self,
        zone_id: str | None = None,
        severity: str | None = None,
        acknowledged: bool | None = None,
        active: bool | None = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        clauses, params = [], []
        if zone_id:
            clauses.append("zone_id = ?"); params.append(zone_id)
        if severity:
            clauses.append("severity = ?"); params.append(severity)
        if acknowledged is not None:
            clauses.append("acknowledged = ?"); params.append(int(acknowledged))
        if active is not None:
            clauses.append("active = ?"); params.append(int(active))
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self._lock:
            rows = self._conn.execute(
                f"SELECT * FROM alerts {where} ORDER BY created_at DESC, rowid DESC LIMIT ?", (*params, limit)
            ).fetchall()
        return [self._alert_row(r) for r in rows]

    def active_alerts(self, zone_id: str) -> list[dict[str, Any]]:
        return self.list_alerts(zone_id=zone_id, active=True, limit=50)
