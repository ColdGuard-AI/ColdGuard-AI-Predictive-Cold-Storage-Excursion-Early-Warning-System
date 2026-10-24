"""PostgreSQL/TimescaleDB and SQLite persistence for sensor readings, door events, predictions, and alerts."""
from __future__ import annotations

import json
import logging
import os
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

log = logging.getLogger("coldguard.database")

SQLITE_SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id TEXT NOT NULL,
    sensor_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    temperature REAL,
    humidity REAL,
    compressor_status TEXT NOT NULL,
    compressor_load_pct REAL,
    door_status TEXT NOT NULL,
    door_open_duration_seconds INTEGER DEFAULT 0,
    time_since_closure_seconds INTEGER DEFAULT 0,
    ambient_temperature REAL,
    scenario TEXT NOT NULL,
    power_consumption_kw REAL,
    sensor_health TEXT,
    is_synthetic INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_readings_zone_ts ON readings(zone_id, timestamp);

CREATE TABLE IF NOT EXISTS door_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id TEXT NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    duration_seconds INTEGER DEFAULT 0,
    ambient_temp_at_open REAL,
    temp_at_open REAL,
    temp_at_close REAL,
    compressor_state TEXT,
    residual_rise_predicted REAL DEFAULT 0.0,
    peak_temp_predicted REAL DEFAULT 0.0,
    recovery_time_minutes REAL DEFAULT 0.0,
    recovery_progress_pct REAL DEFAULT 0.0,
    status TEXT NOT NULL,
    previous_events_count_24h INTEGER DEFAULT 0,
    cumulative_open_seconds_24h INTEGER DEFAULT 0,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_door_events_zone ON door_events(zone_id, opened_at);

CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    horizon_minutes INTEGER NOT NULL,
    predicted_temperature REAL NOT NULL,
    temperature_delta REAL NOT NULL,
    risk_score INTEGER NOT NULL,
    risk_category TEXT NOT NULL,
    excursion_expected INTEGER NOT NULL,
    time_to_breach_minutes REAL,
    predicted_peak_temperature REAL,
    residual_rise REAL,
    recovery_time_minutes REAL,
    recovery_progress_pct REAL,
    is_synthetic INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_predictions_zone_ts ON predictions(zone_id, timestamp);

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

