"""What-If Assistant: answers free-text "what will happen if ...?" questions for facility operators.

Every number in an answer comes from the project's own physics simulator + trained forecaster
(``MonitoringService.what_if``) and the live facility state, never from guesswork.

Every answer is produced in three steps:
1. **Plan**   - turn the question into a list of simulations to run (structured JSON).
2. **Run**    - execute them on the digital twin (or read live facility status).
3. **Write**  - explain the results to the operator in plain language.

Steps 1 and 3 use an LLM, tried in order (see ``llm.py``):
  local Ollama model fine-tuned with LoRA (``training/assistant_lora``) -> Gemini API -> built-in rules.
The built-in rules (keyword parser + answer template) need no model at all, so the tab always works.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from app.simulator.engine import SCENARIOS
from app.simulator.zones import ZONES

from . import assistant_i18n as I18N
from .llm import LLMChain

log = logging.getLogger("coldguard.assistant")

MAX_RUNS_PER_QUESTION = 4
MAX_HISTORY_MESSAGES = 12

# Scenarios the physics engine can project (sensor_anomaly only corrupts readings, so it is excluded).
SIM_SCENARIOS = [k for k in SCENARIOS if k != "sensor_anomaly"]

SCENARIO_KEYWORDS: list[tuple[str, list[str]]] = [
    ("fire_runaway", ["fire", "smoke", "burn", "thermal runaway", "short circuit"]),
    ("fan_off", ["fan", "evaporator", "blower"]),
    ("compressor_failure", ["compressor", "power cut", "power outage", "power failure", "outage", "blackout",
                            "electricity", "load shedding", "generator", "refrigeration stop", "cooling stop",
                            "cooling fail", "refrigeration fail", "trip"]),
    ("door_open", ["door", "loading", "unloading", "left open", "dock"]),
    ("ambient_increase", ["heatwave", "heat wave", "ambient", "hot day", "summer", "outside temp", "weather",
                          "hot weather", "temperature outside", "heat"]),
    ("cooling_degradation", ["degrad", "refrigerant", "leak", "gas", "condenser", "coil", "slow cooling",
                             "efficiency", "dirty", "maintenance"]),
    ("abnormal_humidity", ["humid", "monsoon", "moisture", "rain", "condensation"]),
    ("normal", ["nothing changes", "normal operation", "if nothing", "baseline"]),
]

ZONE_KEYWORDS = {
    "zone-a": ["zone a", "zone-a", "room a", "store a", "vaccine", "insulin", "pharma", "biologic"],
    "zone-b": ["zone b", "zone-b", "room b", "chiller b", "dairy", "milk", "yoghurt", "yogurt", "cheese"],
    "zone-c": ["zone c", "zone-c", "room c", "store c", "frozen", "freezer", "ice cream", "meat"],
}


# ----------------------------------------------------------------------------- simulation helpers
def _zone_name(zone_id: str) -> str:
    return ZONES[zone_id].name if zone_id in ZONES else zone_id


def run_simulation(monitor: Any, zone_id: str, scenario: str, duration_minutes: int | None = 30,
                   ambient_delta: float = 15.0, projection_minutes: int = 90) -> dict[str, Any]:
    """Run the project's what-if engine and return (compact summary for text, chart payload for UI)."""
    if zone_id not in ZONES:
        raise ValueError(f"Unknown zone '{zone_id}'. Valid zones: {', '.join(ZONES)}")
    if scenario not in SIM_SCENARIOS:
        raise ValueError(f"Unknown scenario '{scenario}'. Valid: {', '.join(SIM_SCENARIOS)}")
    projection_minutes = int(min(max(projection_minutes or 90, 30), 240))
    if duration_minutes is not None:
        duration_minutes = int(min(max(duration_minutes, 1), 240))
        projection_minutes = max(projection_minutes, min(240, duration_minutes + 45))
    ambient_delta = float(min(max(ambient_delta or 15.0, 1.0), 30.0))

    raw = monitor.what_if(zone_id, scenario, duration_minutes, ambient_delta, projection_minutes)
    cfg = ZONES[zone_id]
    sc, base = raw["scenario_result"], raw["baseline"]
    start = next((h["temperature"] for h in reversed(raw["history"]) if h["temperature"] is not None), None)
    above_spoil = [p for p in sc["points"] if p["temperature"] > cfg.spoilage_threshold]
    summary = {
        "zone_id": zone_id,
        "zone_name": cfg.name,
        "product": cfg.product,
        "scenario": scenario,
        "scenario_label": raw["scenario_label"],
        "duration_minutes": duration_minutes,
        "ambient_delta_c": ambient_delta if scenario == "ambient_increase" else None,
        "projection_minutes": projection_minutes,
        "current_temperature_c": start,
        "safe_range_c": [cfg.lower_limit, cfg.upper_limit],
        "setpoint_c": cfg.setpoint,
        "scenario_outcome": {
            "peak_temperature_c": sc["max_temperature"],
            "lowest_temperature_c": sc["min_temperature"],
            "final_temperature_c": sc["final_temperature"],
            "minutes_until_limit_breached": sc["time_to_limit_minutes"],
            "limit_breached": sc["limit_side"],
            "ai_first_warning_minute": sc["ai_first_warning_minute"],
            "ai_warning_lead_time_minutes": sc["ai_lead_time_minutes"],
            "peak_risk_score": sc["peak_risk"],
        },
        "if_nothing_changes": {
            "peak_temperature_c": base["max_temperature"],
            "minutes_until_limit_breached": base["time_to_limit_minutes"],
            "peak_risk_score": base["peak_risk"],
        },
        "product_impact": {
            "spoilage_threshold_c": cfg.spoilage_threshold,
            "exceeds_spoilage_threshold": bool(above_spoil),
            "minutes_above_spoilage_threshold": len(above_spoil),
            "first_minute_above_spoilage_threshold": above_spoil[0]["minute"] if above_spoil else None,
            "inventory_value_at_risk_usd": cfg.inventory_value_usd if above_spoil else 0,
            "total_inventory_value_usd": cfg.inventory_value_usd,
            "vulnerable_items": cfg.vulnerable_items,
            "spoilage_mechanism": cfg.spoilage_mechanism,
        },
        "recommended_actions": raw["recommendations"] or I18N.EXTRA_RECOMMENDATIONS.get(scenario, []),
    }
    chart = {
        "zone_id": zone_id,
        "zone_name": cfg.name,
        "scenario": scenario,
        "scenario_label": raw["scenario_label"],
        "duration_minutes": duration_minutes,
        "limits": raw["limits"],
        "spoilage_threshold": cfg.spoilage_threshold,
        "points": [
            {"minute": s["minute"], "scenario": s["temperature"], "baseline": b["temperature"]}
            for s, b in zip(sc["points"], base["points"])
        ],
        "metrics": {
            "peak_temperature": sc["max_temperature"],
            "time_to_limit_minutes": sc["time_to_limit_minutes"],
            "ai_lead_time_minutes": sc["ai_lead_time_minutes"],
            "peak_risk": sc["peak_risk"],
            "inventory_at_risk_usd": summary["product_impact"]["inventory_value_at_risk_usd"],
        },
    }
    return {"summary": summary, "chart": chart}


