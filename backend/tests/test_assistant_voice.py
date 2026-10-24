"""What-If Assistant: Hindi/Marathi understanding, translated answers, and voice (TTS / STT) endpoints."""
import pytest

from app.services import assistant as a
from app.services import voice


@pytest.mark.parametrize("question,lang,zone,scenario,minutes", [
    ("अगर डेयरी का कंप्रेसर 45 मिनट बंद रहे तो क्या होगा?", "hi", "zone-b", "compressor_failure", 45),
    ("वैक्सीन स्टोर में दो घंटे बिजली गुल रहे तो?", "hi", "zone-a", "compressor_failure", 120),
    ("फ्रीजरचे दार २० मिनिटे उघडे राहिले तर?", "mr", "zone-c", "door_open", 20),
    ("लस साठवण कक्षात अर्धा तास वीज गेली तर काय होईल?", "mr", "zone-a", "compressor_failure", 30),
    ("डेअरी चिलरचा पंखा बंद पडला तर", "mr", "zone-b", "fan_off", 30),
    ("घर पर भाषा 30 मिनट खुल रहा तो क्या होगा", "hi", "zone-a", "door_open", 30),  # misheard "दरवाजा"
])
def test_hindi_marathi_questions_are_understood(question, lang, zone, scenario, minutes):
    plan = a.rules_plan(question, None, lang)
    assert plan["intent"] == "simulate"
    assert plan["runs"][0] == {"zone_id": zone, "scenario": scenario, "duration_minutes": minutes, "ambient_delta": 15.0}


def test_indic_status_and_all_rooms():
    assert a.rules_plan("सध्याची स्थिती काय आहे", None, "mr")["intent"] == "status"
    plan = a.rules_plan("सभी कमरों में बाहर का तापमान 12 डिग्री बढ़े तो?", None, "hi")
    assert [r["zone_id"] for r in plan["runs"]] == ["zone-a", "zone-b", "zone-c"]
    assert plan["runs"][0]["scenario"] == "ambient_increase" and plan["runs"][0]["ambient_delta"] == 12.0


@pytest.mark.parametrize("lang,heading,todo", [("hi", "क्या होगा अगर", "**क्या करें**"), ("mr", "जर असे झाले तर", "**काय करावे**")])
def test_answers_in_hindi_and_marathi(monitor, monkeypatch, lang, heading, todo):
    monkeypatch.setenv("COLDGUARD_ASSISTANT_AI", "off")
    out = a.answer(monitor, "vaccine store power cut for 2 hours", [], None, lang)
    assert out["language"] == lang and heading in out["reply"] and todo in out["reply"]
    assert "Inspect the compressor" not in out["reply"]  # recommendations translated too
    assert out["charts"][0]["scenario"] == "compressor_failure"


def test_writer_prompt_asks_for_language():
    assert "Marathi" in a.writer_system_prompt("mr") and "लस साठवण कक्ष A" in a.writer_system_prompt("mr")
    assert "Answer language: Hindi" in a.planner_user_message("q", "zone-a", "hi")


def test_speech_text_reads_naturally():
    md = "### What if\n**Critical: ~45 min left at 9.1°C.**\n- Risk **86/100**, up to $186,000.\n1. Close the door."
    assert voice.speech_text(md, "en") == ("What if. Critical: about 45 minutes left at 9.1 degrees Celsius. "
                                          "Risk 86 out of 100, up to $186000. 1. Close the door.")
    assert "डिग्री सेल्सियस" in voice.speech_text("तापमान 5°C", "hi")
    assert "अंश सेल्सिअस" in voice.speech_text("तापमान 5°C", "mr")


def test_tts_and_transcribe_endpoints(client, monkeypatch):
    async def fake_synth(text, lang):
        assert lang == "mr"
        return b"ID3fake-mp3"
    monkeypatch.setattr(voice, "synthesize", fake_synth)
    res = client.post("/api/assistant/tts", json={"text": "नमस्कार", "language": "mr"})
    assert res.status_code == 200 and res.headers["content-type"] == "audio/mpeg" and res.content == b"ID3fake-mp3"
    assert client.post("/api/assistant/tts", json={"text": "x", "language": "fr"}).status_code == 422

    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    res = client.post("/api/assistant/transcribe?language=mr", content=b"RIFFdata", headers={"content-type": "audio/wav"})
    assert res.status_code == 503 and "Marathi" in res.json()["detail"]

    monkeypatch.setattr(voice, "_transcribe_whisper", lambda audio, lang: "what if the door is left open")
    res = client.post("/api/assistant/transcribe?language=en", content=b"RIFFdata", headers={"content-type": "audio/wav"})
    assert res.json() == {"text": "what if the door is left open", "engine": "whisper", "language": "en"}


def test_what_if_endpoint_language(client, monkeypatch):
    monkeypatch.setenv("COLDGUARD_ASSISTANT_AI", "off")
    res = client.post("/api/assistant/what-if", json={"message": "फ्रीजरचे दार 20 मिनिटे उघडे राहिले तर?", "language": "mr"})
    assert res.status_code == 200 and res.json()["language"] == "mr" and "गोठवलेला साठा कक्ष C" in res.json()["reply"]
