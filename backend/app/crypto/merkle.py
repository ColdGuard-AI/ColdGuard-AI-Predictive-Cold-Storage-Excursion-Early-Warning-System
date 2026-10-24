"""Cryptographic Merkle Tree implementation for ColdGuard AI batch telemetry anchoring."""
from __future__ import annotations

import hashlib
from typing import Any


def sha256_pair(left_hex: str, right_hex: str) -> str:
    """Compute SHA-256 over concatenated left and right hex hashes."""
    combined = (left_hex + right_hex).encode("utf-8")
    return hashlib.sha256(combined).hexdigest()


class MerkleTree:
    """Cryptographic Merkle tree built from a batch of leaf hashes."""

    def __init__(self, leaves: list[str]) -> None:
        self.raw_leaves = [h.lower().strip() for h in leaves]
        self.levels: list[list[str]] = []
        self._build_tree()

    def _build_tree(self) -> None:
        if not self.raw_leaves:
            empty_root = hashlib.sha256(b"").hexdigest()
            self.levels = [[empty_root]]
            return

        current = list(self.raw_leaves)
        self.levels = [current]

        while len(current) > 1:
            next_level: list[str] = []
            # If odd count, duplicate last element (standard Bitcoin/RFC Merkle practice)
            if len(current) % 2 != 0:
                current.append(current[-1])

            for i in range(0, len(current), 2):
                parent = sha256_pair(current[i], current[i + 1])
                next_level.append(parent)

            self.levels.append(next_level)
            current = next_level

    @property
    def root(self) -> str:
        """The top Merkle root hash."""
        if not self.levels or not self.levels[-1]:
            return "0" * 64
        return self.levels[-1][0]

    def get_proof(self, leaf_index: int) -> list[dict[str, str]]:
        """Generate audit proof (path of sibling hashes) for a leaf at leaf_index.
        
        Returns:
            list[dict[str, str]]: e.g. [{"position": "right", "hash": "abc..."}, ...]
        """
        if leaf_index < 0 or leaf_index >= len(self.raw_leaves):
            raise IndexError(f"Leaf index {leaf_index} out of bounds (0..{len(self.raw_leaves)-1})")

        proof: list[dict[str, str]] = []
        idx = leaf_index

        for level in self.levels[:-1]:
            level_len = len(level)
            # Account for duplicated odd element
            if level_len % 2 != 0:
                level = level + [level[-1]]

            is_right_child = (idx % 2 == 1)
            sibling_idx = idx - 1 if is_right_child else idx + 1
            sibling_hash = level[sibling_idx]

            proof.append({
                "position": "left" if is_right_child else "right",
                "hash": sibling_hash,
            })
            idx = idx // 2

        return proof

    @staticmethod
    def verify_proof(leaf_hash: str, proof: list[dict[str, str]], expected_root: str) -> bool:
        """Verify that a leaf_hash belongs to expected_root using the provided sibling path."""
        curr = leaf_hash.lower().strip()
        for step in proof:
            pos = step["position"]
            sibling = step["hash"].lower().strip()
            if pos == "left":
                curr = sha256_pair(sibling, curr)
            else:
                curr = sha256_pair(curr, sibling)
        return curr == expected_root.lower().strip()
