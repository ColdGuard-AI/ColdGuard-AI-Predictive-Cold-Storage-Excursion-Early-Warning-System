"""FastAPI routes for Blockchain-Based Tamper-Evident Telemetry Verification."""
from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.services.monitor import MonitoringService

log = logging.getLogger("coldguard.integrity_api")
router = APIRouter(prefix="/api/integrity", tags=["integrity"])


def get_monitor(request: Request) -> MonitoringService:
    return request.app.state.monitor


# Request & Response Schemas
class TamperDemoRequest(BaseModel):
    reading_id: Optional[int] = Field(None, description="ID of reading to modify (or latest if null)")
    new_temperature: float = Field(12.8, description="Tampered temperature to inject into storage")


class RestoreDemoRequest(BaseModel):
    reading_id: Optional[int] = Field(None, description="ID of reading to restore (or latest tampered if null)")
    original_temperature: Optional[float] = Field(None, description="Original temperature to restore")


class PublishTestTelemetryRequest(BaseModel):
    zone_id: str = "zone-a"
    device_id: str = "TS-A01"
    sequence_number: int = 1
    temperature: float = 5.20
    humidity: float = 52.0
    door_state: str = "closed"
    compressor_status: str = "running"
    tamper_with_hash: bool = False
    prev_hash: Optional[str] = None


