"""Independent Chatbot API Routes for ColdGuard AI.

Provides conversational AI, STT (Whisper API), and TTS voice synthesis
supporting English, Marathi (मराठी), and Hindi (हिंदी).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.chat_service import QUICK_PROMPTS, SUPPORTED_LANGUAGES, chat_expert
from app.services.monitor import MonitoringService
from app.services.transcription import transcribe_audio

log = logging.getLogger("coldguard.chat_routes")
router = APIRouter(tags=["chat"])


def get_monitor(request: Request) -> MonitoringService:
    return request.app.state.monitor


class ChatMessageRequest(BaseModel):
    message: str = Field(..., description="User query or message")
    history: list[dict[str, str]] = Field(default_factory=list, description="Past conversation turns")
    language: str = Field("en", description="Target language: 'en', 'mr' (Marathi), 'hi' (Hindi)")


class ChatVoiceRequest(BaseModel):
    audio_base64: str = Field(..., description="Base64 encoded microphone audio recording")
    language: str = Field("en", description="Target spoken language: 'en', 'mr' (Marathi), 'hi' (Hindi)")
    history: list[dict[str, str]] = Field(default_factory=list, description="Past conversation turns")
    provider: Optional[str] = Field("groq", description="Whisper provider: 'groq' or 'openai' or 'custom'")
    api_key: Optional[str] = Field(None, description="Optional API key for Whisper provider")
    custom_endpoint: Optional[str] = Field(None, description="Optional custom Whisper HTTP endpoint URL")


@router.post("/message")
async def send_chat_message(
    body: ChatMessageRequest,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    """Process a natural language user query about temperatures, alerts, or cold-chain rules."""
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    clean_lang = body.language.lower().split("-")[0]
    if clean_lang not in SUPPORTED_LANGUAGES:
        clean_lang = "en"

    return await chat_expert.generate_response(
        message=body.message,
        conversation_history=body.history,
        target_lang=clean_lang,
        monitor=monitor,
    )


@router.post("/voice")
async def send_voice_message(
    body: ChatVoiceRequest,
    monitor: MonitoringService = Depends(get_monitor),
) -> dict[str, Any]:
    """Transcribe spoken audio via Whisper and answer in English, Marathi, or Hindi."""
    clean_lang = body.language.lower().split("-")[0]
    if clean_lang not in SUPPORTED_LANGUAGES:
        clean_lang = "en"

    whisper_prompt = (
        "ColdGuard AI predictive cold storage monitoring, refrigeration excursion, setpoint breach. "
        "Vaccine Store A, Dairy Chiller B, Meat Freezer C, Pharma Cold Room D, Produce Staging E. "
        "Compressor, condenser, evaporator coil, defrost cycle, glycol loop, RTD sensor, degrees Celsius, "
        "ambient heatwave, power cut, door open, door ajar, WHO PQS, insulin, mRNA vaccines, biologics. "
        "मराठी आणि हिंदी भाषा समर्थन: तापमान, शीतगृह, कंप्रेसर, अलार्म, लस, धोका, कोल्ड स्टोरेज, बिजली कटौती."
    )

    # 1. Transcribe audio with Whisper
    transcription = await transcribe_audio(
        audio_base64=body.audio_base64,
        provider=body.provider or "groq",
        api_key=body.api_key,
        custom_endpoint=body.custom_endpoint,
        language=clean_lang,
        prompt=whisper_prompt,
    )

    if not transcription.get("ok"):
        return {
            "ok": False,
            "error": transcription.get("error", "Speech transcription failed"),
            "transcript": "",
            "reply": "Could not understand audio. Please try again or type your question.",
            "speech_text": "Could not understand audio. Please try again.",
            "language": clean_lang,
        }

    user_text = transcription.get("transcript", "").strip()
    if not user_text:
        return {
            "ok": False,
            "error": "No speech detected in audio.",
            "transcript": "",
            "reply": "No speech recognized. Please speak clearly into your microphone.",
            "speech_text": "No speech recognized.",
            "language": clean_lang,
        }

    # 2. Generate answer
    ans = await chat_expert.generate_response(
        message=user_text,
        conversation_history=body.history,
        target_lang=clean_lang,
        monitor=monitor,
    )

    return {
        "ok": True,
        "transcript": user_text,
        **ans,
    }


@router.get("/quick-prompts")
def get_quick_prompts(lang: str = "en") -> list[str]:
    """Return multilingual quick prompt suggestions for English, Marathi, or Hindi."""
    clean_lang = lang.lower().split("-")[0]
    return QUICK_PROMPTS.get(clean_lang, QUICK_PROMPTS["en"])


@router.get("/languages")
def get_chat_languages() -> dict[str, Any]:
    """Return metadata for the three supported languages: English, Marathi, and Hindi."""
    return {"languages": SUPPORTED_LANGUAGES}
