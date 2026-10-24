"""Cryptographic canonicalization and SHA-256 payload hashing for ColdGuard AI telemetry."""
from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any


def format_canonical_float(val: float | int | None, precision: int = 2) -> float | None:
    """Format floats deterministically to avoid IEEE 754 float string serialization disparities."""
    if val is None:
        return None
    try:
        return round(float(val), precision)
    except (ValueError, TypeError):
        return None


def format_canonical_timestamp(ts: datetime | str | None) -> str:
    """Format timestamps deterministically as ISO-8601 YYYY-MM-DDTHH:MM:SS without microseconds."""
    if ts is None:
        return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(ts, datetime):
        return ts.strftime("%Y-%m-%dT%H:%M:%SZ")
    # String parsing
    ts_str = str(ts).strip()
    if ts_str.endswith("Z"):
        ts_str = ts_str[:-1]
    # Remove microsecond part if present
    if "." in ts_str:
        ts_str = ts_str.split(".")[0]
    return f"{ts_str}Z" if not ts_str.endswith("Z") else ts_str


def canonicalize_telemetry_dict(
    device_id: str,
    sequence_number: int,
    timestamp: datetime | str,
    temperature: float | None,
    humidity: float | None,
    door_state: str,
    compressor_status: str,
    prev_hash: str = "0" * 64,
) -> dict[str, Any]:
    """Build a standardized dictionary containing the mandatory fields in canonical form."""
    return {
        "compressor_status": str(compressor_status).lower().strip(),
        "device_id": str(device_id).strip(),
        "door_state": str(door_state).lower().strip(),
        "humidity": format_canonical_float(humidity, 2),
        "prev_hash": str(prev_hash).lower().strip(),
        "sequence_number": int(sequence_number),
        "temperature": format_canonical_float(temperature, 2),
        "timestamp": format_canonical_timestamp(timestamp),
    }


def serialize_canonical_json(data: dict[str, Any]) -> str:
    """Deterministically serialize dictionary with strictly sorted keys and no whitespace."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def compute_telemetry_hash(
    device_id: str | dict[str, Any] = "TS-UNKNOWN",
    sequence_number: int = 0,
    timestamp: datetime | str | None = None,
    temperature: float | None = None,
    humidity: float | None = None,
    door_state: str = "closed",
    compressor_status: str = "running",
    prev_hash: str = "0" * 64,
) -> tuple[str, str]:
    """Compute canonical JSON string and its SHA-256 hex digest.
    
    Returns:
        tuple[str, str]: (canonical_json_string, sha256_hash_hex)
    """
    if isinstance(device_id, dict):
        d = device_id
        dev_id = str(d.get("device_id") or d.get("sensor_id") or "TS-UNKNOWN")
        seq = int(d.get("sequence_number", 0))
        ts = d.get("timestamp")
        temp = d.get("temperature")
        hum = d.get("humidity")
        door = str(d.get("door_state") or d.get("door_status") or "closed")
        comp = str(d.get("compressor_status", "running"))
        prev = str(d.get("prev_hash", "0" * 64))
        return compute_telemetry_hash(dev_id, seq, ts, temp, hum, door, comp, prev)

    canonical_dict = canonicalize_telemetry_dict(
        device_id=str(device_id),
        sequence_number=sequence_number,
        timestamp=timestamp,
        temperature=temperature,
        humidity=humidity,
        door_state=door_state,
        compressor_status=compressor_status,
        prev_hash=prev_hash,
    )
    canonical_json = serialize_canonical_json(canonical_dict)
    payload_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()
    return canonical_json, payload_hash


def verify_reading_hash(
    reading_payload: dict[str, Any],
    expected_hash: str,
) -> tuple[bool, str, str]:
    """Verify that a reading's contents strictly match its claimed SHA-256 hash.
    
    Returns:
        tuple[bool, str, str]: (is_valid, computed_hash, canonical_json)
    """
    # Normalize door field if named door_status vs door_state
    door_val = reading_payload.get("door_state") or reading_payload.get("door_status") or "closed"
    dev_id = reading_payload.get("device_id") or reading_payload.get("sensor_id") or "TS-UNKNOWN"
    seq = reading_payload.get("sequence_number", 0)
    prev = reading_payload.get("prev_hash", "0" * 64)

    canonical_json, computed_hash = compute_telemetry_hash(
        device_id=dev_id,
        sequence_number=seq,
        timestamp=reading_payload.get("timestamp"),
        temperature=reading_payload.get("temperature"),
        humidity=reading_payload.get("humidity"),
        door_state=door_val,
        compressor_status=reading_payload.get("compressor_status", "running"),
        prev_hash=prev,
    )
    is_valid = computed_hash.lower() == str(expected_hash).lower().strip()
    return is_valid, computed_hash, canonical_json
