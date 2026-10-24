# Blockchain-Based Tamper-Evident Telemetry Verification

ColdGuard AI integrates an enterprise-grade, cryptographically verified telemetry pipeline with a local development blockchain ledger. This ensures that IoT sensor readings from cold-storage chambers (vaccines, pharmaceuticals, biologics) cannot be silently manipulated, replayed, or spoofed.

---

## 1. Architectural Overview

```
                      [ IoT Sensor / Edge Device ]
                                   │
              1. Deterministic JSON Canonicalization
                 (temp, humidity, door, compressor, ts, seq, prev_hash)
                                   │
              2. SHA-256 Digital Signature Hashing
                                   │
                     ┌─────────────┴─────────────┐
                     ▼                           ▼
          [ MQTT Broker / TLS ]        [ Direct Fallback Bridge ]
                     │                           │
                     └─────────────┬─────────────┘
                                   │
                                   ▼
                   [ ColdGuard Backend Verifier ]
                                   │
     ┌─────────────────────────────┼─────────────────────────────┐
     ▼                             ▼                             ▼
[ SHA-256 Match? ]     [ Sequence In-Order? ]        [ Hash-Chain Intact? ]
     │                             │                             │
     └─────────────────────────────┼─────────────────────────────┘
                                   │
                       ┌───────────┴───────────┐
                       ▼                       ▼
                 [ VERIFIED ]             [ TAMPERED ]
                       │                       │
         ┌─────────────┴─────────────┐   Quarantine & Block
         ▼                           ▼   from ML / Twin Pipeline
 [ SQLite / TimescaleDB ]   [ Merkle Batch Buffer ]
         │                           │
         │                           ▼ (Batch Size >= 5)
         │                [ Merkle Tree Engine ]
         │                           │
         │                    Merkle Root Hash
         │                           │
         │                           ▼
         │             [ Local Blockchain Ledger ]
         │                 (PoW Block Mining)
         │                           │
         └───────────────────────────┴──── Anchored with Block Ref & Tx Hash
```

---

## 2. Core Cryptographic Components

### 2.1 Deterministic Payload Canonicalization
To guarantee identical hash evaluation across different runtime platforms and languages, floating-point numbers are rounded to 2 decimal places, timestamps are normalized to ISO-8601 UTC without microseconds, and dictionary keys are strictly sorted in alphabetical order before ASCII serialization:

```json
{
  "compressor_status": "running",
  "device_id": "TS-01",
  "door_state": "closed",
  "humidity": 52.4,
  "prev_hash": "a1b2c3...",
  "sequence_number": 42,
  "temperature": 4.15,
  "timestamp": "2026-10-24T12:00:00Z"
}
```

$$\text{payload\_hash} = \text{SHA-256}(\text{CanonicalJSON})$$

### 2.2 Sequence Consistency & Replay Protection
Each sensor tracks a strictly monotonic integer `sequence_number` and points to its immediate predecessor's hash (`prev_hash`). The backend detects:
- **Tampered Readings**: $\text{RecomputedHash} \ne \text{ClaimedHash}$
- **Replay / Duplicate Attacks**: $\text{sequence\_number} \le \text{last\_seen\_sequence}$
- **Sequence Gaps / Dropped Packets**: $\text{sequence\_number} > \text{last\_seen\_sequence} + 1$
- **Broken Hash Chain**: $\text{prev\_hash} \ne \text{last\_seen\_hash}$

### 2.3 Merkle Tree Batch Anchoring
Instead of placing every reading directly on-chain (which causes prohibitive gas and storage overhead in production IoT systems), readings are collected into batches. A binary Merkle tree is computed from the leaf hashes:

$$\text{Parent} = \text{SHA-256}(\text{Left} \parallel \text{Right})$$

Each reading receives a Merkle proof path $(\text{sibling\_hash}, \text{direction})$, allowing any single reading to be independently verified against the block's Merkle root in $O(\log N)$ steps.

### 2.4 Local Development Blockchain Ledger
The embedded blockchain operates without external node dependencies:
- **Block Structure**: `block_height`, `timestamp`, `prev_block_hash`, `merkle_root`, `tx_hashes`, `nonce`, `difficulty`, `block_hash`.
- **Proof-of-Work Mining**: Validates block hashes matching `0 * difficulty`.
- **Ledger Verification**: Traverses blocks from genesis (height 0) to tip, validating block hash headers and parent block hash chains.

---

## 3. Configuration

Configured via environment variables or in `backend/app/config.py`:

| Variable | Default | Description |
|---|---|---|
| `MQTT_BROKER_HOST` | `127.0.0.1` | MQTT broker hostname / IP |
| `MQTT_BROKER_PORT` | `1883` | MQTT broker port (8883 for TLS) |
| `MQTT_TOPIC` | `coldguard/telemetry/+` | Ingestion subscription topic |
| `MQTT_USERNAME` | `None` | Optional MQTT authentication username |
| `MQTT_PASSWORD` | `None` | Optional MQTT authentication password |
| `MQTT_USE_TLS` | `False` | Enable TLS encryption for secure broker transit |
| `BLOCKCHAIN_DIFFICULTY` | `1` | Proof-of-Work difficulty target |
| `BLOCKCHAIN_BATCH_SIZE` | `5` | Unanchored readings threshold for block mining |

*Note: If an external MQTT broker (e.g. Mosquitto) is not running locally, ColdGuard AI automatically activates its non-blocking internal bridge mode so tests and dashboard operations run without external setup.*

---

## 4. How to Run and Test

### 4.1 Running the IoT Sensor Feeder
Stream telemetry from synthetic sensor datasets with live SHA-256 hashing and hash chaining:

```bash
# Over MQTT (or fallback HTTP):
python -m app.sensor_feeder --protocol mqtt --broker localhost --port 1883

# With deliberate tamper attack injection every 10 packets:
python -m app.sensor_feeder --tamper-every 10
```

### 4.2 Interactive Tamper Attack Demonstration
1. Open the ColdGuard AI Live Dashboard (`http://localhost:5173`).
2. Locate the **Blockchain Telemetry Integrity** panel directly below the System Ribbon.
3. Review live stats:
   - **MQTT Ingestion Status** (Broker Connected / Internal Bridge)
   - **Payloads Verified vs Security Rejections**
   - **Blockchain Blocks Height & Latest Merkle Root**
4. Click **"Simulate Tamper Attack"**:
   - The system deliberately alters a stored temperature in the SQLite database (e.g. from 4.0°C to 28.5°C).
   - An immediate cryptographic audit is triggered.
   - The modal alerts: **"TAMPER DETECTED: Hash Mismatch"**, showing the original recorded digital signature vs the mismatched recomputed hash.
5. Click **"Restore Original Reading"**:
   - The temperature is restored to its authentic value.
   - The audit turns green: **"VERIFIED AUTHENTIC"**.

### 4.3 Running Automated Tests
```bash
cd Backend
./venv/bin/pytest tests/test_blockchain_integrity.py -v
```
