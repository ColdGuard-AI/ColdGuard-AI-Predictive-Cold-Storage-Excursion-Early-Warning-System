"""Speech-to-Text transcription service powered by Whisper API (Groq, OpenAI, or custom endpoint)."""
from __future__ import annotations

import base64
import os
import time
from typing import Any
import httpx


DEFAULT_COLD_CHAIN_PROMPT = (
    "ColdGuard AI predictive cold storage monitoring, refrigeration excursion, setpoint breach. "
    "Vaccine Store A, Dairy Chiller B, Meat Freezer C, Pharma Cold Room D, Produce Staging E. "
    "Compressor, condenser, evaporator coil, defrost cycle, glycol loop, RTD sensor, degrees Celsius, "
    "ambient heatwave, power cut, door open, door ajar, WHO PQS, insulin, mRNA vaccines, biologics. "
    "मराठी आणि हिंदी भाषा समर्थन: तापमान, शीतगृह, कंप्रेसर, अलार्म, लस, धोका, कोल्ड स्टोरेज, बिजली कटौती."
)


async def transcribe_audio(
    audio_base64: str,
    provider: str = "groq",
    api_key: str | None = None,
    custom_endpoint: str | None = None,
    language: str = "en",
    prompt: str = DEFAULT_COLD_CHAIN_PROMPT,
) -> dict[str, Any]:
    """Transcribe base64 encoded audio using Whisper API."""
    start_time = time.perf_counter()

    # Strip data URL prefix if present (e.g., "data:audio/webm;base64,...")
    if "," in audio_base64:
        audio_base64 = audio_base64.split(",", 1)[1]

    try:
        audio_bytes = base64.b64decode(audio_base64)
    except Exception as exc:
        return {
            "ok": False,
            "transcript": "",
            "provider": provider,
            "error": f"Failed to decode base64 audio: {exc}",
        }

    # Resolve API Key
    effective_key = (api_key or "").strip()
    if not effective_key:
        if provider == "groq":
            effective_key = os.getenv("GROQ_API_KEY", "").strip() or os.getenv("WHISPER_API_KEY", "").strip()
        elif provider == "openai":
            effective_key = os.getenv("OPENAI_API_KEY", "").strip() or os.getenv("WHISPER_API_KEY", "").strip()
        else:
            effective_key = os.getenv("WHISPER_API_KEY", "").strip()

    # Determine endpoint and model
    if provider == "groq":
        endpoint = "https://api.groq.com/openai/v1/audio/transcriptions"
        model = "whisper-large-v3-turbo"
    elif provider == "openai":
        endpoint = "https://api.openai.com/v1/audio/transcriptions"
        model = "whisper-1"
    elif provider == "custom":
        endpoint = custom_endpoint or "http://localhost:8000/v1/audio/transcriptions"
        model = "whisper"
    else:
        endpoint = "https://api.groq.com/openai/v1/audio/transcriptions"
        model = "whisper-large-v3-turbo"

    if not effective_key and provider != "custom":
        return {
            "ok": False,
            "transcript": "",
            "provider": provider,
            "error": (
                f"No API key configured for {provider.capitalize()} Whisper. "
                "Please enter your API key in the Audio & Mic Settings modal, "
                f"or set the {provider.upper()}_API_KEY environment variable."
            ),
        }

    headers = {}
    if effective_key:
        headers["Authorization"] = f"Bearer {effective_key}"

    files = {
        "file": ("recording.webm", audio_bytes, "audio/webm"),
    }
    data = {
        "model": model,
        "language": language[:2].lower(),
        "prompt": prompt,
    }

    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            resp = await client.post(endpoint, headers=headers, files=files, data=data)

        elapsed = round((time.perf_counter() - start_time) * 1000, 1)

        if resp.status_code != 200:
            error_detail = resp.text
            try:
                error_detail = resp.json().get("error", {}).get("message", resp.text)
            except Exception:
                pass
            return {
                "ok": False,
                "transcript": "",
                "provider": provider,
                "duration_ms": elapsed,
                "error": f"{provider.capitalize()} Whisper API error ({resp.status_code}): {error_detail}",
            }

        result = resp.json()
        transcript = result.get("text", "").strip()

        return {
            "ok": True,
            "transcript": transcript,
            "provider": provider,
            "duration_ms": elapsed,
            "error": None,
        }

    except httpx.TimeoutException:
        return {
            "ok": False,
            "transcript": "",
            "provider": provider,
            "error": f"Connection to {provider} Whisper timed out after 25 seconds.",
        }
    except Exception as exc:
        return {
            "ok": False,
            "transcript": "",
            "provider": provider,
            "error": f"Failed to contact Whisper service: {exc}",
        }