def facility_status(monitor: Any) -> list[dict[str, Any]]:
    out = []
    for zid, cfg in ZONES.items():
        z = monitor.zone_summary(zid)
        out.append({
            "zone_id": zid,
            "name": cfg.name,
            "product": cfg.product,
            "temperature_c": z.get("temperature"),
            "safe_range_c": [cfg.lower_limit, cfg.upper_limit],
            "status": z.get("temperature_status"),
            "active_scenario": z.get("scenario_label"),
            "compressor": z.get("compressor_status"),
            "door": z.get("door_status"),
            "trend_c_per_hour": z.get("trend_per_hour"),
            "risk_score": z.get("risk_score"),
            "risk_category": z.get("risk_category"),
            "minutes_to_predicted_breach": z.get("time_to_breach_minutes"),
            "active_alerts": z.get("active_alert_count"),
            "inventory_value_usd": cfg.inventory_value_usd,
        })
    return out


# ----------------------------------------------------------------------------- prompts (shared with LoRA training)
PLAN_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "intent": {"type": "string", "enum": ["simulate", "status", "other"]},
        "runs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "zone_id": {"type": "string", "enum": list(ZONES)},
                    "scenario": {"type": "string", "enum": SIM_SCENARIOS},
                    "duration_minutes": {"type": "integer"},
                    "ambient_delta": {"type": "number"},
                },
                "required": ["zone_id", "scenario", "duration_minutes", "ambient_delta"],
            },
        },
        "message": {"type": "string"},
    },
    "required": ["intent", "runs", "message"],
}


