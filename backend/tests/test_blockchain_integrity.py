"""Automated tests for Blockchain-Based Tamper-Evident Telemetry Verification."""
from __future__ import annotations

import json
from datetime import datetime, timezone
import pytest

from app.crypto.canonical import (
    canonicalize_telemetry_dict,
    compute_telemetry_hash,
    format_canonical_float,
    format_canonical_timestamp,
    serialize_canonical_json,
    verify_reading_hash,
)
from app.crypto.merkle import MerkleTree
from app.crypto.blockchain import BlockchainLedger, Block
from app.database.db import Database


def test_deterministic_canonicalization():
    """Verify that floats and timestamps format deterministically with key sorting."""
    assert format_canonical_float(4.5555) == 4.56
    assert format_canonical_float(None) is None
    assert format_canonical_timestamp("2026-10-24T12:00:00.123456Z") == "2026-10-24T12:00:00Z"

    d1 = canonicalize_telemetry_dict(
        device_id="TS-01",
        sequence_number=1,
        timestamp="2026-10-24T12:00:00Z",
        temperature=4.0,
        humidity=60.0,
        door_state="closed",
        compressor_status="running",
        prev_hash="0" * 64,
    )
    s1 = serialize_canonical_json(d1)
    # Keys must be strictly sorted alphabetically
    keys_order = [k for k in json.loads(s1).keys()]
    assert keys_order == sorted(keys_order)


def test_compute_and_verify_telemetry_hash():
    """Verify that payload hash computation is deterministic and detects any altered reading."""
    reading = {
        "device_id": "TS-01",
        "zone_id": "zone-a",
        "sequence_number": 1,
        "timestamp": "2026-10-24T12:00:00Z",
        "temperature": 4.15,
        "humidity": 55.0,
        "door_state": "closed",
        "compressor_status": "running",
        "prev_hash": "0" * 64,
    }
    canon_json, payload_hash = compute_telemetry_hash(reading)
    assert len(payload_hash) == 64

    # 1. Authentic packet verification
    is_valid, computed_hash, _ = verify_reading_hash(reading, payload_hash)
    assert is_valid is True
    assert computed_hash == payload_hash

    # 2. Tampered temperature injection
    tampered_reading = dict(reading)
    tampered_reading["temperature"] = 14.15  # modified temperature!
    is_valid_tampered, recomputed_hash, _ = verify_reading_hash(tampered_reading, payload_hash)
    assert is_valid_tampered is False
    assert recomputed_hash != payload_hash

    # 3. Tampered door status
    tampered_door = dict(reading)
    tampered_door["door_state"] = "open"
    is_valid_door, _, _ = verify_reading_hash(tampered_door, payload_hash)
    assert is_valid_door is False


def test_merkle_tree_construction_and_proofs():
    """Verify Merkle tree construction, root hashing, and proof verification."""
    leaves = [
        "a" * 64,
        "b" * 64,
        "c" * 64,
        "d" * 64,
        "e" * 64,
    ]
    tree = MerkleTree(leaves)
    assert len(tree.root) == 64

    # Verify proof for every single leaf
    for i, leaf in enumerate(leaves):
        proof = tree.get_proof(i)
        assert len(proof) > 0
        assert MerkleTree.verify_proof(leaf, proof, tree.root) is True

    # Altered leaf proof must fail
    fake_leaf = "f" * 64
    proof_0 = tree.get_proof(0)
    assert MerkleTree.verify_proof(fake_leaf, proof_0, tree.root) is False


def test_blockchain_ledger_mining_and_chain_validity(tmp_path):
    """Verify local development blockchain ledger, block mining, and ledger integrity."""
    db = Database(tmp_path / "test_bc.db")
    ledger = BlockchainLedger(db, difficulty=1)

    # Genesis block exists
    genesis = ledger.get_latest_block()
    assert genesis is not None
    assert genesis.block_height == 0
    assert genesis.prev_block_hash == "0" * 64

    # Insert a reading and integrity record into DB
    r_payload = {
        "zone_id": "zone-a",
        "sensor_id": "TS-01",
        "timestamp": "2026-10-24T12:00:00Z",
        "temperature": 4.5,
        "humidity": 55.0,
        "door_status": "closed",
        "compressor_status": "running",
    }
    rid = db.insert_reading_single(r_payload)
    canon_json, p_hash = compute_telemetry_hash(
        device_id="TS-01",
        sequence_number=1,
        timestamp="2026-10-24T12:00:00Z",
        temperature=4.5,
        humidity=55.0,
        door_state="closed",
        compressor_status="running",
        prev_hash="0" * 64,
    )
    db.record_telemetry_verification(
        reading_id=rid,
        zone_id="zone-a",
        device_id="TS-01",
        sequence_number=1,
        timestamp="2026-10-24T12:00:00Z",
        payload_hash=p_hash,
        prev_hash="0" * 64,
        canonical_payload=canon_json,
        verification_status="verified",
    )

    # Anchor batch
    readings_to_anchor = [
        {"reading_id": rid, "payload_hash": p_hash},
        {"reading_id": 102, "payload_hash": "2" * 64},
        {"reading_id": 103, "payload_hash": "3" * 64},
    ]
    block, tx_hash = ledger.anchor_batch(readings_to_anchor)
    assert block.block_height == 1
    assert block.prev_block_hash == genesis.block_hash
    assert block.tx_count == 3
    assert len(block.block_hash) == 64
    assert len(tx_hash) == 64

    # Verify chain
    assert ledger.verify_chain()["valid"] is True

    # Audit reading proof
    audit = ledger.audit_reading(rid)
    assert audit["verified"] is True
    assert audit["verdict"] == "VERIFIED"