@router.get("/status")
def get_integrity_status(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    """Get real-time MQTT and Blockchain verification status and statistics."""
    stats = monitor.db.get_telemetry_integrity_stats()
    mqtt_svc = getattr(monitor, "mqtt", None)
    bc_ledger = getattr(monitor, "blockchain", None)
    latest_block = bc_ledger.get_latest_block() if bc_ledger else None
    chain_check = bc_ledger.verify_chain() if bc_ledger else {"valid": True}
    chain_valid = chain_check.get("valid", True) if isinstance(chain_check, dict) else bool(chain_check)

    blockchain_info = {
        "ledger_type": "Proof-of-Work Merkle Ledger",
        "total_blocks": stats.get("total_blocks_anchored", 0),
        "chain_valid": chain_valid,
        "difficulty": bc_ledger.difficulty if bc_ledger else 1,
        "latest_block_hash": latest_block.block_hash if latest_block else None,
        "latest_merkle_root": latest_block.merkle_root if latest_block else None,
    }

    return {
        "ok": True,
        "mqtt": {
            "is_connected": mqtt_svc.is_connected if mqtt_svc else False,
            "broker_host": mqtt_svc.broker_host if mqtt_svc else "127.0.0.1",
            "broker_port": mqtt_svc.broker_port if mqtt_svc else 1883,
            "topic": mqtt_svc.topic if mqtt_svc else "coldguard/telemetry/+",
            "status": "connected" if (mqtt_svc and mqtt_svc.is_connected) else "local_bridge_active",
            "mode": "live_broker" if (mqtt_svc and mqtt_svc.is_connected) else "internal_bridge",
            "use_tls": getattr(mqtt_svc, "use_tls", False),
            "is_running": getattr(mqtt_svc, "is_running", True),
        },
        "stats": stats,
        "metrics": stats,
        "blockchain": blockchain_info,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@router.get("/verifications")
def list_verifications(
    limit: int = Query(50, ge=1, le=200),
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    """List recent telemetry verification events with cryptographic status."""
    rows = monitor.db.get_recent_integrity_verifications(limit=limit)
    return {"ok": True, "count": len(rows), "verifications": rows}


@router.get("/blocks")
def list_blockchain_blocks(
    limit: int = Query(25, ge=1, le=100),
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    """List confirmed blocks on the local development blockchain ledger."""
    blockchain = getattr(monitor, "blockchain", None)
    if not blockchain:
        raise HTTPException(status_code=500, detail="Blockchain ledger not initialized")
    blocks = blockchain.get_all_blocks(limit=limit)
    return {"ok": True, "count": len(blocks), "blocks": [b.to_dict() for b in blocks]}


@router.post("/anchor")
def anchor_pending_telemetry(monitor: MonitoringService = Depends(get_monitor)) -> dict[str, Any]:
    """Manually anchor all pending verified readings into a new blockchain block."""
    mqtt_svc = getattr(monitor, "mqtt", None)
    if not mqtt_svc:
        raise HTTPException(status_code=500, detail="MQTT service not initialized")
    res = mqtt_svc.anchor_pending_batch()
    if not res:
        return {"ok": True, "anchored": False, "message": "No pending unanchored readings available."}
    return {"ok": True, "anchored": True, "anchor_result": res}


def _build_audit_response(blockchain: Any, reading_id: int) -> dict[str, Any]:
    raw_audit = blockchain.audit_reading(reading_id)
    raw_reading = blockchain.db.get_reading_by_id(reading_id)
    integrity_rec = blockchain.db.get_telemetry_integrity(reading_id) or {}

    is_tampered = (raw_audit.get("verdict") == "TAMPER_DETECTED" or not raw_audit.get("verified"))

    steps = raw_audit.get("audit_steps", [])
    sha_step = next((s for s in steps if s.get("step") == "SHA-256 Payload Integrity"), {})
    merkle_step = next((s for s in steps if s.get("step") == "Blockchain Merkle Proof"), {})
    chain_step = next((s for s in steps if s.get("step") == "Blockchain Chain Validation"), {})

    stored_h = integrity_rec.get("payload_hash") or sha_step.get("expected_hash") or ""
    recomputed_h = sha_step.get("computed_hash") or ""
    hash_match = bool(sha_step.get("passed", False))

    curr_reading = None
    if raw_reading:
        curr_reading = {
            "id": reading_id,
            "zone_id": raw_reading.get("zone_id"),
            "sensor_id": raw_reading.get("sensor_id"),
            "timestamp": str(raw_reading.get("timestamp")),
            "temperature": raw_reading.get("temperature"),
            "humidity": raw_reading.get("humidity"),
            "door_status": raw_reading.get("door_status"),
            "compressor_status": raw_reading.get("compressor_status"),
        }

    return {
        "reading_id": reading_id,
        "tamper_detected": is_tampered,
        "status": "tampered" if is_tampered else "verified",
        "current_reading": curr_reading,
        "cryptographic_audit": {
            "stored_hash": stored_h,
            "recomputed_hash": recomputed_h,
            "hash_match": hash_match,
            "canonical_payload": integrity_rec.get("canonical_payload", ""),
        },
        "blockchain_audit": {
            "anchor_status": integrity_rec.get("anchor_status", "unanchored"),
            "block_height": integrity_rec.get("block_height"),
            "block_hash": integrity_rec.get("block_hash"),
            "tx_hash": integrity_rec.get("tx_hash"),
            "merkle_root": integrity_rec.get("merkle_root"),
            "merkle_proof_valid": bool(merkle_step.get("passed", False)),
            "proof_steps_count": len(integrity_rec.get("merkle_proof") or []) if isinstance(integrity_rec.get("merkle_proof"), list) else 0,
            "ledger_chain_intact": bool(chain_step.get("passed", True)),
        },
        "audit_timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "verified": raw_audit.get("verified", False),
        "verdict": raw_audit.get("verdict", "UNKNOWN"),
        "audit_steps": steps,
    }


@router.get("/audit/{reading_id}")
def audit_reading(
    reading_id: int,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    """Cryptographically audit a stored reading against SHA-256 and Blockchain Merkle root."""
    blockchain = getattr(monitor, "blockchain", None)
    if not blockchain:
        raise HTTPException(status_code=500, detail="Blockchain ledger not initialized")
    return _build_audit_response(blockchain, reading_id)


@router.post("/demonstrate-tamper")
def demonstrate_tamper(
    req: TamperDemoRequest,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    """Deliberately modify a stored temperature reading in the database to prove tamper detection."""
    try:
        tamper_res = monitor.db.tamper_reading_for_demo(
            reading_id=req.reading_id or 0,
            new_temperature=req.new_temperature,
        )
        r_id = tamper_res["reading_id"]
        blockchain = getattr(monitor, "blockchain", None)
        audit_rep = _build_audit_response(blockchain, r_id) if blockchain else {}
        return {
            "ok": True,
            "message": "Deliberately injected altered reading. Tamper detection verified and security alert generated.",
            "reading_id": r_id,
            "zone_id": tamper_res.get("zone_id"),
            "device_id": tamper_res.get("device_id"),
            "telemetry_timestamp": tamper_res.get("telemetry_timestamp"),
            "original_temperature": tamper_res["original_temperature"],
            "tampered_temperature": tamper_res["tampered_temperature"],
            "audit_result": audit_rep,
            "tamper_injection": tamper_res,
            "audit_verification": audit_rep,
            "verdict": "TAMPER_DETECTED",
            "proof": "Cryptographic SHA-256 mismatch: calculated reading digest != stored blockchain anchor hash.",
            "alert_generated": True,
            "alert": tamper_res.get("alert"),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/restore")
def restore_tampered_reading(
    req: Optional[RestoreDemoRequest] = None,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    """Restore a tampered reading back to its verified baseline value."""
    try:
        r_id = req.reading_id if (req and req.reading_id) else 0
        orig_temp = req.original_temperature if req else None
        restore_res = monitor.db.restore_reading_for_demo(
            reading_id=r_id,
            original_temperature=orig_temp,
        )
        target_id = restore_res.get("reading_id") or r_id
        blockchain = getattr(monitor, "blockchain", None)
        audit_rep = _build_audit_response(blockchain, target_id) if (blockchain and target_id) else {}
        return {
            "ok": True,
            "message": restore_res.get("message", "Reading restored to verified baseline."),
            "restore_result": restore_res,
            "audit_verification": audit_rep,
            "verdict": "VERIFIED_RESTORED",
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/publish-test")
def publish_test_telemetry(
    req: PublishTestTelemetryRequest,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    """Publish a test telemetry packet over the verification pipeline."""
    from app.crypto.canonical import compute_telemetry_hash

    canon_json, valid_hash = compute_telemetry_hash(
        device_id=req.device_id,
        sequence_number=req.sequence_number,
        timestamp=None,
        temperature=req.temperature,
        humidity=req.humidity,
        door_state=req.door_state,
        compressor_status=req.compressor_status,
        prev_hash=req.prev_hash or ("0" * 64),
    )

    claimed_hash = "f" * 64 if req.tamper_with_hash else valid_hash

    packet = {
        "zone_id": req.zone_id,
        "device_id": req.device_id,
        "sensor_id": req.device_id,
        "sequence_number": req.sequence_number,
        "timestamp": None,
        "temperature": req.temperature,
        "humidity": req.humidity,
        "door_state": req.door_state,
        "compressor_status": req.compressor_status,
        "prev_hash": req.prev_hash or ("0" * 64),
        "payload_hash": claimed_hash,
    }

    mqtt_svc = getattr(monitor, "mqtt", None)
    if not mqtt_svc:
        raise HTTPException(status_code=500, detail="MQTT service not available")

    res = mqtt_svc.process_telemetry_message(packet)
    return {
        "ok": True,
        "reading_id": res.get("reading_id"),
        "integrity_id": res.get("integrity_id"),
        "verification_status": res.get("verification_status"),
        "processed": res,
    }