def planner_system_prompt() -> str:
    zones = "\n".join(f"- {z}: {c.name} ({c.product}), safe {c.lower_limit} to {c.upper_limit}°C" for z, c in ZONES.items())
    scenarios = "\n".join(f"- {k}: {SCENARIOS[k]}" for k in SIM_SCENARIOS)
    return f"""You plan digital-twin simulations for ColdGuard AI, a cold-storage monitoring system.
Read the operator's question and reply with JSON only, matching the schema.
The question may be in English, Hindi or Marathi (Devanagari or romanised), e.g. "बिजली गई" / "वीज गेली" = power cut,
"दरवाजा खुला" / "दार उघडे" = door open, "डेयरी/डेअरी/दूध" = dairy chiller, "लस/वैक्सीन" = vaccine store,
"फ्रीजर" = frozen store, "मिनट/मिनिटे" = minutes, "घंटे/तास" = hours.

Cold rooms:
{zones}

Scenarios the simulator can run:
{scenarios}

Rules:
- intent "simulate": the question asks what would happen if something occurs. Add one run per room and scenario
  (max {MAX_RUNS_PER_QUESTION}). Map everyday words: power cut/blackout/outage -> compressor_failure;
  heatwave/hot day -> ambient_increase; refrigerant leak/dirty condenser/ageing unit -> cooling_degradation;
  fan or blower trip -> fan_off; door left open/loading -> door_open; monsoon/humid air -> abnormal_humidity;
  electrical fire -> fire_runaway. A combined event (e.g. power cut during a heatwave) becomes one run per part.
  To compare durations, add one run per duration.
- duration_minutes: how long the problem lasts (1-240); 0 means it is not fixed. Default 30 for sudden failures,
  0 for heatwave, humidity and cooling degradation.
- ambient_delta: outside temperature rise in °C for ambient_increase (default 15); use 15 for other scenarios.
- If no room is named, use the operator's selected room, or all rooms if they say "all"/"every room".
- intent "status": they ask about the current situation. runs = [].
- intent "other": anything else. runs = [] and put a short helpful reply in message.
- message: empty string unless intent is "other"; then write it in the answer language given with the question."""


def planner_user_message(message: str, zone_id: str | None, lang: str = "en") -> str:
    selected = f"\n(Operator's selected room: {zone_id} = {_zone_name(zone_id)})" if zone_id in ZONES else ""
    return f"{message}{selected}\n(Answer language: {I18N.LANG_NAMES[lang]})"


def writer_system_prompt(lang: str = "en") -> str:
    language = ""
    if lang != "en":
        names = ", ".join(f"{c.name} = {I18N.zone_name(z, c.name, lang)}" for z, c in ZONES.items())
        language = (f"\n\nWrite the whole answer in {I18N.LANG_NAMES[lang]} (Devanagari script), in simple words a floor "
                    f"technician understands. Keep numbers as digits and temperatures in °C. Room names: {names}.")
    return """You are the What-If Assistant inside ColdGuard AI, a cold-storage monitoring system. You explain digital-twin
simulation results to facility operators and maintenance technicians.

Use ONLY the numbers in the provided results; never invent figures. Write Markdown, concise, for someone on the facility floor:
1. One bold line with the verdict and the key time, e.g. "**Critical: Vaccine Store A leaves its safe range in ~18 minutes.**"
2. "**Impact**" with 3-5 bullets: peak temperature vs if nothing changes, when the safe limit is breached,
   when the AI would first warn, product/spoilage impact and stock value at risk.
3. "**What to do**" as numbered practical steps, most urgent first.
For several runs, cover each room/scenario briefly and say which is worst. For a combined event, note that together
the effects would be worse than either alone. For status results, summarise each room in one line and flag any risk.
Use °C. End with one short line saying these are simulated projections from the digital twin.""" + language


def writer_user_message(question: str, results: dict[str, Any]) -> str:
    return f"Operator question: {question}\n\nSimulation results (JSON):\n{json.dumps(results, default=str)}"


def _history_messages(history: list[dict[str, str]]) -> list[dict[str, str]]:
    msgs = [{"role": m["role"], "content": m["content"]} for m in history[-MAX_HISTORY_MESSAGES:]
            if m.get("role") in ("user", "assistant") and m.get("content")]
    while msgs and msgs[0]["role"] != "user":
        msgs.pop(0)
    return msgs


