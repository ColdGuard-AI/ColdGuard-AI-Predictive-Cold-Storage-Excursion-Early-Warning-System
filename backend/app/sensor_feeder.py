"""Standalone IoT Sensor Telemetry Feeder for ColdGuard AI.

Reads real-time time-series packets from test_dataset.csv (or other datasets),
generates canonical SHA-256 hashes with cryptographic sequence & hash-chaining,
and streams them over MQTT (or HTTP) into ColdGuard AI's verification engine.

Usage:
    python -m app.sensor_feeder --protocol mqtt --broker localhost --port 1883
    python -m app.sensor_feeder --protocol http --url http://localhost:8000/api/integrity/publish-test
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

import pandas as pd

from app.crypto.canonical import compute_telemetry_hash

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("coldguard.feeder")


def create_mqtt_client(broker: str, port: int, username: str | None, password: str | None, use_tls: bool):
    try:
        import paho.mqtt.client as mqtt
        try:
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="coldguard-iot-feeder")
        except AttributeError:
            client = mqtt.Client(client_id="coldguard-iot-feeder")

        if username and password:
            client.username_pw_set(username, password)
        if use_tls:
            client.tls_set()

        client.connect(broker, port, keepalive=60)
        client.loop_start()
        log.info("Successfully connected to MQTT broker at %s:%d", broker, port)
        return client
    except Exception as exc:
        log.warning("Could not connect to MQTT broker (%s:%d): %s", broker, port, exc)
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="ColdGuard AI Tamper-Evident IoT Sensor Feeder")
    parser.add_argument("--protocol", type=str, default="mqtt", choices=["mqtt", "http"],
                        help="Streaming transport protocol (default: mqtt)")
    parser.add_argument("--broker", type=str, default="localhost",
                        help="MQTT broker host (default: localhost)")
    parser.add_argument("--port", type=int, default=1883,
                        help="MQTT broker port (default: 1883)")
    parser.add_argument("--topic", type=str, default="coldguard/telemetry",
                        help="MQTT base topic (default: coldguard/telemetry)")
    parser.add_argument("--username", type=str, default=None,
                        help="MQTT username")
    parser.add_argument("--password", type=str, default=None,
                        help="MQTT password")
    parser.add_argument("--tls", action="store_true",
                        help="Enable TLS for MQTT")
    parser.add_argument("--dataset", type=str, default="test", choices=["test", "train", "val", "full"],
                        help="Which dataset to stream (default: test)")
    parser.add_argument("--interval", type=float, default=1.0,
                        help="Time interval between readings in seconds (default: 1.0)")
    parser.add_argument("--url", type=str, default="http://localhost:8000/api/integrity/publish-test",
                        help="HTTP fallback / ingestion API endpoint")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max timestamps to stream (default: all)")
    parser.add_argument("--tamper-every", type=int, default=0,
                        help="Deliberately tamper with payload every N packets for demo (default: 0 = disabled)")
    args = parser.parse_args()

    filename = "synthetic_sensor_readings_full.csv" if args.dataset == "full" else f"{args.dataset}_dataset.csv"
    data_path = Path(__file__).resolve().parents[1] / "data" / "synthetic" / filename

    if not data_path.exists():
        log.error("Dataset file not found: %s", data_path)
        sys.exit(1)

    log.info("Loading sensor dataset: %s", data_path)
    df = pd.read_csv(data_path)
    if "timestamp" not in df.columns or "zone_id" not in df.columns:
        log.error("Invalid dataset schema. Requires 'timestamp' and 'zone_id'")
        sys.exit(1)

    mqtt_client = None
    if args.protocol == "mqtt":
        mqtt_client = create_mqtt_client(args.broker, args.port, args.username, args.password, args.tls)
        if not mqtt_client:
            log.info("Falling back to HTTP direct verification endpoint: %s", args.url)
            args.protocol = "http"

    unique_timestamps = sorted(df["timestamp"].unique().tolist())
    log.info("Dataset loaded: %d total rows across %d unique time steps", len(df), len(unique_timestamps))
    log.info("Protocol: %s | Interval: %.2fs | Tamper Every: %d", args.protocol.upper(), args.interval, args.tamper_every)
    print("=" * 105)
    print(f"{'TIME':<10} | {'DEVICE ID':<10} | {'SEQ':<5} | {'TEMP (°C)':<9} | {'DOOR':<6} | {'COMP':<7} | {'SHA-256 HASH':<20} | {'STATUS'}")
    print("=" * 105)

    # Per-device sequence and hash chaining
    device_states: dict[str, dict[str, Any]] = {}
    step_count = 0
    packet_counter = 0

    try:
        while True:
            for ts in unique_timestamps:
                if args.limit and step_count >= args.limit:
                    log.info("Reached limit of %d timestamps. Feeder finished.", args.limit)
                    return

                rows = df[df["timestamp"] == ts]
                now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

                for _, row in rows.iterrows():
                    packet_counter += 1
                    dev_id = str(row.get("sensor_id", "TS-01"))
                    zid = str(row["zone_id"])

                    # Fetch previous state for this device
                    prev_state = device_states.get(dev_id, {"seq": 0, "hash": "0" * 64})
                    seq = prev_state["seq"] + 1
                    prev_h = prev_state["hash"]

                    raw_temp = float(row["temperature"]) if pd.notna(row.get("temperature")) else None
                    temp = round(raw_temp, 2) if raw_temp is not None else None
                    hum = round(float(row.get("humidity", 50.0)), 2)
                    door = str(row.get("door_status", "closed")).lower()
                    comp = str(row.get("compressor_status", "running")).lower()

                    # Compute cryptographic canonical hash
                    canon_json, payload_hash = compute_telemetry_hash(
                        device_id=dev_id,
                        sequence_number=seq,
                        timestamp=now_iso,
                        temperature=temp,
                        humidity=hum,
                        door_state=door,
                        compressor_status=comp,
                        prev_hash=prev_h,
                    )

                    # Update state
                    device_states[dev_id] = {"seq": seq, "hash": payload_hash}

                    packet = {
                        "device_id": dev_id,
                        "zone_id": zid,
                        "timestamp": now_iso,
                        "sequence_number": seq,
                        "temperature": temp,
                        "humidity": hum,
                        "door_state": door,
                        "door_status": door,
                        "compressor_status": comp,
                        "prev_hash": prev_h,
                        "payload_hash": payload_hash,
                        "ambient_temperature": float(row.get("ambient_temperature", 24.0)),
                        "compressor_load_pct": float(row.get("compressor_load_pct", 80.0)),
                        "power_consumption_kw": float(row.get("power_consumption_kw", 3.0)),
                        "sensor_health": str(row.get("sensor_health", "healthy")),
                        "scenario": str(row.get("scenario", "normal")),
                    }

                    # Deliberate tamper attack simulation if enabled
                    tamper_note = "ORIGINAL"
                    if args.tamper_every > 0 and (packet_counter % args.tamper_every == 0):
                        tamper_note = "TAMPERED!"
                        packet["temperature"] = round((temp or 4.0) + 15.0, 2)
                        log.warning("Deliberately injected altered temperature on %s (Seq #%d) for tamper demonstration!", dev_id, seq)

                    # Transport: MQTT or HTTP
                    if args.protocol == "mqtt" and mqtt_client:
                        topic = f"{args.topic}/{dev_id}"
                        mqtt_client.publish(topic, json.dumps(packet), qos=1)
                    else:
                        try:
                            req = Request(
                                args.url,
                                data=json.dumps(packet).encode("utf-8"),
                                headers={"Content-Type": "application/json"},
                            )
                            with urlopen(req, timeout=5) as resp:
                                pass
                        except URLError as err:
                            pass
                        except Exception as exc:
                            pass

                    # Display formatted row
                    t_str = datetime.now().strftime("%H:%M:%S")
                    temp_disp = f"{packet['temperature']:.2f}°C" if packet['temperature'] is not None else "NULL"
                    hash_disp = f"{payload_hash[:16]}..."
                    print(f"{t_str:<10} | {dev_id:<10} | #{seq:<4} | {temp_disp:<9} | {door:<6} | {comp[:7]:<7} | {hash_disp:<20} | {tamper_note}")

                step_count += 1
                time.sleep(args.interval)

    except KeyboardInterrupt:
        log.info("Feeder stopped by user.")
    finally:
        if mqtt_client:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()


if __name__ == "__main__":
    main()
