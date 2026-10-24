"""Tests for ColdGuard AI independent multilingual Chatbot API."""
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.config import Settings


@pytest.fixture
def client(tmp_path):
    settings = Settings(
        db_path=tmp_path / "test_chat.db",
        artifacts_dir=tmp_path / "artifacts",
        seed_history_minutes=60,
    )
    app = create_app(cfg=settings, autostart=False)
    with TestClient(app) as c:
        yield c


def test_chat_languages_endpoint(client):
    r = client.get("/api/chat/languages")
    assert r.status_code == 200
    langs = r.json().get("languages", {})
    assert "en" in langs
    assert "mr" in langs
    assert "hi" in langs
    # Assert constrained ONLY to these three
    assert set(langs.keys()) == {"en", "mr", "hi"}


def test_chat_quick_prompts_multilingual(client):
    r_en = client.get("/api/chat/quick-prompts?lang=en")
    assert r_en.status_code == 200
    assert len(r_en.json()) > 0

    r_mr = client.get("/api/chat/quick-prompts?lang=mr")
    assert r_mr.status_code == 200
    assert any("तापमान" in p for p in r_mr.json())

    r_hi = client.get("/api/chat/quick-prompts?lang=hi")
    assert r_hi.status_code == 200
    assert any("तापमान" in p for p in r_hi.json())


def test_chat_message_english(client):
    r = client.post("/api/chat/message", json={
        "message": "What is the current temperature in Zone A?",
        "language": "en"
    })
    assert r.status_code == 200
    body = r.json()
    assert "reply" in body
    assert "speech_text" in body
    assert body["language"] == "en"
    assert "telemetry_chips" in body
    assert "lora_meta" in body


def test_chat_message_marathi(client):
    r = client.post("/api/chat/message", json={
        "message": "झोन ए चे सध्याचे तापमान किती आहे?",
        "language": "mr"
    })
    assert r.status_code == 200
    body = r.json()
    assert "reply" in body
    assert body["language"] == "mr"
    assert "तापमान" in body["reply"] or "झोन" in body["reply"]


def test_chat_message_hindi(client):
    r = client.post("/api/chat/message", json={
        "message": "क्या कोई अलर्ट एक्टिव है?",
        "language": "hi"
    })
    assert r.status_code == 200
    body = r.json()
    assert "reply" in body
    assert body["language"] == "hi"
    assert "अलर्ट" in body["reply"] or "सुरक्षित" in body["reply"]
