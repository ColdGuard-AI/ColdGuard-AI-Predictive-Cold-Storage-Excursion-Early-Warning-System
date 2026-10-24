"""Fine-tuning script for ColdGuard AI LoRA Cold-Chain Expert Model directly using synthetic CSV data.

Uses HuggingFace PEFT, transformers, and bitsandbytes for QLoRA fine-tuning:
Base model: meta-llama/Llama-3.2-3B-Instruct or Qwen/Qwen2.5-3B-Instruct
Source Data: Calibrated physics CSV files in backend/data/synthetic/ (train_dataset.csv, etc.)
Task: Instruction fine-tuning on cold-chain thermal risk scenarios, compound parameter extraction,
      and regulatory SOP generation (WHO TRS 961, FDA 21 CFR Part 211).
"""
import argparse
import json
import os
from pathlib import Path
from typing import Any

import pandas as pd


def extract_lora_samples_from_synthetic_csv(
    csv_path: Path,
    output_jsonl: Path,
    max_samples: int = 1000,
) -> int:
    """Read calibrated sensor readings CSV from synthetic folder and generate instruction-tuning pairs."""
    if not csv_path.exists():
        print(f"[ERROR] Synthetic CSV not found at: {csv_path}")
        return 0

    print(f"Loading synthetic CSV from: {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"Loaded {len(df)} records across zones: {df['zone_id'].unique().tolist()}")

    zone_products = {
        "zone-a": "Vaccines & Critical Biologics",
        "zone-b": "Perishable Dairy & Produce",
        "zone-c": "Deep Freeze Pharmaceuticals",
    }
    zone_limits = {
        "zone-a": {"lower": 2.0, "upper": 8.0, "std": "WHO TRS 961 Annex 9 / FDA 21 CFR 211"},
        "zone-b": {"lower": 0.5, "upper": 6.5, "std": "FDA PMO Section 7 / EU 853/2004"},
        "zone-c": {"lower": -25.0, "upper": -15.0, "std": "Codex Alimentarius CAC/RCP 46-1999"},
    }

    pairs: list[dict[str, Any]] = []

    # 1. Filter for distinct scenario events in the synthetic dataset
    scenarios = [s for s in df["scenario"].dropna().unique() if s != "normal"]
    for sc in scenarios:
        sc_df = df[df["scenario"] == sc]
        # Sample slices across different zones
        for zid in ["zone-a", "zone-b", "zone-c"]:
            z_slice = sc_df[sc_df["zone_id"] == zid]
            if z_slice.empty:
                continue

            for _, row in z_slice.head(max_samples // (len(scenarios) * 3) + 5).iterrows():
                t = round(float(row.get("temperature", 5.0)), 1)
                amb = round(float(row.get("ambient_temperature", 25.0)), 1)
                comp = str(row.get("compressor_status", "running"))
                door = str(row.get("door_status", "closed"))
                prod = zone_products.get(zid, "Cold storage goods")
                meta = zone_limits.get(zid, {"lower": 2.0, "upper": 8.0, "std": "GDP"})

                # Build natural question
                if sc == "compressor_failure":
                    question = f"What happens if compressor cooling fails in {zid} ({prod}) while ambient is {amb}°C and current temp is {t}°C?"
                    compounds = ["Zero active heat lift", f"Conduction driven by {amb - t:+.1f}°C ambient gradient"]
                elif sc == "door_open":
                    question = f"What if the cold room door is left propped open in {zid} holding {prod}?"
                    compounds = ["Convective air infiltration", "Vapor barrier moisture ingress"]
                elif sc == "ambient_heatwave" or sc == "ambient_increase":
                    question = f"How will {zid} respond if a severe summer heatwave pushes ambient to {amb}°C for an extended period?"
                    compounds = ["Elevated thermal envelope conduction", "Condenser heat rejection derate"]
                elif sc == "cooling_degradation":
                    question = f"What if the refrigeration unit in {zid} loses refrigerant and drops to half capacity?"
                    compounds = ["Reduced coefficient of performance (COP)", "Evaporator icing"]
                else:
                    question = f"How does a {sc.replace('_', ' ')} incident affect {prod} in {zid} at {t}°C?"
                    compounds = ["Operational anomaly"]

                response_obj = {
                    "scenario": "compressor_failure" if sc == "compressor_failure" else ("ambient_increase" if "ambient" in sc else sc),
                    "duration_minutes": 60,
                    "ambient_delta": round(max(5.0, amb - 22.0), 1),
                    "compound_effects": compounds,
                    "regulatory_standard": meta["std"],
                    "critical_threshold": meta["upper"],
                    "recommended_action": f"Immediate verification of {sc.replace('_', ' ')} and containment under {meta['std']}",
                }

                pairs.append({
                    "instruction": "Extract cold storage simulation parameters, compound physical vectors, and regulatory standard from user query.",
                    "input": question,
                    "output": json.dumps(response_obj),
                })

    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with open(output_jsonl, "w", encoding="utf-8") as f:
        for p in pairs:
            f.write(json.dumps(p) + "\n")

    print(f"Successfully generated {len(pairs)} instruction pairs from synthetic CSV into: {output_jsonl}")
    return len(pairs)


def main():
    parser = argparse.ArgumentParser(description="Train LoRA adapter for ColdGuard AI What-If Simulator using synthetic CSV data")
    parser.add_argument("--base_model", type=str, default="meta-llama/Llama-3.2-3B-Instruct", help="Base LLM architecture")
    parser.add_argument("--synthetic_csv", type=str, default="backend/data/synthetic/train_dataset.csv", help="Synthetic CSV dataset file")
    parser.add_argument("--dataset_path", type=str, default="backend/training/whatif_lora_dataset.jsonl", help="Output/Input JSONL dataset path")
    parser.add_argument("--output_dir", type=str, default="backend/app/models/lora_weights", help="Output adapter weights dir")
    parser.add_argument("--rank", type=int, default=16, help="LoRA rank r")
    parser.add_argument("--alpha", type=int, default=32, help="LoRA alpha")
    parser.add_argument("--epochs", type=int, default=3, help="Training epochs")
    parser.add_argument("--batch_size", type=int, default=4, help="Batch size per device")
    args = parser.parse_args()

    print("=" * 70)
    print("ColdGuard AI - LoRA Fine-Tuning Pipeline on Synthetic CSV Data")
    print("=" * 70)
    print(f"Base Model:       {args.base_model}")
    print(f"Synthetic CSV:    {args.synthetic_csv}")
    print(f"Dataset Path:     {args.dataset_path}")
    print(f"Output Directory: {args.output_dir}")
    print(f"LoRA Config:      r={args.rank}, alpha={args.alpha}, dropout=0.05")
    print(f"Target Modules:   ['q_proj', 'v_proj', 'k_proj', 'o_proj']")
    print("-" * 70)

    # 1. Ensure instruction dataset exists from synthetic CSV
    csv_file = Path(args.synthetic_csv)
    jsonl_file = Path(args.dataset_path)
    if not jsonl_file.exists() or csv_file.exists():
        extract_lora_samples_from_synthetic_csv(csv_file, jsonl_file)

    try:
        import torch
        from datasets import load_dataset
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, TrainingArguments
        from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
        from trl import SFTTrainer

        print("[1/5] Checking CUDA device and environment...")
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"Device: {device} (VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB)" if device == "cuda" else "Device: CPU")

        print("[2/5] Configuring 4-bit QLoRA Quantization...")
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
            bnb_4bit_use_double_quant=True,
        ) if device == "cuda" else None

        print(f"[3/5] Loading tokenizer and base model: {args.base_model}...")
        tokenizer = AutoTokenizer.from_pretrained(args.base_model, use_fast=True)
        tokenizer.pad_token = tokenizer.eos_token

        model_kwargs = {"quantization_config": bnb_config} if bnb_config else {}
        model = AutoModelForCausalLM.from_pretrained(
            args.base_model,
            device_map="auto" if device == "cuda" else None,
            **model_kwargs
        )
        if device == "cuda":
            model = prepare_model_for_kbit_training(model)

        print("[4/5] Injecting Low-Rank Decomposition Adapters (PEFT LoRA)...")
        peft_config = LoraConfig(
            r=args.rank,
            lora_alpha=args.alpha,
            lora_dropout=0.05,
            bias="none",
            task_type="CAUSAL_LM",
            target_modules=["q_proj", "v_proj", "k_proj", "o_proj"],
        )
        model = get_peft_model(model, peft_config)
        model.print_trainable_parameters()

        print(f"[5/5] Loading fine-tuning dataset generated from {args.synthetic_csv}...")
        dataset = load_dataset("json", data_files=str(jsonl_file), split="train")

        training_args = TrainingArguments(
            output_dir=args.output_dir,
            num_train_epochs=args.epochs,
            per_device_train_batch_size=args.batch_size,
            gradient_accumulation_steps=2,
            learning_rate=2e-4,
            weight_decay=0.01,
            warmup_ratio=0.05,
            logging_steps=10,
            save_strategy="epoch",
            fp16=(device == "cuda" and not torch.cuda.is_bf16_supported()),
            bf16=(device == "cuda" and torch.cuda.is_bf16_supported()),
        )

        def formatting_func(example):
            return f"### System: You are ColdGuard AI's cold-chain risk expert trained on calibrated physical simulation data.\n### User: {example['input']}\n### Assistant: {example['output']}"

        trainer = SFTTrainer(
            model=model,
            train_dataset=dataset,
            peft_config=peft_config,
            formatting_func=formatting_func,
            max_seq_length=512,
            tokenizer=tokenizer,
            args=training_args,
        )

        print("Starting training loop...")
        trainer.train()

        print(f"Saving fine-tuned LoRA adapter weights to: {args.output_dir}")
        trainer.model.save_pretrained(args.output_dir)
        tokenizer.save_pretrained(args.output_dir)
        print("LoRA training successfully completed on synthetic CSV dataset!")

    except ImportError as e:
        print(f"[NOTE] Training prerequisites (torch, peft, transformers, trl) not installed in current light venv: {e}")
        print("To run local training on a GPU machine, install:")
        print("  pip install torch transformers peft bitsandbytes datasets trl accelerate")
        print(f"\nColdGuard AI What-If Simulator will directly ingest synthetic CSV files from {args.synthetic_csv} in production.")


if __name__ == "__main__":
    main()