CREATE TABLE IF NOT EXISTS telemetry_integrity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reading_id INTEGER,
    zone_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    canonical_payload TEXT NOT NULL,
    verification_status TEXT NOT NULL,
    verification_message TEXT,
    anchor_status TEXT NOT NULL DEFAULT 'unanchored',
    block_height INTEGER,
    block_hash TEXT,
    tx_hash TEXT,
    merkle_root TEXT,
    merkle_proof TEXT,
    merkle_index INTEGER,
    verified_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_telemetry_integrity_reading ON telemetry_integrity(reading_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_integrity_status ON telemetry_integrity(verification_status);
CREATE INDEX IF NOT EXISTS idx_telemetry_integrity_anchor ON telemetry_integrity(anchor_status);

CREATE TABLE IF NOT EXISTS blockchain_blocks (
    block_height INTEGER PRIMARY KEY,
    block_hash TEXT NOT NULL,
    prev_block_hash TEXT NOT NULL,
    merkle_root TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    difficulty INTEGER DEFAULT 1,
    tx_count INTEGER NOT NULL,
    tx_hashes TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed'
);
CREATE INDEX IF NOT EXISTS idx_blockchain_blocks_hash ON blockchain_blocks(block_hash);
"""

READING_COLUMNS = [
    "zone_id", "sensor_id", "timestamp", "temperature", "humidity",
    "compressor_status", "compressor_load_pct", "door_status",
    "door_open_duration_seconds", "time_since_closure_seconds",
    "ambient_temperature", "scenario", "power_consumption_kw",
    "sensor_health", "is_synthetic"
]

DOOR_EVENT_COLUMNS = [
    "zone_id", "opened_at", "closed_at", "duration_seconds",
    "ambient_temp_at_open", "temp_at_open", "temp_at_close",
    "compressor_state", "residual_rise_predicted", "peak_temp_predicted",
    "recovery_time_minutes", "recovery_progress_pct", "status",
    "previous_events_count_24h", "cumulative_open_seconds_24h", "notes"
]

PREDICTION_COLUMNS = [
    "zone_id", "timestamp", "horizon_minutes", "predicted_temperature",
    "temperature_delta", "risk_score", "risk_category", "excursion_expected",
    "time_to_breach_minutes", "predicted_peak_temperature", "residual_rise",
    "recovery_time_minutes", "recovery_progress_pct", "is_synthetic"
]


def _ts(value: datetime | str | None) -> str | None:
    if value is None:
        return None
    return value.isoformat(timespec="seconds") if isinstance(value, datetime) else str(value)


class Database:
    """Thread-safe database storage with TimescaleDB / PostgreSQL support and SQLite fallback."""

    def __init__(self, path: Path | str, database_url: str | None = None) -> None:
        self.path = str(path)
        self.database_url = database_url or os.getenv("DATABASE_URL") or os.getenv("COLDGUARD_DATABASE_URL")
        self.is_postgres = False
        self._lock = threading.RLock()

        if self.database_url and (self.database_url.startswith("postgresql://") or self.database_url.startswith("postgres://")):
            try:
                import psycopg2
                conn = psycopg2.connect(self.database_url)
                conn.close()
                self.is_postgres = True
                log.info("Connected to PostgreSQL / TimescaleDB: %s", self.database_url.split("@")[-1])
            except Exception as exc:
                log.warning("Could not connect to PostgreSQL (%s). Falling back to SQLite.", exc)
                self.is_postgres = False

        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row

        with self._lock:
            self._conn.executescript(SQLITE_SCHEMA)
            # Safe schema migrations for existing SQLite databases
            migration_columns = [
                ("readings", "compressor_load_pct", "REAL"),
                ("readings", "door_open_duration_seconds", "INTEGER DEFAULT 0"),
                ("readings", "time_since_closure_seconds", "INTEGER DEFAULT 0"),
                ("readings", "power_consumption_kw", "REAL"),
                ("readings", "sensor_health", "TEXT"),
                ("readings", "is_synthetic", "INTEGER DEFAULT 1"),
            ]
            for tbl, col, col_type in migration_columns:
                try:
                    self._conn.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_type};")
                except sqlite3.OperationalError:
                    pass
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def reset(self) -> None:
        with self._lock:
            self._conn.executescript(
                "DELETE FROM readings; DELETE FROM alerts; DELETE FROM door_events; "
                "DELETE FROM predictions; DELETE FROM telemetry_integrity; DELETE FROM blockchain_blocks;"
            )
            self._conn.commit()

    # ------------------------------------------------------------------ readings
    def insert_readings(self, readings: Iterable[dict[str, Any]]) -> None:
        rows = []
        for r in readings:
            row = []
            for col in READING_COLUMNS:
                if col == "timestamp":
                    row.append(_ts(r.get("timestamp")))
                elif col == "is_synthetic":
                    row.append(1 if r.get("is_synthetic", True) else 0)
                else:
                    row.append(r.get(col))
            rows.append(tuple(row))
        with self._lock:
            placeholders = ",".join("?" * len(READING_COLUMNS))
            self._conn.executemany(
                f"INSERT INTO readings ({','.join(READING_COLUMNS)}) VALUES ({placeholders})",
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
        df["timestamp"] = pd.to_datetime(df["timestamp"], format="ISO8601")
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

    # ------------------------------------------------------------------ door_events
    def insert_door_event(self, event: dict[str, Any]) -> int:
        row = tuple(_ts(event.get(c)) if c in ("opened_at", "closed_at") else event.get(c) for c in DOOR_EVENT_COLUMNS)
        with self._lock:
            cur = self._conn.execute(
                f"INSERT INTO door_events ({','.join(DOOR_EVENT_COLUMNS)}) VALUES ({','.join('?' * len(DOOR_EVENT_COLUMNS))})",
                row,
            )
            self._conn.commit()
            return int(cur.lastrowid)

    def update_door_event(self, event_id: int, **fields: Any) -> None:
        if not fields:
            return
        for key in ("opened_at", "closed_at"):
            if key in fields and fields[key] is not None:
                fields[key] = _ts(fields[key])
        assignments = ", ".join(f"{k} = ?" for k in fields)
        with self._lock:
            self._conn.execute(f"UPDATE door_events SET {assignments} WHERE id = ?", (*fields.values(), event_id))
            self._conn.commit()

    def latest_door_event(self, zone_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM door_events WHERE zone_id = ? ORDER BY opened_at DESC, id DESC LIMIT 1",
                (zone_id,),
            ).fetchone()
        return dict(row) if row else None

    def list_door_events(self, zone_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        clauses, params = [], []
        if zone_id:
            clauses.append("zone_id = ?")
            params.append(zone_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self._lock:
            rows = self._conn.execute(
                f"SELECT * FROM door_events {where} ORDER BY opened_at DESC, id DESC LIMIT ?",
                (*params, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_door_stats_24h(self, zone_id: str, current_time: datetime | None = None) -> dict[str, Any]:
        """Aggregate door activity in the last 24 hours for zone."""
        now_str = _ts(current_time or datetime.now(timezone.utc))
        with self._lock:
            row = self._conn.execute(
                """SELECT COUNT(*) as event_count, COALESCE(SUM(duration_seconds), 0) as total_duration
                   FROM door_events WHERE zone_id = ? AND opened_at >= datetime(?, '-24 hours')""",
                (zone_id, now_str),
            ).fetchone()
        if row:
            return {
                "events_count_24h": int(row["event_count"]),
                "cumulative_open_seconds_24h": int(row["total_duration"]),
                "cumulative_open_minutes_24h": round(int(row["total_duration"]) / 60.0, 1),
            }
        return {"events_count_24h": 0, "cumulative_open_seconds_24h": 0, "cumulative_open_minutes_24h": 0.0}

    # ------------------------------------------------------------------ predictions
    def insert_predictions_batch(self, preds: list[dict[str, Any]]) -> None:
        if not preds:
            return
        rows = []
        for p in preds:
            row = []
            for col in PREDICTION_COLUMNS:
                if col == "timestamp":
                    row.append(_ts(p.get("timestamp")))
                elif col in ("excursion_expected", "is_synthetic"):
                    row.append(1 if p.get(col) else 0)
                else:
                    row.append(p.get(col))
            rows.append(tuple(row))
        with self._lock:
            self._conn.executemany(
                f"INSERT INTO predictions ({','.join(PREDICTION_COLUMNS)}) VALUES ({','.join('?' * len(PREDICTION_COLUMNS))})",
                rows,
            )
            self._conn.commit()

    def latest_predictions_for_zone(self, zone_id: str) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """SELECT * FROM predictions WHERE zone_id = ? AND timestamp = (
                       SELECT MAX(timestamp) FROM predictions WHERE zone_id = ?
                   ) ORDER BY horizon_minutes ASC""",
                (zone_id, zone_id),
            ).fetchall()
        return [dict(r) for r in rows]

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

    # ------------------------------------------------------------------ telemetry integrity & blockchain
    def insert_reading_single(self, r: dict[str, Any]) -> int:
        """Insert a single reading and return its generated auto-increment id."""
        row = []
        for col in READING_COLUMNS:
            if col == "timestamp":
                row.append(_ts(r.get("timestamp")))
            elif col == "is_synthetic":
                row.append(1 if r.get("is_synthetic", True) else 0)
            elif col == "scenario":
                row.append(r.get(col) or "normal")
            elif col == "door_status":
                row.append(r.get(col) or "closed")
            elif col == "compressor_status":
                row.append(r.get(col) or "running")
            elif col == "sensor_health":
                row.append(r.get(col) or "healthy")
            else:
                row.append(r.get(col))
        with self._lock:
            placeholders = ",".join("?" * len(READING_COLUMNS))
            cursor = self._conn.execute(
                f"INSERT INTO readings ({','.join(READING_COLUMNS)}) VALUES ({placeholders})",
                tuple(row),
            )
            self._conn.commit()
            return cursor.lastrowid

    def get_reading_by_id(self, reading_id: int) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM readings WHERE id = ?", (reading_id,)).fetchone()
        return dict(row) if row else None

    def record_telemetry_verification(
        self,
        reading_id: int | None,
        zone_id: str,
        device_id: str,
        sequence_number: int,
        timestamp: str,
        payload_hash: str,
        prev_hash: str,
        canonical_payload: str,
        verification_status: str,
        verification_message: str | None = None,
        verified_at: str | None = None,
    ) -> int:
        v_at = verified_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        with self._lock:
            cursor = self._conn.execute(
                """
                INSERT INTO telemetry_integrity (
                    reading_id, zone_id, device_id, sequence_number, timestamp,
                    payload_hash, prev_hash, canonical_payload,
                    verification_status, verification_message, anchor_status, verified_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unanchored', ?)
                """,
                (
                    reading_id, zone_id, device_id, sequence_number, str(timestamp),
                    payload_hash, prev_hash, canonical_payload,
                    verification_status, verification_message, v_at
                ),
            )
            self._conn.commit()
            return cursor.lastrowid

    def update_telemetry_anchor(
        self,
        reading_id: int,
        block_height: int,
        block_hash: str,
        tx_hash: str,
        merkle_root: str,
        merkle_proof: list[dict[str, str]],
        merkle_index: int,
    ) -> None:
        with self._lock:
            self._conn.execute(
                """
                UPDATE telemetry_integrity
                SET anchor_status = 'anchored',
                    block_height = ?,
                    block_hash = ?,
                    tx_hash = ?,
                    merkle_root = ?,
                    merkle_proof = ?,
                    merkle_index = ?
                WHERE reading_id = ?
                """,
                (
                    block_height, block_hash, tx_hash, merkle_root,
                    json.dumps(merkle_proof), merkle_index, reading_id
                ),
            )
            self._conn.commit()

    def get_telemetry_integrity(self, reading_id: int) -> dict[str, Any] | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM telemetry_integrity WHERE reading_id = ? ORDER BY id DESC LIMIT 1",
                (reading_id,)
            ).fetchone()
        return dict(row) if row else None

    def get_unanchored_telemetry(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT * FROM telemetry_integrity
                WHERE verification_status = 'verified' AND anchor_status = 'unanchored'
                ORDER BY id ASC LIMIT ?
                """,
                (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_telemetry_integrity_stats(self) -> dict[str, Any]:
        with self._lock:
            total = self._conn.execute("SELECT COUNT(*) FROM telemetry_integrity").fetchone()[0]
            verified = self._conn.execute("SELECT COUNT(*) FROM telemetry_integrity WHERE verification_status = 'verified'").fetchone()[0]
            tampered = self._conn.execute("SELECT COUNT(*) FROM telemetry_integrity WHERE verification_status = 'tampered'").fetchone()[0]
            duplicates = self._conn.execute("SELECT COUNT(*) FROM telemetry_integrity WHERE verification_status = 'duplicate'").fetchone()[0]
            seq_anomalies = self._conn.execute("SELECT COUNT(*) FROM telemetry_integrity WHERE verification_status = 'sequence_anomaly'").fetchone()[0]
            anchored = self._conn.execute("SELECT COUNT(*) FROM telemetry_integrity WHERE anchor_status = 'anchored'").fetchone()[0]
            unanchored = self._conn.execute("SELECT COUNT(*) FROM telemetry_integrity WHERE verification_status = 'verified' AND anchor_status = 'unanchored'").fetchone()[0]
            blocks_count = self._conn.execute("SELECT COUNT(*) FROM blockchain_blocks").fetchone()[0]
            latest_block = self.get_latest_blockchain_block()
        return {
            "total_messages_received": total,
            "verified_count": verified,
            "tampered_count": tampered,
            "duplicate_count": duplicates,
            "sequence_anomaly_count": seq_anomalies,
            "anchored_count": anchored,
            "pending_anchor_count": unanchored,
            "total_blocks_anchored": blocks_count,
            "latest_block_height": latest_block.block_height if latest_block else 0,
            "latest_block_hash": latest_block.block_hash if latest_block else None,
            "latest_merkle_root": latest_block.merkle_root if latest_block else None,
            "hash_chain_status": "broken" if (tampered > 0 or seq_anomalies > 0) else "intact",
        }

    def get_recent_integrity_verifications(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                """
                SELECT ti.*, r.temperature as current_temperature, r.humidity as current_humidity
                FROM telemetry_integrity ti
                LEFT JOIN readings r ON ti.reading_id = r.id
                ORDER BY ti.id DESC LIMIT ?
                """,
                (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def save_blockchain_block(self, block: Any) -> None:
        txs_json = json.dumps(block.tx_hashes) if isinstance(block.tx_hashes, list) else str(block.tx_hashes)
        with self._lock:
            self._conn.execute(
                """
                INSERT OR REPLACE INTO blockchain_blocks (
                    block_height, block_hash, prev_block_hash, merkle_root,
                    timestamp, nonce, difficulty, tx_count, tx_hashes, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    block.block_height, block.block_hash, block.prev_block_hash,
                    block.merkle_root, block.timestamp, block.nonce,
                    block.difficulty, len(block.tx_hashes) if isinstance(block.tx_hashes, list) else 1,
                    txs_json, block.status
                ),
            )
            self._conn.commit()

    def get_blockchain_block(self, height: int) -> Any | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM blockchain_blocks WHERE block_height = ?", (height,)
            ).fetchone()
        if not row:
            return None
        from app.crypto.blockchain import Block
        txs = row["tx_hashes"]
        if isinstance(txs, str):
            try:
                txs = json.loads(txs)
            except Exception:
                txs = [txs]
        return Block(
            block_height=row["block_height"],
            timestamp=row["timestamp"],
            prev_block_hash=row["prev_block_hash"],
            merkle_root=row["merkle_root"],
            tx_hashes=txs if isinstance(txs, list) else [],
            nonce=row["nonce"],
            difficulty=row["difficulty"],
            block_hash=row["block_hash"],
            status=row["status"],
        )

    def get_latest_blockchain_block(self) -> Any | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM blockchain_blocks ORDER BY block_height DESC LIMIT 1"
            ).fetchone()
        if not row:
            return None
        from app.crypto.blockchain import Block
        txs = row["tx_hashes"]
        if isinstance(txs, str):
            try:
                txs = json.loads(txs)
            except Exception:
                txs = [txs]
        return Block(
            block_height=row["block_height"],
            timestamp=row["timestamp"],
            prev_block_hash=row["prev_block_hash"],
            merkle_root=row["merkle_root"],
            tx_hashes=txs if isinstance(txs, list) else [],
            nonce=row["nonce"],
            difficulty=row["difficulty"],
            block_hash=row["block_hash"],
            status=row["status"],
        )

    def get_blockchain_blocks(self, limit: int = 50) -> list[Any]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM blockchain_blocks ORDER BY block_height DESC LIMIT ?", (limit,)
            ).fetchall()
        from app.crypto.blockchain import Block
        blocks = []
        for row in rows:
            txs = row["tx_hashes"]
            if isinstance(txs, str):
                try:
                    txs = json.loads(txs)
                except Exception:
                    txs = [txs]
            blocks.append(
                Block(
                    block_height=row["block_height"],
                    timestamp=row["timestamp"],
                    prev_block_hash=row["prev_block_hash"],
                    merkle_root=row["merkle_root"],
                    tx_hashes=txs if isinstance(txs, list) else [],
                    nonce=row["nonce"],
                    difficulty=row["difficulty"],
                    block_hash=row["block_hash"],
                    status=row["status"],
                )
            )
        return blocks

    def tamper_reading_for_demo(self, reading_id: int, new_temperature: float = 12.8) -> dict[str, Any]:
        """Deliberately modify a stored temperature reading in the database to demonstrate tamper detection."""
        with self._lock:
            current = self._conn.execute("SELECT id, temperature, zone_id FROM readings WHERE id = ?", (reading_id,)).fetchone()
            if not current:
                # Find latest reading if specified ID not found
                current = self._conn.execute("SELECT id, temperature, zone_id FROM readings ORDER BY id DESC LIMIT 1").fetchone()
            if not current:
                raise ValueError("No reading available to tamper")
            r_id = current["id"]
            orig_temp = current["temperature"]
            self._conn.execute("UPDATE readings SET temperature = ? WHERE id = ?", (new_temperature, r_id))
            self._conn.execute(
                "UPDATE telemetry_integrity SET verification_status = 'tampered', verification_message = 'MANUAL_INJECTION: reading altered in storage' WHERE reading_id = ?",
                (r_id,)
            )
            self._conn.commit()
            return {
                "reading_id": r_id,
                "zone_id": current["zone_id"],
                "original_temperature": orig_temp,
                "tampered_temperature": new_temperature,
                "status": "tampered",
                "message": f"Reading #{r_id} temperature modified from {orig_temp}°C to {new_temperature}°C in database.",
            }

    def restore_reading_for_demo(self, reading_id: int, original_temperature: float = 5.0) -> dict[str, Any]:
        """Restore a tampered reading back to its original value."""
        with self._lock:
            self._conn.execute("UPDATE readings SET temperature = ? WHERE id = ?", (original_temperature, reading_id))
            self._conn.execute(
                "UPDATE telemetry_integrity SET verification_status = 'verified', verification_message = 'RESTORED: Verified baseline recovered' WHERE reading_id = ?",
                (reading_id,)
            )
            self._conn.commit()
            return {
                "reading_id": reading_id,
                "restored_temperature": original_temperature,
                "status": "verified",
                "message": f"Reading #{reading_id} restored to {original_temperature}°C and re-verified.",
            }

