"""Voice for the What-If Assistant: text-to-speech and a server-side speech-to-text fallback.

Languages: English (India), Hindi, Marathi.

* TTS  - Microsoft Edge neural voices via ``edge-tts`` (natural Hindi and Marathi voices that browsers usually
         lack). Needs internet. If it fails the frontend falls back to the browser's own speech synthesis.
* STT  - the frontend uses the browser's speech recognition (Chrome / Edge) first. This server fallback is for
         other browsers: Gemini (if GEMINI_API_KEY is set; good for all three languages), then local
         faster-whisper (English and Hindi only - Whisper's Marathi is not reliable enough).

Optional packages: ``pip install edge-tts`` (TTS), ``pip install faster-whisper`` (offline STT).
"""
from __future__ import annotations

import base64
import logging
import os
import re
import tempfile
import threading
from typing import Any

import httpx

from .assistant_i18n import LANG_NAMES, lang_or_default

log = logging.getLogger("coldguard.voice")

VOICES = {
    "en": os.getenv("COLDGUARD_TTS_VOICE_EN", "en-IN-NeerjaNeural"),
    "hi": os.getenv("COLDGUARD_TTS_VOICE_HI", "hi-IN-SwaraNeural"),
    "mr": os.getenv("COLDGUARD_TTS_VOICE_MR", "mr-IN-AarohiNeural"),
}
MAX_SPEECH_CHARS = 1800

SPOKEN = {
    "en": {"°C": " degrees Celsius", "/100": " out of 100", "AI": "A I"},
    "hi": {"°C": " डिग्री सेल्सियस", "/100": " (100 में से)"},
    "mr": {"°C": " अंश सेल्सिअस", "/100": " (100 पैकी)"},
}


class VoiceUnavailable(RuntimeError):
    pass


def speech_text(markdown: str, lang: str = "en") -> str:
    """Turn a Markdown answer into text that sounds natural when read aloud."""
    lang = lang_or_default(lang)
    text = re.sub(r"`([^`]*)`", r"\1", markdown)
    text = re.sub(r"^\s*#{1,6}\s*", "", text, flags=re.M)          # headings
    text = re.sub(r"^\s*[-*•]\s+", "", text, flags=re.M)            # bullets
    text = re.sub(r"^\s*(\d+)[.)]\s+", r"\1. ", text, flags=re.M)   # numbered steps
    text = re.sub(r"(\*\*|__|\*|_)(.+?)\1", r"\2", text)            # bold / italic
    for k, v in SPOKEN[lang].items():
        text = text.replace(k, v)
    if lang == "en":
        text = text.replace("~", "about ")
        text = re.sub(r"(\d) min\b", r"\1 minutes", text)
        text = re.sub(r"(\d) h\b", r"\1 hours", text)
    text = re.sub(r"(\d),(\d{3})", r"\1\2", text)                    # 186,000 -> 186000 reads better
    # One sentence per line, each ending in a full stop, so the voice pauses between points.
    stop = "." if lang == "en" else "।"
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    text = " ".join(ln if ln[-1] in ".।!?:" else ln + stop for ln in lines)
    text = re.sub(r"[ \t]+", " ", text).strip()
    if len(text) > MAX_SPEECH_CHARS:  # keep the verdict, impact and first actions
        cut = text[:MAX_SPEECH_CHARS]
        text = cut[: max(cut.rfind("."), cut.rfind("।"), MAX_SPEECH_CHARS // 2) + 1]
    return text


async def synthesize(text: str, lang: str = "en") -> bytes:
    """MP3 audio for ``text`` (plain or Markdown) in the given language."""
    try:
        import edge_tts
    except ImportError as exc:
        raise VoiceUnavailable("edge-tts is not installed (pip install edge-tts)") from exc
    lang = lang_or_default(lang)
    spoken = speech_text(text, lang)
    if not spoken:
        raise ValueError("Nothing to speak")
    audio = bytearray()
    try:
        async for chunk in edge_tts.Communicate(spoken, VOICES[lang]).stream():
            if chunk["type"] == "audio":
                audio.extend(chunk["data"])
    except Exception as exc:
        raise VoiceUnavailable(f"Text-to-speech service unavailable: {exc}") from exc
    if not audio:
        raise VoiceUnavailable("Text-to-speech returned no audio")
    return bytes(audio)


# ---------------------------------------------------------------- speech-to-text fallback
def _transcribe_gemini(audio: bytes, mime: str, lang: str) -> str:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise VoiceUnavailable("GEMINI_API_KEY not set")
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    script = "Devanagari script" if lang in ("hi", "mr") else "Latin script"
    body = {"contents": [{"role": "user", "parts": [
        {"inlineData": {"mimeType": mime, "data": base64.b64encode(audio).decode()}},
        {"text": f"Transcribe this {LANG_NAMES[lang]} speech exactly, in {script}. Write numbers as digits. "
                 "Return only the transcript, nothing else."},
    ]}], "generationConfig": {"temperature": 0}}
    res = httpx.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                     json=body, headers={"x-goog-api-key": key}, timeout=60)
    if res.status_code >= 400:
        raise VoiceUnavailable(f"Gemini HTTP {res.status_code}")
    parts = ((res.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
    return "".join(p.get("text", "") for p in parts).strip()


_whisper = None
_whisper_lock = threading.Lock()


def _transcribe_whisper(audio: bytes, lang: str) -> str:
    if lang == "mr":
        raise VoiceUnavailable("Offline Whisper is not reliable for Marathi")
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise VoiceUnavailable("faster-whisper is not installed") from exc
    global _whisper
    with _whisper_lock:
        if _whisper is None:
            _whisper = WhisperModel(os.getenv("COLDGUARD_WHISPER_MODEL", "small"), device="cpu", compute_type="int8")
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio)
            path = f.name
        try:
            prompt = "कंप्रेसर, दरवाज़ा, तापमान, मिनट, घंटे" if lang == "hi" else "compressor, door, freezer, dairy chiller, vaccine store"
            segments, _ = _whisper.transcribe(path, language=lang, beam_size=1, initial_prompt=prompt)
            return "".join(s.text for s in segments).strip()
        finally:
            os.unlink(path)


def transcribe(audio: bytes, mime: str, lang: str = "en") -> dict[str, Any]:
    lang = lang_or_default(lang)
    if not audio:
        raise ValueError("Empty audio")
    errors = []
    for name, fn in (("gemini", lambda: _transcribe_gemini(audio, mime, lang)), ("whisper", lambda: _transcribe_whisper(audio, lang))):
        try:
            text = fn()
            if text:
                return {"text": text, "engine": name, "language": lang}
            errors.append(f"{name}: empty transcript")
        except Exception as exc:
            errors.append(f"{name}: {exc}")
    raise VoiceUnavailable("; ".join(errors))


def status() -> dict[str, Any]:
    def has(mod: str) -> bool:
        try:
            __import__(mod)
            return True
        except ImportError:
            return False
    return {
        "tts": {"engine": "edge-tts", "available": has("edge_tts"), "voices": VOICES},
        "stt_server": {"gemini": bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")),
                       "whisper": has("faster_whisper")},
        "languages": list(VOICES),
    }
