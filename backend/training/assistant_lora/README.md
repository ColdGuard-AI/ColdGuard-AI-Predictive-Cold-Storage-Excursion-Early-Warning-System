# What-If Assistant: LoRA model for Ollama

The operator **What-If Assistant** tab answers in three steps: **plan** (which simulations to run) → **run** them
on the digital twin → **write** the answer. The plan and write steps use an LLM, tried in this order:

1. **Ollama, local** – `coldguard-assistant` (Llama 3.2 3B + this LoRA adapter). Falls back to plain
   `llama3.2:3b` if the LoRA model isn't installed.
2. **Gemini API** – used when Ollama is not running or gives an unusable answer.
3. **Built-in rules** – keyword parser + answer template; always works, no model needed.

All numbers always come from the simulator; the model only plans and explains.

## 1. Build the training data (any machine)

```bash
cd backend
python -m training.assistant_lora.build_dataset --planner 1500 --writer 500
```

Writes `training/assistant_lora/data/train.jsonl` and `val.jsonl` (≈2,000 examples, a few minutes).
Planner examples teach many phrasings → JSON plan; writer examples are built from real simulator runs.

## 2. Train the LoRA adapter (needs an NVIDIA GPU – free Google Colab T4 works)

Upload the `assistant_lora` folder (with `data/`) to Colab, then:

```bash
pip install -r requirements-train.txt
python train_lora.py --data data --out coldguard-lora
```

Download the resulting `coldguard-lora/` folder (`adapter_config.json`, `adapter_model.safetensors`) and put it
next to the `Modelfile` in this folder.

## 3. Create the Ollama model (the machine running ColdGuard)

Install Ollama from https://ollama.com/download, then:

```bash
cd backend/training/assistant_lora
ollama pull llama3.2:3b
ollama create coldguard-assistant -f Modelfile
```

Restart the backend. The assistant tab badge shows **Ollama · coldguard-assistant**.
Without training you can still run `ollama pull llama3.2:3b`; the assistant uses the base model.

## 4. Gemini fallback

Get a key at https://aistudio.google.com/apikey and set it before starting the backend:

```powershell
$env:GEMINI_API_KEY="your-key"
```

## Settings (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama server |
| `OLLAMA_MODEL` | `coldguard-assistant` | LoRA model name |
| `OLLAMA_BASE_MODEL` | `llama3.2:3b` | used if the LoRA model is missing |
| `OLLAMA_TIMEOUT_SECONDS` | `90` | per request (CPU inference is slower) |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | – | enables the Gemini fallback |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model |
| `COLDGUARD_ASSISTANT_PROVIDERS` | `ollama,gemini` | order; remove one to disable it |
| `COLDGUARD_ASSISTANT_AI` | `auto` | `off` = built-in rules only |