def _parse_plan(text: str) -> dict[str, Any]:
    """Parse and sanity-check an LLM plan; raises so the chain can try the next provider."""
    m = re.search(r"\{.*\}", text, re.S)
    data = json.loads(m.group(0) if m else text)
    intent = data.get("intent")
    if intent not in ("simulate", "status", "other"):
        raise ValueError(f"bad intent {intent!r}")
    runs = []
    for r in (data.get("runs") or [])[:MAX_RUNS_PER_QUESTION]:
        if r.get("zone_id") in ZONES and r.get("scenario") in SIM_SCENARIOS:
            dur = int(r.get("duration_minutes") or 0)
            runs.append({"zone_id": r["zone_id"], "scenario": r["scenario"],
                         "duration_minutes": None if dur <= 0 else min(dur, 240),
                         "ambient_delta": float(r.get("ambient_delta") or 15.0)})
    if intent == "simulate" and not runs:
        raise ValueError("simulate plan without valid runs")
    return {"intent": intent, "runs": runs, "message": str(data.get("message") or "")}


# ----------------------------------------------------------------------------- rules mode
def _normalise(text: str) -> str:
    return text.lower().translate(I18N.DEVANAGARI_DIGITS)


def _find_zones(text: str) -> list[str]:
    if re.search(r"\b(all|every|each)\s+(zones?|rooms?|stores?|chambers?)\b|\bwhole facility\b", text) \
            or any(w in text for w in I18N.ALL_ZONES_INDIC):
        return list(ZONES)
    return [z for z, words in ZONE_KEYWORDS.items()
            if any(w in text for w in words + I18N.ZONE_KEYWORDS_INDIC.get(z, []))]


def _has_whole_word(text: str, word: str) -> bool:
    return re.search(rf"(?<![ऀ-ॿ]){re.escape(word)}(?![ऀ-ॿ])", text) is not None


def _find_scenario(text: str) -> str | None:
    for scenario, words in SCENARIO_KEYWORDS:
        if any(w in text for w in words + I18N.SCENARIO_KEYWORDS_INDIC.get(scenario, []))                 or any(_has_whole_word(text, w) for w in I18N.SCENARIO_WHOLE_WORDS_INDIC.get(scenario, [])):
            return scenario
    return None


# Slow, weather-like conditions persist unless the user gives a duration.
PERSISTENT_SCENARIOS = {"ambient_increase", "cooling_degradation", "abnormal_humidity"}

_UNITS = r"(hours?|hrs?|h\b|minutes?|mins?|m\b|घंट\S*|तास\S*|मिनट\S*|मिनिट\S*)"


def _is_hours(unit: str) -> bool:
    return unit.startswith("h") or unit.startswith(I18N.HOUR_UNITS_INDIC)


def _find_duration(text: str, scenario: str) -> int | None:
    text = _normalise(text)
    m = re.search(r"(\d+(?:\.\d+)?)\s*" + _UNITS, text)
    if m:
        value = float(m.group(1))
        return int(round(value * 60 if _is_hours(m.group(2)) else value))
    words = "|".join(sorted(map(re.escape, I18N.NUMBER_WORDS), key=len, reverse=True))
    m = re.search(rf"({words})\s*" + _UNITS, text)
    if m:
        value = I18N.NUMBER_WORDS[m.group(1)]
        return int(round(value * 60 if _is_hours(m.group(2)) else value))
    if scenario in PERSISTENT_SCENARIOS or re.search(r"\b(never fixed|indefinitely|not fixed|whole day|all day)\b", text):
        return None
    return 30


def _find_ambient_delta(text: str) -> float:
    text = _normalise(text)
    m = re.search(r"(?:\+|by\s+|rise[s]?\s+(?:of\s+)?)?(\d+(?:\.\d+)?)\s*(?:°|deg|degrees?|डिग्री|अंश)", text)
    return float(m.group(1)) if m else 15.0


def _fmt_minutes(m: float | None, lang: str = "en") -> str:
    if m is None:
        return "—"
    t = I18N.T[lang]
    return t["min"].format(n=f"{m:.0f}") if m < 90 else t["hours"].format(h=f"{round(m / 60, 1):g}")