def test_mqtt_service_replay_and_sequence_detection(tmp_path):
    """Verify backend MQTT service rejects duplicate/replay packets and detects sequence gaps."""
    from app.mqtt.service import MqttService

    db = Database(tmp_path / "test_mqtt.db")
    ledger = BlockchainLedger(db, difficulty=1)
    mqtt_svc = MqttService(db=db, blockchain=ledger, broker_port=9999, anchor_batch_size=3)

    # Sequence 1
    p1 = {
        "device_id": "TS-01",
        "zone_id": "zone-a",
        "sequence_number": 1,
        "timestamp": "2026-10-24T12:00:00Z",
        "temperature": 4.0,
        "humidity": 50.0,
        "door_state": "closed",
        "compressor_status": "running",
        "prev_hash": "0" * 64,
    }
    _, p1["payload_hash"] = compute_telemetry_hash(p1)
    res1 = mqtt_svc.process_telemetry_message(p1)
    assert res1["verification_status"] == "verified"

    # Sequence 1 Replay Attack
    res_replay = mqtt_svc.process_telemetry_message(p1)
    assert res_replay["verification_status"] == "duplicate"
    assert "REPLAY_DETECTED" in res_replay["message"]

    # Sequence 5 Jump (Sequence Gap Anomaly)
    p5 = dict(p1)
    p5["sequence_number"] = 5
    p5["prev_hash"] = p1["payload_hash"]
    _, p5["payload_hash"] = compute_telemetry_hash(p5)
    res_gap = mqtt_svc.process_telemetry_message(p5)
    assert res_gap["verification_status"] == "sequence_anomaly"


def test_integrity_api_and_tamper_demonstration(client):
    """Full end-to-end API test: status, tamper attack demonstration, detection, and restoration."""
    # 1. Status
    res = client.get("/api/integrity/status")
    assert res.status_code == 200
    status_data = res.json()
    assert "metrics" in status_data
    assert "blockchain" in status_data

    # 2. Publish a verified telemetry reading
    packet = {
        "device_id": "TS-DEMO",
        "zone_id": "zone-a",
        "sequence_number": 1,
        "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "temperature": 3.85,
        "humidity": 52.0,
        "door_state": "closed",
        "compressor_status": "running",
        "prev_hash": "0" * 64,
    }
    _, packet["payload_hash"] = compute_telemetry_hash(packet)
    pub_res = client.post("/api/integrity/publish-test", json=packet)
    assert pub_res.status_code == 200
    reading_id = pub_res.json()["reading_id"]
    assert reading_id is not None

    # 3. Anchor batch
    anchor_res = client.post("/api/integrity/anchor")
    assert anchor_res.status_code == 200

    # 4. Audit authentic reading
    audit_res = client.get(f"/api/integrity/audit/{reading_id}")
    assert audit_res.status_code == 200
    audit_data = audit_res.json()
    assert audit_data["tamper_detected"] is False
    assert audit_data["cryptographic_audit"]["hash_match"] is True

    # 5. Simulate Tamper Attack (Deliberately alter stored DB temperature)
    tamper_res = client.post("/api/integrity/demonstrate-tamper", json={"reading_id": reading_id, "new_temperature": 28.5})
    assert tamper_res.status_code == 200
    tamper_data = tamper_res.json()
    assert tamper_data["reading_id"] == reading_id
    assert tamper_data["tampered_temperature"] == 28.5
    # Verification audit must immediately catch the tamper
    assert tamper_data["audit_result"]["tamper_detected"] is True
    assert tamper_data["audit_result"]["cryptographic_audit"]["hash_match"] is False

    # 6. Restore original reading
    restore_res = client.post(
        "/api/integrity/restore",
        json={"reading_id": reading_id, "original_temperature": tamper_data["original_temperature"]},
    )
    assert restore_res.status_code == 200

    # 7. Audit again after restore -> Must be authentic again
    audit_restored = client.get(f"/api/integrity/audit/{reading_id}")
    assert audit_restored.status_code == 200
    assert audit_restored.json()["tamper_detected"] is False
    assert audit_restored.json()["cryptographic_audit"]["hash_match"] is True
