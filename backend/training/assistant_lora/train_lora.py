"""Fine-tune a LoRA adapter for the ColdGuard What-If Assistant.

Needs an NVIDIA GPU (a free Google Colab T4 is enough for the 3B model; ~20-40 min for the default dataset).

    pip install -r requirements-train.txt
    python train_lora.py --data data --out coldguard-lora

Base model: Llama 3.2 3B Instruct. The adapter must be trained on the same base model that Ollama runs
(`FROM llama3.2:3b` in the Modelfile); unsloth/Llama-3.2-3B-Instruct is an ungated copy of Meta's weights.
Loss is computed only on the assistant completions (prompt/completion dataset format).
"""
from __future__ import annotations

import argparse

import torch
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="unsloth/Llama-3.2-3B-Instruct")
    ap.add_argument("--data", default="data", help="folder with train.jsonl and val.jsonl from build_dataset.py")
    ap.add_argument("--out", default="coldguard-lora")
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--lr", type=float, default=2e-4)
    ap.add_argument("--rank", type=int, default=16)
    ap.add_argument("--max-length", type=int, default=4096)
    args = ap.parse_args()

    bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    dtype = torch.bfloat16 if bf16 else torch.float16

    tokenizer = AutoTokenizer.from_pretrained(args.base)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(args.base, torch_dtype=dtype, device_map="auto")

    data = load_dataset("json", data_files={"train": f"{args.data}/train.jsonl", "validation": f"{args.data}/val.jsonl"})

    lora = LoraConfig(
        r=args.rank,
        lora_alpha=args.rank * 2,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    config = SFTConfig(
        output_dir=f"{args.out}-checkpoints",
        num_train_epochs=args.epochs,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=8,
        learning_rate=args.lr,
        lr_scheduler_type="cosine",
        warmup_ratio=0.05,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=1,
        max_length=args.max_length,
        gradient_checkpointing=True,
        bf16=bf16,
        fp16=not bf16,
        report_to="none",
    )
    trainer = SFTTrainer(
        model=model,
        args=config,
        train_dataset=data["train"],
        eval_dataset=data["validation"],
        processing_class=tokenizer,
        peft_config=lora,
    )
    trainer.train()
    print("validation:", trainer.evaluate())
    trainer.save_model(args.out)  # adapter_config.json + adapter_model.safetensors (what Ollama's ADAPTER loads)
    tokenizer.save_pretrained(args.out)
    print(f"LoRA adapter saved to {args.out}/")


if __name__ == "__main__":
    main()