def _rules_text(s: dict[str, Any], lang: str = "en") -> str:
    t = I18N.T[lang]
    o, b, p = s["scenario_outcome"], s["if_nothing_changes"], s["product_impact"]
    lo, hi = s["safe_range_c"]
    zone = I18N.zone_name(s["zone_id"], s["zone_name"], lang)
    fm = lambda v: _fmt_minutes(v, lang)  # noqa: E731
    dur = t["dur_for"].format(d=fm(s["duration_minutes"])) if s["duration_minutes"] else t["ongoing"]
    extra = t["extra"].format(x=f"{s['ambient_delta_c']:.0f}") if s.get("ambient_delta_c") else ""
    ttl = o["minutes_until_limit_breached"]
    if p["exceeds_spoilage_threshold"]:
        verdict = t["critical"].format(zone=zone, t=f"{p['spoilage_threshold_c']:.0f}", m=fm(p["first_minute_above_spoilage_threshold"]))
    elif ttl is not None:
        verdict = t["warning"].format(zone=zone, m=fm(ttl))
    elif (o["peak_risk_score"] or 0) >= 60 or o["peak_temperature_c"] >= hi - 0.3 or o["lowest_temperature_c"] <= lo + 0.3:
        verdict = t["borderline"].format(zone=zone, p=f"{o['peak_temperature_c']:.1f}", l=f"{hi:g}")
    else:
        verdict = t["safe"].format(zone=zone, lo=f"{lo:g}", hi=f"{hi:g}")
    lines = [
        t["title"].format(scenario=I18N.scenario_name(s["scenario"], s["scenario_label"], lang), zone=zone, dur=dur, extra=extra),
        verdict,
        "",
        t["impact"],
        t["temp"].format(start=f"{s['current_temperature_c']:.1f}", peak=f"{o['peak_temperature_c']:.1f}", base=f"{b['peak_temperature_c']:.1f}"),
        (t["range_breached"].format(lo=f"{lo:g}", hi=f"{hi:g}", side=t.get(o["limit_breached"] or "upper", o["limit_breached"]), m=fm(ttl))
         if ttl is not None else t["range_ok"].format(lo=f"{lo:g}", hi=f"{hi:g}")),
    ]
    if o["ai_first_warning_minute"] is not None:
        lead = t["lead"].format(m=fm(o["ai_warning_lead_time_minutes"])) if o["ai_warning_lead_time_minutes"] is not None else ""
        lines.append(t["ai_warn"].format(w=o["ai_first_warning_minute"], lead=lead))
    if o["peak_risk_score"] is not None:
        lines.append(t["risk"].format(r=o["peak_risk_score"], b=b["peak_risk_score"]))
    if p["exceeds_spoilage_threshold"]:
        product = I18N.product_name(s["zone_id"], s["product"].lower(), lang)
        lines.append(t["product_loss"].format(t=f"{p['spoilage_threshold_c']:g}", n=p["minutes_above_spoilage_threshold"],
                                              v=f"{p['inventory_value_at_risk_usd']:,}", product=product,
                                              mechanism=p["spoilage_mechanism"].split(";")[0]))
    else:
        lines.append(t["product_ok"].format(t=f"{p['spoilage_threshold_c']:g}"))
    if s["recommended_actions"]:
        lines += ["", t["todo"]] + [f"{i}. {I18N.recommendation(a, lang)}" for i, a in enumerate(s["recommended_actions"], 1)]
    return "\n".join(lines)


HELP_TEXT = I18N.T["en"]["help"]


def help_text(lang: str = "en") -> str:
    return I18N.T[lang]["help"]


def rules_plan(message: str, zone_id: str | None, lang: str = "en") -> dict[str, Any]:
    """Keyword-based planner used when no LLM is available. Understands English, Hindi and Marathi."""
    text = _normalise(message)
    scenario = _find_scenario(text)
    if scenario is None:
        if re.search(r"\b(status|current|right now|how (is|are)|overview|situation|risk)\b", text) \
                or any(w in text for w in I18N.STATUS_INDIC):
            return {"intent": "status", "runs": [], "message": ""}
        return {"intent": "other", "runs": [], "message": I18N.T[lang]["not_understood"] + "\n\n" + help_text(lang)}
    zones = _find_zones(text) or ([zone_id] if zone_id in ZONES else ["zone-a"])
    duration = _find_duration(text, scenario)
    delta = _find_ambient_delta(text) if scenario == "ambient_increase" else 15.0
    return {"intent": "simulate", "message": "",
            "runs": [{"zone_id": z, "scenario": scenario, "duration_minutes": duration, "ambient_delta": delta}
                     for z in zones][:MAX_RUNS_PER_QUESTION]}


