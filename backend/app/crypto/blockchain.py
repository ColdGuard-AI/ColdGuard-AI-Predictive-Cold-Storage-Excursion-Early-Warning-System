"""Local Development Blockchain Ledger for ColdGuard AI Tamper-Evident Telemetry Anchoring."""
from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.crypto.canonical import compute_telemetry_hash, verify_reading_hash
from app.crypto.merkle import MerkleTree

log = logging.getLogger("coldguard.blockchain")


@dataclass
class Block:
    block_height: int
    timestamp: str
    prev_block_hash: str
    merkle_root: str
    tx_hashes: list[str] = field(default_factory=list)
    nonce: int = 0
    difficulty: int = 1
    block_hash: str = ""
    status: str = "confirmed"

    @property
    def tx_count(self) -> int:
        return len(self.tx_hashes)

    def compute_hash(self) -> str:
        """Compute block hash over block header components."""
        header = f"{self.block_height}:{self.prev_block_hash}:{self.merkle_root}:{self.timestamp}:{self.nonce}:{self.difficulty}"
        return hashlib.sha256(header.encode("utf-8")).hexdigest()

    def mine(self) -> str:
        """Mine block by finding nonce satisfying difficulty prefix."""
        target_prefix = "0" * self.difficulty
        self.nonce = 0
        while True:
            h = self.compute_hash()
            if h.startswith(target_prefix):
                self.block_hash = h
                return h
            self.nonce += 1

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class BlockchainLedger:
    """Manages the local append-only blockchain ledger and Merkle anchoring."""

    def __init__(self, db: Any, difficulty: int = 1) -> None:
        self.db = db
        self.difficulty = max(1, difficulty)
        self._ensure_genesis_block()

    def _ensure_genesis_block(self) -> None:
        """Create and anchor block 0 if ledger is empty."""
        tip = self.db.get_latest_blockchain_block()
        if tip is None:
            now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            genesis = Block(
                block_height=0,
                timestamp=now_iso,
                prev_block_hash="0" * 64,
                merkle_root="0" * 64,
                tx_hashes=["GENESIS_TELEMETRY_INITIALIZATION"],
                difficulty=self.difficulty,
            )
            genesis.mine()
            self.db.save_blockchain_block(genesis)
            log.info("Initialized ColdGuard Genesis Block #0: %s", genesis.block_hash)

    def get_latest_block(self) -> Block | None:
        return self.db.get_latest_blockchain_block()

    def get_block_by_height(self, height: int) -> Block | None:
        return self.db.get_blockchain_block(height)

    def get_all_blocks(self, limit: int = 50) -> list[Block]:
        return self.db.get_blockchain_blocks(limit)

    def anchor_batch(self, unanchored_records: list[dict[str, Any]]) -> tuple[Block, str]:
        """Aggregate a batch of verified telemetry hashes into a Merkle tree and anchor to a new block.
        
        Returns:
            tuple[Block, str]: (newly_mined_block, tx_hash)
        """
        if not unanchored_records:
            raise ValueError("Cannot anchor an empty batch of telemetry records")

        leaf_hashes = [r["payload_hash"] for r in unanchored_records]
        reading_ids = [r["reading_id"] for r in unanchored_records]

        tree = MerkleTree(leaf_hashes)
        merkle_root = tree.root

        tip = self.get_latest_block()
        prev_hash = tip.block_hash if tip else ("0" * 64)
        new_height = (tip.block_height + 1) if tip else 1
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        block = Block(
            block_height=new_height,
            timestamp=now_iso,
            prev_block_hash=prev_hash,
            merkle_root=merkle_root,
            tx_hashes=leaf_hashes,
            difficulty=self.difficulty,
        )
        block.mine()

        # Anchor transaction hash identifying this batch
        tx_data = f"ANCHOR:BLOCK_{new_height}:{merkle_root}:{now_iso}:{len(leaf_hashes)}"
        tx_hash = hashlib.sha256(tx_data.encode("utf-8")).hexdigest()

        # Save block to DB
        self.db.save_blockchain_block(block)

        # Update telemetry records with their Merkle audit proofs and block confirmation
        for idx, rec in enumerate(unanchored_records):
            r_id = rec["reading_id"]
            proof = tree.get_proof(idx)
            self.db.update_telemetry_anchor(
                reading_id=r_id,
                block_height=block.block_height,
                block_hash=block.block_hash,
                tx_hash=tx_hash,
                merkle_root=merkle_root,
                merkle_proof=proof,
                merkle_index=idx,
            )

        log.info(
            "Anchored %d telemetry hashes to Block #%d [Merkle Root: %s..., Tx: %s...]",
            len(unanchored_records),
            block.block_height,
            merkle_root[:12],
            tx_hash[:12],
        )
        return block, tx_hash

    def verify_chain(self) -> dict[str, Any]:
        """Validate entire blockchain from Genesis to tip."""
        blocks = self.db.get_blockchain_blocks(limit=1000)
        # Sort ascending by height
        blocks.sort(key=lambda b: b.block_height)

        if not blocks:
            return {"valid": False, "message": "No blocks found in ledger", "block_count": 0}

        for i, b in enumerate(blocks):
            # 1. Verify block hash recalculation
            computed_hash = b.compute_hash()
            if computed_hash != b.block_hash:
                return {
                    "valid": False,
                    "message": f"Block #{b.block_height} hash mismatch: {computed_hash} != {b.block_hash}",
                    "broken_height": b.block_height,
                    "block_count": len(blocks),
                }

            # 2. Verify difficulty prefix
            if not b.block_hash.startswith("0" * b.difficulty):
                return {
                    "valid": False,
                    "message": f"Block #{b.block_height} does not satisfy difficulty requirement",
                    "broken_height": b.block_height,
                    "block_count": len(blocks),
                }

            # 3. Verify cryptographic chaining with previous block
            if i > 0:
                prev = blocks[i - 1]
                if b.prev_block_hash != prev.block_hash:
                    return {
                        "valid": False,
                        "message": f"Block #{b.block_height} broken chain: prev_hash {b.prev_block_hash} != Block #{prev.block_height} hash {prev.block_hash}",
                        "broken_height": b.block_height,
                        "block_count": len(blocks),
                    }

        return {
            "valid": True,
            "message": "Blockchain ledger integrity confirmed. All blocks cryptographically chained and valid.",
            "block_count": len(blocks),
            "tip_height": blocks[-1].block_height,
            "tip_hash": blocks[-1].block_hash,
        }

    def audit_reading(self, reading_id: int) -> dict[str, Any]:
        """Perform end-to-end cryptographic audit of a stored sensor reading."""
        raw_reading = self.db.get_reading_by_id(reading_id)
        if not raw_reading:
            return {"verified": False, "error": f"Reading with ID {reading_id} not found in database"}

        integrity_rec = self.db.get_telemetry_integrity(reading_id)
        if not integrity_rec:
            return {"verified": False, "error": f"No telemetry integrity record found for reading {reading_id}"}

        # Step 1: Recompute SHA-256 hash from database fields using canonicalization
        merged_payload = dict(raw_reading)
        if "sequence_number" not in merged_payload or merged_payload.get("sequence_number") is None:
            merged_payload["sequence_number"] = integrity_rec.get("sequence_number", 0)
        if "prev_hash" not in merged_payload or merged_payload.get("prev_hash") is None:
            merged_payload["prev_hash"] = integrity_rec.get("prev_hash", "0" * 64)
        if "device_id" not in merged_payload or merged_payload.get("device_id") is None:
            merged_payload["device_id"] = integrity_rec.get("device_id") or raw_reading.get("sensor_id")

        is_hash_valid, computed_hash, canonical_json = verify_reading_hash(
            reading_payload=merged_payload,
            expected_hash=integrity_rec["payload_hash"],
        )

        audit_steps = [
            {
                "step": "SHA-256 Payload Integrity",
                "passed": is_hash_valid,
                "expected_hash": integrity_rec["payload_hash"],
                "computed_hash": computed_hash,
                "detail": "Matches canonical reading hash" if is_hash_valid else "DATA TAMPER DETECTED: Stored reading values do not match SHA-256 signature!",
            }
        ]

        if not is_hash_valid:
            return {
                "verified": False,
                "verdict": "TAMPER_DETECTED",
                "reading_id": reading_id,
                "timestamp": raw_reading.get("timestamp"),
                "temperature": raw_reading.get("temperature"),
                "audit_steps": audit_steps,
                "error": "Cryptographic payload signature invalid. Reading was modified after ingestion!",
            }

        # Step 2: Check Merkle Anchor Proof if anchored
        is_merkle_valid = False
        block_rec = None
        if integrity_rec.get("block_height") is not None:
            b_height = integrity_rec["block_height"]
            block_rec = self.get_block_by_height(b_height)
            if block_rec:
                proof = integrity_rec.get("merkle_proof") or []
                if isinstance(proof, str):
                    try:
                        proof = json.loads(proof)
                    except Exception:
                        proof = []
                is_merkle_valid = MerkleTree.verify_proof(
                    leaf_hash=integrity_rec["payload_hash"],
                    proof=proof,
                    expected_root=block_rec.merkle_root,
                )
                audit_steps.append({
                    "step": "Blockchain Merkle Proof",
                    "passed": is_merkle_valid,
                    "block_height": b_height,
                    "block_hash": block_rec.block_hash,
                    "merkle_root": block_rec.merkle_root,
                    "detail": "Cryptographically proven included in anchored block" if is_merkle_valid else "Merkle audit path validation failed!",
                })

        # Step 3: Validate blockchain ledger
        chain_res = self.verify_chain()
        audit_steps.append({
            "step": "Blockchain Chain Validation",
            "passed": chain_res["valid"],
            "detail": chain_res["message"],
        })

        overall_valid = is_hash_valid and (is_merkle_valid or integrity_rec.get("anchor_status") == "unanchored") and chain_res["valid"]

        return {
            "verified": overall_valid,
            "verdict": "VERIFIED" if overall_valid else "INTEGRITY_COMPROMISED",
            "reading_id": reading_id,
            "device_id": integrity_rec.get("device_id"),
            "sequence_number": integrity_rec.get("sequence_number"),
            "timestamp": raw_reading.get("timestamp"),
            "temperature": raw_reading.get("temperature"),
            "anchor_status": integrity_rec.get("anchor_status"),
            "block_height": integrity_rec.get("block_height"),
            "block_hash": integrity_rec.get("block_hash"),
            "tx_hash": integrity_rec.get("tx_hash"),
            "merkle_root": integrity_rec.get("merkle_root"),
            "audit_steps": audit_steps,
        }
