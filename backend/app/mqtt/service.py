"""MQTT Telemetry Ingestion, Verification, and Hash-Chain Tracking Service."""
from __future__ import annotations

import json
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Callable

import paho.mqtt.client as mqtt

from app.crypto.blockchain import BlockchainLedger
from app.crypto.canonical import compute_telemetry_hash, verify_reading_hash

log = logging.getLogger("coldguard.mqtt")


class MqttService:
    """Manages MQTT subscription, cryptographic verification of readings, and blockchain batch anchoring."""

    def __init__(
        self,
        db: Any,
        blockchain: BlockchainLedger,
        monitor: Any = None,
        broker_host: str = "127.0.0.1",
        broker_port: int = 1883,
        topic: str = "coldguard/telemetry/+",
        username: str | None = None,
        password: str | None = None,
        use_tls: bool = False,
        anchor_batch_size: int = 5,
    ) -> None:
        self.db = db
        self.blockchain = blockchain
        self.monitor = monitor
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.topic = topic
        self.username = username
        self.password = password
        self.use_tls = use_tls
        self.anchor_batch_size = max(2, anchor_batch_size)

        self._lock = threading.RLock()
        self.client: mqtt.Client | None = None
        self.is_connected = False
        self.is_running = False

        # Per-device stateful tracking for replay / sequence & hash-chain validation
        # device_id -> {"last_seq": int, "last_hash": str}
        self.device_states: dict[str, dict[str, Any]] = {}
        self.pending_anchor_buffer: list[dict[str, Any]] = []

    def start(self) -> None:
        """Start the MQTT client thread with auto-reconnection and non-blocking fallback."""
        with self._lock:
            if self.is_running:
                return
            self.is_running = True

            try:
                # paho-mqtt v2 protocol compatibility
                try:
                    self.client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="coldguard-backend-verifier")
                except AttributeError:
                    self.client = mqtt.Client(client_id="coldguard-backend-verifier")

                if self.username and self.password:
                    self.client.username_pw_set(self.username, self.password)
                if self.use_tls:
                    self.client.tls_set()

                self.client.on_connect = self._on_connect
                self.client.on_disconnect = self._on_disconnect
                self.client.on_message = self._on_message

                # Connect non-blockingly
                self.client.connect_async(self.broker_host, self.broker_port, keepalive=60)
                self.client.loop_start()
                log.info("Started MQTT client attempting connection to %s:%d", self.broker_host, self.broker_port)
            except Exception as exc:
                log.warning("MQTT broker unavailable on %s:%d (%s). Service operating in internal bridge mode.", self.broker_host, self.broker_port, exc)
                self.is_connected = False

    def stop(self) -> None:
        """Stop MQTT client."""
        with self._lock:
            self.is_running = False
            if self.client:
                try:
                    self.client.loop_stop()
                    self.client.disconnect()
                except Exception:
                    pass
            self.is_connected = False
            log.info("Stopped MQTT telemetry service")

    def _on_connect(self, client: Any, userdata: Any, flags: Any, rc: Any, properties: Any = None) -> None:
        return_code = rc if isinstance(rc, int) else getattr(rc, "value", 0)
        if return_code == 0:
            self.is_connected = True
            log.info("Connected to MQTT Broker %s:%d! Subscribing to: %s", self.broker_host, self.broker_port, self.topic)
            client.subscribe(self.topic, qos=1)
        else:
            self.is_connected = False
            log.warning("MQTT connection refused with code %s", rc)

    def _on_disconnect(self, client: Any, userdata: Any, rc: Any, properties: Any = None) -> None:
        self.is_connected = False
        log.warning("Disconnected from MQTT Broker (rc=%s)", rc)

    def _on_message(self, client: Any, userdata: Any, msg: Any) -> None:
        try:
            payload_str = msg.payload.decode("utf-8")
            data = json.loads(payload_str)
            self.process_telemetry_message(data)
        except Exception as exc:
            log.error("Failed to process MQTT message on %s: %s", msg.topic, exc)

    def process_telemetry_message(self, data: dict[str, Any]) -> dict[str, Any]:
        """Verify, store, and ingest a single telemetry packet. Can be invoked directly or via MQTT."""
        with self._lock:
            dev_id = str(data.get("device_id") or data.get("sensor_id") or "TS-UNKNOWN")
            zid = str(data.get("zone_id") or "zone-a")
            seq = int(data.get("sequence_number", 0))
            claimed_hash = str(data.get("payload_hash", "")).strip()
            prev_hash = str(data.get("prev_hash", "0" * 64)).strip()
            ts = data.get("timestamp") or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

            # 1. Cryptographic SHA-256 verification of canonical payload
            is_valid_hash, computed_hash, canonical_json = verify_reading_hash(data, claimed_hash)

            # 2. Sequence consistency & Replay attack detection
            last_state = self.device_states.get(dev_id, {"last_seq": -1, "last_hash": "0" * 64})
            is_duplicate = False
            is_seq_anomaly = False
            verdict_msg = "Cryptographically verified & valid"

            if not is_valid_hash:
                status = "tampered"
                verdict_msg = f"TAMPER_DETECTED: Claimed hash {claimed_hash[:10]}... != Computed hash {computed_hash[:10]}..."
                log.warning("ALERT: Tampered telemetry packet detected from device %s! [Hash mismatch]", dev_id)
                try:
                    self.db.record_tamper_alert(
                        zone_id=zid,
                        tampered_field="payload_signature",
                        original_value=claimed_hash[:16] + "...",
                        tampered_value=computed_hash[:16] + "...",
                        source_location=f"MQTT Telemetry Gateway (Device {dev_id})",
                        telemetry_timestamp=ts,
                        device_id=dev_id,
                        notes=f"Claimed hash {claimed_hash[:12]} does not match calculated canonical SHA-256 {computed_hash[:12]}.",
                    )
                except Exception as e:
                    log.debug("Could not record tamper alert: %s", e)
            elif last_state["last_seq"] >= 0 and seq <= last_state["last_seq"]:
                status = "duplicate"
                is_duplicate = True
                verdict_msg = f"REPLAY_DETECTED: Sequence #{seq} <= previous #{last_state['last_seq']}"
                log.warning("ALERT: Duplicate/Replay telemetry packet detected from device %s (Seq #%d)", dev_id, seq)
            elif last_state["last_seq"] >= 0 and seq > last_state["last_seq"] + 1:
                status = "sequence_anomaly"
                is_seq_anomaly = True
                verdict_msg = f"SEQUENCE_GAP: Expected #{last_state['last_seq']+1}, received #{seq}"
                log.warning("Sequence gap on device %s: jumped from #%d to #%d", dev_id, last_state["last_seq"], seq)
            elif last_state["last_seq"] >= 0 and prev_hash != last_state["last_hash"] and prev_hash != ("0" * 64):
                status = "tampered"
                verdict_msg = f"HASH_CHAIN_BROKEN: prev_hash does not match previous reading hash"
                log.warning("Hash-chain broken on device %s: expected %s..., got %s...", dev_id, last_state["last_hash"][:10], prev_hash[:10])
                try:
                    self.db.record_tamper_alert(
                        zone_id=zid,
                        tampered_field="prev_hash_chain",
                        original_value=last_state["last_hash"][:16] + "...",
                        tampered_value=prev_hash[:16] + "...",
                        source_location=f"MQTT Telemetry Stream (Device {dev_id})",
                        telemetry_timestamp=ts,
                        device_id=dev_id,
                        notes="Hash-chain broken: prev_hash does not match last seen hash.",
                    )
                except Exception as e:
                    log.debug("Could not record tamper alert: %s", e)
            else:
                status = "verified"

            # 3. Store in DB
            # If verified, it also enters the readings table for ML and Digital Twin
            reading_id: int | None = None
            if status == "verified" or status == "sequence_anomaly":
                reading_payload = {
                    "zone_id": zid,
                    "sensor_id": dev_id,
                    "timestamp": ts,
                    "temperature": data.get("temperature"),
                    "humidity": data.get("humidity", 50.0),
                    "compressor_status": data.get("compressor_status", "running"),
                    "compressor_load_pct": data.get("compressor_load_pct", 80.0),
                    "door_status": data.get("door_state") or data.get("door_status") or "closed",
                    "door_open_duration_seconds": data.get("door_open_duration_seconds", 0),
                    "time_since_closure_seconds": data.get("time_since_closure_seconds", 0),
                    "ambient_temperature": data.get("ambient_temperature", 24.0),
                    "scenario": data.get("scenario", "normal"),
                    "power_consumption_kw": data.get("power_consumption_kw", 2.5),
                    "sensor_health": data.get("sensor_health", "healthy"),
                    "is_synthetic": data.get("is_synthetic", True),
                }
                reading_id = self.db.insert_reading_single(reading_payload)

                # Feed into monitoring service assessment pipeline
                if self.monitor:
                    try:
                        self.monitor._assess(zid, raise_alerts=True)
                    except Exception as e:
                        log.debug("Monitoring assessment tick error: %s", e)

            # Record integrity audit entry in database
            integrity_id = self.db.record_telemetry_verification(
                reading_id=reading_id,
                zone_id=zid,
                device_id=dev_id,
                sequence_number=seq,
                timestamp=str(ts),
                payload_hash=computed_hash,
                prev_hash=prev_hash,
                canonical_payload=canonical_json,
                verification_status=status,
                verification_message=verdict_msg,
            )

            # Update device state
            if status in ("verified", "sequence_anomaly"):
                self.device_states[dev_id] = {
                    "last_seq": seq,
                    "last_hash": computed_hash,
                }
                if reading_id:
                    self.pending_anchor_buffer.append({
                        "reading_id": reading_id,
                        "payload_hash": computed_hash,
                    })

                # Check if buffer reached anchor batch threshold
                if len(self.pending_anchor_buffer) >= self.anchor_batch_size:
                    try:
                        self.anchor_pending_batch()
                    except Exception as err:
                        log.error("Failed to anchor pending batch: %s", err)

            return {
                "integrity_id": integrity_id,
                "reading_id": reading_id,
                "device_id": dev_id,
                "sequence_number": seq,
                "verification_status": status,
                "payload_hash": computed_hash,
                "message": verdict_msg,
            }

    def anchor_pending_batch(self) -> dict[str, Any] | None:
        """Trigger Merkle tree generation and blockchain block mining for pending unanchored readings."""
        with self._lock:
            unanchored = self.db.get_unanchored_telemetry(limit=50)
            if not unanchored:
                return None

            block, tx_hash = self.blockchain.anchor_batch(unanchored)
            self.pending_anchor_buffer.clear()
            return {
                "block_height": block.block_height,
                "block_hash": block.block_hash,
                "merkle_root": block.merkle_root,
                "tx_hash": tx_hash,
                "anchored_count": len(unanchored),
            }

    def publish_telemetry(self, topic: str, data: dict[str, Any]) -> bool:
        """Publish a telemetry packet to the MQTT broker (or directly process if in fallback mode)."""
        payload_bytes = json.dumps(data).encode("utf-8")
        if self.client and self.is_connected:
            try:
                self.client.publish(topic, payload_bytes, qos=1)
                return True
            except Exception as e:
                log.warning("Failed to publish to broker (%s). Falling back to direct verification.", e)

        # Fallback direct processing
        self.process_telemetry_message(data)
        return True
