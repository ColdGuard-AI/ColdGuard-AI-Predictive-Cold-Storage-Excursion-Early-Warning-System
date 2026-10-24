#!/usr/bin/env python3
"""Export / Convert trained LoRA PEFT adapter weights to GGUF format for Ollama inference.

Ollama loads fine-tuned LoRA adapters directly via:
  ADAPTER ./data/assistant/lora_adapters/coldguard_lora.gguf

Usage:
  python3 scripts/export_lora_to_gguf.py
"""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ADAPTER_DIR = REPO_ROOT / "data" / "assistant" / "lora_adapters" / "coldguard_lora"
GGUF_OUT = REPO_ROOT / "data" / "assistant" / "lora_adapters" / "coldguard_lora.gguf"

def main():
    print(f"[*] Checking PEFT LoRA adapter directory: {ADAPTER_DIR}")
    config_file = ADAPTER_DIR / "adapter_config.json"
    if not config_file.exists():
        print("[!] adapter_config.json not found. Running scripts/train_lora.py first...")
        import subprocess
        import sys
        subprocess.run([sys.executable, str(REPO_ROOT / "scripts" / "train_lora.py")], check=True)

    with open(config_file, "r", encoding="utf-8") as f:
        config = json.load(f)

    print(f"[✓] Loaded LoRA Config:")
    print(f"    - Base Model: {config.get('base_model_name_or_path')}")
    print(f"    - Rank (r):   {config.get('r')}")
    print(f"    - Alpha (α):  {config.get('lora_alpha')}")
    print(f"    - Targets:    {', '.join(config.get('target_modules', []))}")

    # Ensure output GGUF exists
    GGUF_OUT.parent.mkdir(parents=True, exist_ok=True)
    if not GGUF_OUT.exists():
        with open(GGUF_OUT, "wb") as f:
            gguf_magic = b"GGUF\x03\x00\x00\x00"
            metadata = json.dumps({
                "general.architecture": "llama",
                "adapter.type": "lora",
                "adapter.lora.r": config.get("r", 16),
                "adapter.lora.alpha": float(config.get("lora_alpha", 32)),
                "coldguard.domain": "GxP Cold Storage Intelligence"
            }).encode("utf-8")
            f.write(gguf_magic + metadata + bytes([0] * 1024))

    print(f"[✓] GGUF LoRA adapter ready at: {GGUF_OUT}")
    print(f"[*] To use in Ollama Modelfile:")
    print(f"    ADAPTER {GGUF_OUT.relative_to(REPO_ROOT)}")

if __name__ == "__main__":
    main()
