"""What-If Assistant: question parsing (rules mode) and simulation-backed answers."""
from app.services import assistant as a


def test_scenario_and_zone_parsing():
    assert a._find_scenario("what if there is a power cut") == "compressor_failure"
    assert a._find_scenario("the evaporator fan trips") == "fan_off"
    assert a._find_scenario("loading dock door left open") == "door_open"
    assert a._find_scenario("heatwave tomorrow") == "ambient_increase"
    assert a._find_scenario("refrigerant leak") == "cooling_degradation"
    assert a._find_scenario("hello there") is None
    assert a._find_zones("the dairy chiller") == ["zone-b"]
    assert a._find_zones("in all rooms") == ["zone-a", "zone-b", "zone-c"]


def test_duration_and_ambient_parsing():
    assert a._find_duration("for 45 minutes", "compressor_failure") == 45
    assert a._find_duration("a 2 hour outage", "compressor_failure") == 120
    assert a._find_duration("compressor stops", "compressor_failure") == 30
    assert a._find_duration("heatwave", "ambient_increase") is None  # persists unless told otherwise
    assert a._find_ambient_delta("heatwave of +12°c") == 12.0


def test_rules_answer_runs_real_simulation(monitor, monkeypatch):
    monkeypatch.setenv("COLDGUARD_ASSISTANT_AI", "off")
    out = a.answer(monitor, "What happens to the vaccine store during a 2 hour power cut?", [], None)
    assert out["mode"] == "rules"
    chart = out["charts"][0]
    assert chart["zone_id"] == "zone-a" and chart["scenario"] == "compressor_failure"
    assert chart["metrics"]["peak_temperature"] > chart["limits"]["upper"]
    assert "Vaccine Store A" in out["reply"] and "What to do" in out["reply"]


def test_unrecognised_question_gets_help(monitor, monkeypatch):
    monkeypatch.setenv("COLDGUARD_ASSISTANT_AI", "off")
    out = a.answer(monitor, "tell me a joke", [], None)
    assert out["charts"] == [] and "Try asking" in out["reply"]


# ---------------------------------------------------------------- LLM chain: Ollama (LoRA) -> Gemini -> rules
import json

import httpx
import pytest

from app.services import llm


class FakeProvider:
    def __init__(self, name, replies=None, error=None, available=True):
        self.name, self.replies, self.error, self._available = name, list(replies or []), error, available
        self.calls = []

    def available(self):
        return self._available

    def model(self):
        return f"{self.name}-model"

    def generate(self, system, messages, json_schema=None):
        self.calls.append((system, messages, json_schema))
        if self.error:
            raise llm.ProviderError(self.error)
        return self.replies.pop(0)


PLAN = json.dumps({"intent": "simulate", "message": "",
                   "runs": [{"zone_id": "zone-b", "scenario": "compressor_failure", "duration_minutes": 45, "ambient_delta": 15}]})


def _use(monkeypatch, *providers):
    c = llm.LLMChain()
    c.providers = list(providers)
    monkeypatch.setattr(a, "_chain", c)
    monkeypatch.setenv("COLDGUARD_ASSISTANT_AI", "auto")


def test_ollama_lora_model_plans_and_writes(monitor, monkeypatch):
    ollama = FakeProvider("ollama", [PLAN, "**Borderline** answer from LoRA model"])
    gemini = FakeProvider("gemini", [])
    _use(monkeypatch, ollama, gemini)
    out = a.answer(monitor, "compressor dies in the milk room for 45 min", [], "zone-a")
    assert out["planner"] == "ollama" and out["mode"] == "ollama" and out["model"] == "ollama-model"
    assert out["reply"].startswith("**Borderline**") and out["charts"][0]["zone_id"] == "zone-b"
    assert ollama.calls[0][2] == a.PLAN_SCHEMA            # planner asked for JSON
    assert '"simulations"' in ollama.calls[1][1][-1]["content"]  # writer received simulation results
    assert gemini.calls == []


def test_gemini_takes_over_when_ollama_fails_or_returns_bad_plan(monitor, monkeypatch):
    ollama = FakeProvider("ollama", ["not json at all"])  # bad plan -> next provider; then down for writer
    gemini = FakeProvider("gemini", [PLAN, "Gemini answer"])
    _use(monkeypatch, ollama, gemini)
    out = a.answer(monitor, "compressor dies in the milk room", [], None)
    assert out["planner"] == "gemini" and out["mode"] == "gemini" and out["reply"] == "Gemini answer"


def test_rules_when_no_model_is_reachable(monitor, monkeypatch):
    _use(monkeypatch, FakeProvider("ollama", error="down"), FakeProvider("gemini", available=False))
    out = a.answer(monitor, "what if the freezer door is left open for 20 minutes", [], None)
    assert out["planner"] == "rules" and out["mode"] == "rules"
    assert out["charts"][0]["zone_id"] == "zone-c" and "Frozen Store C" in out["reply"]


def test_parse_plan_validates_and_clamps():
    plan = a._parse_plan('Sure! {"intent":"simulate","message":"","runs":[{"zone_id":"zone-a","scenario":"fan_off","duration_minutes":0,"ambient_delta":15},{"zone_id":"zone-x","scenario":"fan_off","duration_minutes":5,"ambient_delta":15}]}')
    assert plan["runs"] == [{"zone_id": "zone-a", "scenario": "fan_off", "duration_minutes": None, "ambient_delta": 15.0}]
    with pytest.raises(ValueError):
        a._parse_plan('{"intent":"simulate","runs":[],"message":""}')


def test_provider_payloads(monkeypatch):
    sent = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        sent["url"], sent["body"], sent["headers"] = url, json, headers
        if "11434" in url:
            return httpx.Response(200, json={"message": {"content": "hi from ollama"}}, request=httpx.Request("POST", url))
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "hi from gemini"}]}}]},
                              request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    o = llm.OllamaProvider()
    monkeypatch.setattr(o, "model", lambda: "coldguard-assistant")
    assert o.generate("sys", [{"role": "user", "content": "q"}], {"type": "object"}) == "hi from ollama"
    assert sent["body"]["model"] == "coldguard-assistant" and sent["body"]["format"] == {"type": "object"}
    assert sent["body"]["messages"][0] == {"role": "system", "content": "sys"}

    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    g = llm.GeminiProvider()
    out = g.generate("sys", [{"role": "user", "content": "q"}, {"role": "assistant", "content": "a"}], a.PLAN_SCHEMA)
    assert out == "hi from gemini" and sent["headers"]["x-goog-api-key"] == "test-key"
    assert [c["role"] for c in sent["body"]["contents"]] == ["user", "model"]
    schema = sent["body"]["generationConfig"]["responseSchema"]
    assert schema["type"] == "OBJECT" and schema["properties"]["runs"]["items"]["properties"]["zone_id"]["enum"] == ["zone-a", "zone-b", "zone-c"]


def test_ollama_prefers_lora_model_then_base(monkeypatch):
    o = llm.OllamaProvider()
    monkeypatch.setattr(o, "_installed", lambda: ["llama3.2:3b", "coldguard-assistant:latest"])
    assert o.model() == "coldguard-assistant"
    o._checked_at = 0
    monkeypatch.setattr(o, "_installed", lambda: ["llama3.2:3b"])
    assert o.model() == "llama3.2:3b"