def execute_plan(monitor: Any, plan: dict[str, Any]) -> dict[str, Any]:
    """Run the planned simulations (or read status). Returns results for the writer and charts for the UI."""
    if plan["intent"] == "status":
        return {"results": {"facility_status": facility_status(monitor)}, "charts": []}
    if plan["intent"] != "simulate":
        return {"results": {}, "charts": []}
    summaries, charts = [], []
    for r in plan["runs"]:
        dur = r["duration_minutes"]
        projection = 180 if dur is None else (120 if dur > 60 else 90)
        sim = run_simulation(monitor, r["zone_id"], r["scenario"], dur, r["ambient_delta"], projection)
        summaries.append(sim["summary"])
        charts.append(sim["chart"])
    return {"results": {"simulations": summaries}, "charts": charts}


def rules_write(plan: dict[str, Any], results: dict[str, Any], lang: str = "en") -> str:
    """Template answer (no LLM). Also the target text for LoRA training examples."""
    t = I18N.T[lang]
    if plan["intent"] == "other":
        return plan["message"] or help_text(lang)
    if plan["intent"] == "status":
        lines = [t["status_title"]]
        for r in results["facility_status"]:
            temp = f"{r['temperature_c']:.1f}°C" if r["temperature_c"] is not None else t["no_reading"]
            ttb = t["status_ttb"].format(m=_fmt_minutes(r["minutes_to_predicted_breach"], lang)) if r["minutes_to_predicted_breach"] is not None else ""
            lines.append(t["status_line"].format(
                name=I18N.zone_name(r["zone_id"], r["name"], lang), t=temp, lo=f"{r['safe_range_c'][0]:g}",
                hi=f"{r['safe_range_c'][1]:g}", r=r["risk_score"], cat=r["risk_category"] or "", ttb=ttb, a=r["active_alerts"]))
        lines.append(t["status_footer"])
        return "\n".join(lines)
    parts = [_rules_text(s, lang) for s in results["simulations"]]
    parts.append(t["disclaimer"])
    return "\n\n".join(parts)


# ----------------------------------------------------------------------------- entry point
_chain: LLMChain | None = None


def chain() -> LLMChain:
    global _chain
    if _chain is None:
        _chain = LLMChain()
    return _chain


def llm_status() -> dict[str, Any]:
    providers = chain().status()
    active = next((name for name, p in providers.items() if p["available"]), None)
    return {"providers": providers, "active": active or "rules", "ai_enabled": active is not None}


NOTICE_TEMPLATE_USED = {
    "en": "The AI model could not write this answer, so it uses the built-in template.",
    "hi": "AI मॉडल यह उत्तर नहीं लिख सका, इसलिए अंतर्निहित टेम्पलेट का उपयोग किया गया है।",
    "mr": "AI मॉडेल हे उत्तर लिहू शकले नाही, म्हणून अंगभूत साचा वापरला आहे.",
}


def answer(monitor: Any, message: str, history: list[dict[str, str]] | None = None,
           zone_id: str | None = None, language: str = "en") -> dict[str, Any]:
    lang = I18N.lang_or_default(language)
    history = _history_messages(history or [])
    use_llm = os.getenv("COLDGUARD_ASSISTANT_AI", "auto") != "off"
    notice = None

    # 1. Plan
    planner, plan = "rules", None
    if use_llm:
        try:
            plan, planner = chain().generate(
                planner_system_prompt(), history + [{"role": "user", "content": planner_user_message(message, zone_id, lang)}],
                json_schema=PLAN_SCHEMA, validate=_parse_plan)
        except Exception as exc:
            log.info("LLM planner unavailable (%s); using keyword planner", exc)
    if plan is None:
        plan = rules_plan(message, zone_id, lang)

    # 2. Run
    executed = execute_plan(monitor, plan)

    # 3. Write
    writer, reply = "rules", None
    if use_llm and plan["intent"] == "other" and planner != "rules":
        reply, writer = plan["message"] or help_text(lang), planner
    elif use_llm and plan["intent"] != "other":
        try:
            reply, writer = chain().generate(
                writer_system_prompt(lang),
                history + [{"role": "user", "content": writer_user_message(message, executed["results"])}])
        except Exception as exc:
            log.info("LLM writer unavailable (%s); using template", exc)
            if planner != "rules":
                notice = NOTICE_TEMPLATE_USED[lang]
    if reply is None:
        reply = rules_write(plan, executed["results"], lang)

    model = chain().status().get(writer, {}).get("model") if writer != "rules" else None
    return {"reply": reply, "charts": executed["charts"], "mode": writer, "planner": planner,
            "model": model, "notice": notice, "language": lang}
