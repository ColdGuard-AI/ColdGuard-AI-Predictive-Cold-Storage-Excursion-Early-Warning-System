"""LLM providers for the What-If Assistant: local Ollama (LoRA fine-tuned model) first, Gemini API as fallback.

Both providers expose the same call: ``generate(system, messages, json_schema=None) -> str``.
When ``json_schema`` is given the provider is asked for JSON that matches it.

Configuration (environment variables):
  OLLAMA_HOST               http://127.0.0.1:11434
  OLLAMA_MODEL              coldguard-assistant   (the LoRA model built from training/assistant_lora)
  OLLAMA_BASE_MODEL         llama3.2:3b           (used when the LoRA model is not installed)
  OLLAMA_TIMEOUT_SECONDS    90
  GEMINI_API_KEY / GOOGLE_API_KEY
  GEMINI_MODEL              gemini-2.5-flash
  COLDGUARD_ASSISTANT_PROVIDERS  ollama,gemini     (order; remove one to disable it)
"""
from __future__ import annotations

import logging
import os
import time
from typing import Any

import httpx

log = logging.getLogger("coldguard.llm")


class ProviderError(RuntimeError):
    pass


class OllamaProvider:
    name = "ollama"

    def __init__(self) -> None:
        self.host = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
        self.preferred = os.getenv("OLLAMA_MODEL", "coldguard-assistant")
        self.base = os.getenv("OLLAMA_BASE_MODEL", "llama3.2:3b")
        self.timeout = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "90"))
        self._model: str | None = None
        self._checked_at = 0.0

    def _installed(self) -> list[str]:
        res = httpx.get(f"{self.host}/api/tags", timeout=2.0)
        res.raise_for_status()
        return [m.get("name", "") for m in res.json().get("models", [])]

    @staticmethod
    def _has(installed: list[str], wanted: str) -> bool:
        want = wanted if ":" in wanted else f"{wanted}:latest"
        return want in installed or wanted in installed

    def model(self) -> str | None:
        """The LoRA model if installed, else the base model; None if Ollama is not reachable. Cached 30 s."""
        if time.monotonic() - self._checked_at < 30:
            return self._model
        try:
            installed = self._installed()
            self._model = next((m for m in (self.preferred, self.base) if self._has(installed, m)), None)
        except Exception:
            self._model = None
        self._checked_at = time.monotonic()
        return self._model

    def available(self) -> bool:
        return self.model() is not None

    def generate(self, system: str, messages: list[dict[str, str]], json_schema: dict | None = None) -> str:
        model = self.model()
        if not model:
            raise ProviderError("Ollama is not running or no model is installed")
        body: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "system", "content": system}, *messages],
            "stream": False,
            "options": {"temperature": 0.2, "num_ctx": 8192},
        }
        if json_schema:
            body["format"] = json_schema
        try:
            res = httpx.post(f"{self.host}/api/chat", json=body, timeout=self.timeout)
            res.raise_for_status()
        except httpx.HTTPError as exc:
            self._checked_at = 0.0  # re-check availability next time
            raise ProviderError(f"Ollama request failed: {exc}") from exc
        text = (res.json().get("message") or {}).get("content", "").strip()
        if not text:
            raise ProviderError("Ollama returned an empty response")
        return text


def _to_gemini_schema(schema: dict) -> dict:
    """Convert the JSON Schema subset we use into Gemini's OpenAPI-style Schema object."""
    out: dict[str, Any] = {}
    t = schema.get("type")
    if t:
        out["type"] = t.upper()
    for key in ("enum", "required", "description"):
        if key in schema:
            out[key] = schema[key]
    if "properties" in schema:
        out["properties"] = {k: _to_gemini_schema(v) for k, v in schema["properties"].items()}
        out["propertyOrdering"] = list(schema["properties"])
    if "items" in schema:
        out["items"] = _to_gemini_schema(schema["items"])
    return out


class GeminiProvider:
    name = "gemini"
    URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

    def __init__(self) -> None:
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
        self.timeout = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "60"))

    @staticmethod
    def _key() -> str | None:
        return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

    def model(self) -> str | None:
        return self.model_name if self._key() else None

    def available(self) -> bool:
        return self._key() is not None

    def generate(self, system: str, messages: list[dict[str, str]], json_schema: dict | None = None) -> str:
        key = self._key()
        if not key:
            raise ProviderError("GEMINI_API_KEY is not set")
        config: dict[str, Any] = {"temperature": 0.2}
        if json_schema:
            config["responseMimeType"] = "application/json"
            config["responseSchema"] = _to_gemini_schema(json_schema)
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages
            ],
            "generationConfig": config,
        }
        url = self.URL.format(model=self.model_name)
        for attempt in range(2):
            try:
                res = httpx.post(url, json=body, headers={"x-goog-api-key": key}, timeout=self.timeout)
            except httpx.HTTPError as exc:
                if attempt == 0:
                    continue
                raise ProviderError(f"Gemini request failed: {exc}") from exc
            if res.status_code in (429, 500, 502, 503) and attempt == 0:
                time.sleep(2)
                continue
            if res.status_code >= 400:
                raise ProviderError(f"Gemini HTTP {res.status_code}: {res.text[:200]}")
            data = res.json()
            parts = ((data.get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
            text = "".join(p.get("text", "") for p in parts).strip()
            if not text:
                reason = (data.get("candidates") or [{}])[0].get("finishReason") or data.get("promptFeedback")
                raise ProviderError(f"Gemini returned no text ({reason})")
            return text
        raise ProviderError("Gemini request failed")


class LLMChain:
    """Tries each configured provider in order; returns (text, provider name)."""

    def __init__(self) -> None:
        registry = {"ollama": OllamaProvider, "gemini": GeminiProvider}
        order = [p.strip() for p in os.getenv("COLDGUARD_ASSISTANT_PROVIDERS", "ollama,gemini").split(",") if p.strip()]
        self.providers = [registry[p]() for p in order if p in registry]

    def generate(self, system: str, messages: list[dict[str, str]], json_schema: dict | None = None,
                 validate: Any = None) -> tuple[Any, str]:
        """``validate`` may parse/check the text and raise to move on to the next provider."""
        errors = []
        for p in self.providers:
            if not p.available():
                continue
            try:
                text = p.generate(system, messages, json_schema)
                return (validate(text) if validate else text), p.name
            except Exception as exc:
                log.warning("%s failed: %s", p.name, exc)
                errors.append(f"{p.name}: {exc}")
        raise ProviderError("; ".join(errors) or "no LLM provider available")

    def status(self) -> dict[str, Any]:
        return {p.name: {"available": p.available(), "model": p.model()} for p in self.providers}
