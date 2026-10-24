"""Build the LoRA fine-tuning dataset for the What-If Assistant from the ColdGuard digital twin.

The assistant's model does two jobs at run time (see app/services/assistant.py), so the dataset has two kinds of
examples, each using the exact same system prompt and message format as production:

* planner - operator question  -> JSON plan (which simulations to run). Labels come from the generator itself,
            so the model learns many phrasings, not just the keyword rules.
* writer  - question + simulation results JSON -> grounded Markdown answer. Results come from REAL simulator runs
            (starting from varied room states); the target text is the deterministic template, so every number in
            the training answers is correct.

Output: prompt/completion JSONL (conversational format understood by TRL's SFTTrainer):
    {"prompt": [{"role": "system", ...}, {"role": "user", ...}], "completion": [{"role": "assistant", ...}]}

Usage (from the backend folder):
    python -m training.assistant_lora.build_dataset --planner 1500 --writer 500
"""
from __future__ import annotations

import argparse
import json
import logging
import random
import sys
import tempfile
import warnings
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND.parent))

from app.config import Settings  # noqa: E402
from app.database.db import Database  # noqa: E402
from app.models.registry import load_or_train  # noqa: E402
from app.services import assistant as A  # noqa: E402
from app.services.monitor import MonitoringService  # noqa: E402
from app.simulator.zones import ZONES  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent / "data"

ROOM_PHRASES = {
    "zone-a": ["Vaccine Store A", "the vaccine store", "zone A", "the vaccine room", "the pharma cold room", "room A", "the insulin and vaccine store"],
    "zone-b": ["Dairy Chiller B", "the dairy chiller", "zone B", "the milk room", "the dairy room", "room B", "the cheese and yoghurt chiller"],
    "zone-c": ["Frozen Store C", "the freezer", "zone C", "the frozen store", "the deep freezer", "room C", "the frozen food room"],
}
ALL_ROOMS = ["all rooms", "every room", "all three cold rooms", "the whole facility", "each chamber"]

SCENARIO_PHRASES = {
    "compressor_failure": ["the compressor fails", "there is a power cut", "the compressor trips", "we lose power",
                           "the refrigeration unit stops", "there's a blackout", "the compressor breaks down",
                           "load shedding cuts the power", "the cooling unit shuts down"],
    "door_open": ["the door is left open", "someone leaves the door open", "the loading door stays open",
                  "the door gets propped open during unloading", "staff forget to close the door"],
    "ambient_increase": ["there is a heatwave", "outside temperature rises by {delta}°C", "it gets {delta} degrees hotter outside",
                         "a hot summer afternoon pushes ambient up {delta}°C", "the weather heats up by {delta}°C"],
    "cooling_degradation": ["the refrigerant leaks", "the condenser coils get dirty", "cooling capacity degrades",
                            "the refrigeration unit gets old and weak", "there's a slow gas leak"],
    "fan_off": ["the evaporator fan trips", "the cooling fan stops", "the blower fails", "the evaporator fan motor burns out"],
    "abnormal_humidity": ["humid monsoon air gets in", "humidity rises abnormally", "moisture leaks into the room"],
    "fire_runaway": ["there is an electrical fire nearby", "a fire starts near the room", "there's a thermal runaway event"],
    "normal": ["nothing changes", "everything keeps running normally"],
}
TEMPLATES = [
    "What if {event} in {room}{dur}?",
    "What happens to {room} if {event}{dur}?",
    "what will happen if {event} in {room}{dur}",
    "{event_cap} in {room}{dur}. What's the impact?",
    "How bad is it if {event} in {room}{dur}?",
    "If {event}{dur}, how long until {room} goes out of range?",
    "Simulate: {event} in {room}{dur}",
    "Should I worry if {event} in {room}{dur}?",
]
NO_ROOM_TEMPLATES = ["What if {event}{dur}?", "what happens if {event}{dur}", "Impact if {event}{dur}?"]
STATUS_QUESTIONS = ["What is the current status of the facility?", "How are the cold rooms doing right now?",
                    "Give me an overview of all rooms", "Is any room at risk at the moment?", "current situation?",
                    "Which room is closest to breaching its limit?"]
OTHER_QUESTIONS = [
    ("hello", "Hi! Ask me what would happen to any cold room, e.g. *What if the compressor fails in the dairy chiller for 30 minutes?*"),
    ("thanks", "You're welcome. Ask me another what-if question any time."),
    ("who are you?", "I'm the ColdGuard What-If Assistant. I run digital-twin simulations to show what would happen to a cold room if something goes wrong, and what to do about it."),
    ("tell me a joke", "I only handle cold-storage questions. Try: *What if the freezer door is left open for 20 minutes?*"),
    ("what's the weather in Pune?", "I can't check the weather, but I can simulate a heatwave. Try: *What if it gets 12°C hotter outside?*"),
    ("the sensor in room A is faulty, what now?", "A faulty sensor corrupts readings rather than changing the real temperature, so I can't simulate it. Verify the reading with a calibrated probe and check Equipment & Sensor Health."),
]
PERSISTENT = {"ambient_increase", "cooling_degradation", "abnormal_humidity"}

# ---- Hindi / Marathi phrasings (questions are answered in the same language)
INDIC = {
    "hi": {
        "rooms": {"zone-a": ["वैक्सीन स्टोर", "वैक्सीन रूम", "दवा वाला कोल्ड रूम"], "zone-b": ["डेयरी चिलर", "दूध वाला कमरा", "डेयरी रूम"],
                  "zone-c": ["फ्रीज़र", "फ्रोज़न स्टोर", "फ्रीजर रूम"]},
        "all": ["सभी कमरों", "सारे कमरों"],
        "events": {
            "compressor_failure": ["कंप्रेसर बंद हो जाए", "बिजली चली जाए", "कंप्रेसर खराब हो जाए"],
            "door_open": ["दरवाज़ा खुला रह जाए", "कोई दरवाज़ा खुला छोड़ दे"],
            "ambient_increase": ["बाहर गर्मी बढ़ जाए", "बाहर का तापमान {delta} डिग्री बढ़ जाए"],
            "cooling_degradation": ["गैस लीक हो जाए", "कंडेंसर गंदा हो जाए"],
            "fan_off": ["पंखा बंद हो जाए", "इवैपोरेटर का पंखा खराब हो जाए"],
            "abnormal_humidity": ["नमी बहुत बढ़ जाए", "मानसून की नम हवा अंदर आ जाए"],
            "fire_runaway": ["पास में आग लग जाए"],
        },
        "dur": {"min": "{n} मिनट", "hour": "{n} घंटे"},
        "templates": ["अगर {room} में {dur}{event} तो क्या होगा?", "{room} में {dur}{event} तो असर क्या होगा?"],
        "all_templates": ["अगर {room} में {dur}{event} तो क्या होगा?"],
        "status": ["सुविधा की वर्तमान स्थिति क्या है?", "अभी सभी कमरों की हालत कैसी है?"],
        "other": [("नमस्ते", "नमस्ते! किसी भी कोल्ड रूम के बारे में पूछें, जैसे: *अगर डेयरी चिलर का कंप्रेसर 30 मिनट बंद रहे तो क्या होगा?*")],
    },
    "mr": {
        # Marathi rooms in locative form ("in the ... room")
        "rooms": {"zone-a": ["लस साठवण कक्षात", "लसीच्या कक्षात", "औषधांच्या शीतकक्षात"], "zone-b": ["डेअरी चिलरमध्ये", "दुधाच्या कक्षात"],
                  "zone-c": ["फ्रीजरमध्ये", "गोठवलेल्या साठा कक्षात"]},
        "all": ["सर्व कक्षांमध्ये", "सगळ्या कक्षांमध्ये"],
        "events": {
            "compressor_failure": ["कंप्रेसर बंद पडला", "वीज गेली", "कंप्रेसर बिघडला"],
            "door_open": ["दार उघडे राहिले", "कोणी दार उघडे ठेवले"],
            "ambient_increase": ["बाहेर उष्णता वाढली", "बाहेरचे तापमान {delta} अंशांनी वाढले"],
            "cooling_degradation": ["गॅस गळती झाली", "कंडेन्सर खराब झाला"],
            "fan_off": ["पंखा बंद पडला", "इव्हॅपोरेटरचा पंखा बिघडला"],
            "abnormal_humidity": ["आर्द्रता खूप वाढली", "पावसाळ्याची दमट हवा आत आली"],
            "fire_runaway": ["जवळ आग लागली"],
        },
        "dur": {"min": "{n} मिनिटे", "hour": "{n} तास"},
        "templates": ["{room} {dur}{event} तर काय होईल?", "जर {room} {dur}{event} तर परिणाम काय?"],
        "all_templates": ["{room} {dur}{event} तर काय होईल?"],
        "status": ["सुविधेची सद्यस्थिती काय आहे?", "सध्या सर्व कक्षांची स्थिती कशी आहे?"],
        "other": [("नमस्कार", "नमस्कार! कोणत्याही शीतकक्षाबद्दल विचारा, उदा. *डेअरी चिलरचा कंप्रेसर 30 मिनिटे बंद पडला तर काय होईल?*")],
    },
}


def make_indic_example(rng: random.Random, lang: str) -> tuple[str, str, dict]:
    v = INDIC[lang]
    scenario = rng.choice(list(v["events"]))
    phrase = rng.choice(v["events"][scenario])
    delta = float(rng.choice([5, 8, 10, 12, 15])) if "{delta}" in phrase else 15.0
    event = phrase.format(delta=f"{delta:g}")
    minutes = 0 if scenario in PERSISTENT else 30
    dur = ""
    if rng.random() < 0.7 and not (scenario in PERSISTENT and rng.random() < 0.5):
        minutes = rng.choice([10, 20, 30, 45, 60, 120])
        dur = (v["dur"]["hour"].format(n=minutes // 60) if minutes >= 60 else v["dur"]["min"].format(n=minutes)) + " "
    selected = rng.choice(list(ZONES))
    if rng.random() < 0.15:
        zones = list(ZONES)
        q = rng.choice(v["all_templates"]).format(room=rng.choice(v["all"]), dur=dur, event=event)
    else:
        z = rng.choice(list(ZONES))
        zones = [z]
        q = rng.choice(v["templates"]).format(room=rng.choice(v["rooms"][z]), dur=dur, event=event)
    plan = {"intent": "simulate", "message": "",
            "runs": [{"zone_id": z, "scenario": scenario, "duration_minutes": minutes, "ambient_delta": delta} for z in zones]}
    return q, selected, plan


def duration_phrase(rng: random.Random, scenario: str) -> tuple[str, int]:
    """Returns (text, duration in minutes; 0 = not fixed)."""
    if scenario in PERSISTENT and rng.random() < 0.6:
        return "", 0
    if rng.random() < 0.2:
        return "", 30 if scenario not in PERSISTENT else 0
    minutes = rng.choice([5, 10, 15, 20, 30, 45, 60, 90, 120, 180])
    if minutes >= 60 and rng.random() < 0.6:
        hours = minutes / 60
        text = f"{hours:g} hour" + ("s" if hours != 1 else "")
    else:
        text = rng.choice([f"{minutes} minutes", f"{minutes} min", f"{minutes} mins"])
    return f" for {text}", minutes


def make_simulate_example(rng: random.Random) -> tuple[str, str, dict]:
    scenario = rng.choice(list(SCENARIO_PHRASES))
    phrase = rng.choice(SCENARIO_PHRASES[scenario])
    # A temperature rise only counts when the question states one; otherwise the default (15°C) applies.
    delta = float(rng.choice([5, 8, 10, 12, 15, 20])) if "{delta}" in phrase else 15.0
    event = phrase.format(delta=f"{delta:g}")
    dur_text, minutes = duration_phrase(rng, scenario)
    selected = rng.choice(list(ZONES))
    r = rng.random()
    if r < 0.15:
        zones, room = list(ZONES), rng.choice(ALL_ROOMS)
        q = rng.choice(TEMPLATES).format(event=event, event_cap=event[0].upper() + event[1:], room=room, dur=dur_text)
    elif r < 0.3:
        zones = [selected]
        q = rng.choice(NO_ROOM_TEMPLATES).format(event=event, dur=dur_text)
    else:
        z = rng.choice(list(ZONES))
        zones = [z]
        q = rng.choice(TEMPLATES).format(event=event, event_cap=event[0].upper() + event[1:], room=rng.choice(ROOM_PHRASES[z]), dur=dur_text)
    if rng.random() < 0.3:
        q = q.lower()
    plan = {"intent": "simulate", "message": "",
            "runs": [{"zone_id": z, "scenario": scenario, "duration_minutes": minutes, "ambient_delta": delta} for z in zones]}
    return q, selected, plan


def planner_example(question: str, selected: str, plan: dict, lang: str = "en") -> dict:
    user = A.planner_user_message(question, selected, lang)
    return {"prompt": [{"role": "system", "content": A.planner_system_prompt()}, {"role": "user", "content": user}],
            "completion": [{"role": "assistant", "content": json.dumps(plan, ensure_ascii=False)}]}


def writer_example(question: str, plan_runtime: dict, results: dict, lang: str = "en") -> dict:
    return {"prompt": [{"role": "system", "content": A.writer_system_prompt(lang)},
                       {"role": "user", "content": A.writer_user_message(question, results)}],
            "completion": [{"role": "assistant", "content": A.rules_write(plan_runtime, results, lang)}]}


def random_question(rng: random.Random) -> tuple[str, str, dict, str]:
    """(question, selected room, plan, language): ~60% English, 20% Hindi, 20% Marathi."""
    r = rng.random()
    if r < 0.6:
        return (*make_simulate_example(rng), "en")
    lang = "hi" if r < 0.8 else "mr"
    return (*make_indic_example(rng, lang), lang)


def to_runtime(plan: dict) -> dict:
    """Training plans use 0 for 'not fixed'; the runtime uses None (same as _parse_plan)."""
    return A._parse_plan(json.dumps(plan)) if plan["intent"] == "simulate" else plan


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--planner", type=int, default=1500, help="number of planner examples")
    ap.add_argument("--writer", type=int, default=500, help="number of writer examples (each runs simulations)")
    ap.add_argument("--val-fraction", type=float, default=0.05)
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()
    rng = random.Random(args.seed)
    warnings.filterwarnings("ignore")
    logging.disable(logging.WARNING)

    examples: list[dict] = []
    # Planner: simulate / status / other
    for _ in range(args.planner):
        r = rng.random()
        selected = rng.choice(list(ZONES))
        lang = rng.choice(["en", "en", "en", "hi", "mr"])
        if r < 0.82:
            examples.append(planner_example(*random_question(rng)))
        elif r < 0.92:
            q = rng.choice(STATUS_QUESTIONS if lang == "en" else INDIC[lang]["status"])
            examples.append(planner_example(q, selected, {"intent": "status", "runs": [], "message": ""}, lang))
        else:
            q, reply = rng.choice(OTHER_QUESTIONS if lang == "en" else INDIC[lang]["other"])
            examples.append(planner_example(q, selected, {"intent": "other", "runs": [], "message": reply}, lang))
    print(f"planner examples: {len(examples)}")

    # Writer: real simulations from varied starting states
    settings = Settings()
    settings.db_path = Path(tempfile.mkdtemp()) / "dataset.db"
    settings.seed_history_minutes = 150
    monitor = MonitoringService(settings, load_or_train(settings.artifacts_dir), Database(settings.db_path))
    monitor.initialize()
    monitor.notifier.enabled = False
    n_writer = 0
    for i in range(args.writer):
        if i % 25 == 0:  # vary the live state: let a random fault run for a while, then restore normal operation
            monitor.reset("scenario")
            z = rng.choice(list(ZONES))
            monitor.set_scenario(z, rng.choice(["door_open", "compressor_failure", "fan_off", "cooling_degradation"]))
            monitor.advance(rng.randint(0, 12))
            monitor.reset("scenario")
            monitor.advance(rng.randint(0, 5))
        if rng.random() < 0.1:
            lang = rng.choice(["en", "hi", "mr"])
            question = rng.choice(STATUS_QUESTIONS if lang == "en" else INDIC[lang]["status"])
            plan = {"intent": "status", "runs": [], "message": ""}
        else:
            question, _, plan, lang = random_question(rng)
            plan["runs"] = plan["runs"][:2] if rng.random() < 0.7 else plan["runs"]  # keep prompts short
        runtime_plan = to_runtime(plan)
        executed = A.execute_plan(monitor, runtime_plan)
        examples.append(writer_example(question, runtime_plan, executed["results"], lang))
        n_writer += 1
        if n_writer % 50 == 0:
            print(f"  writer examples: {n_writer}/{args.writer}")

    rng.shuffle(examples)
    n_val = max(1, int(len(examples) * args.val_fraction))
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, rows in (("val.jsonl", examples[:n_val]), ("train.jsonl", examples[n_val:])):
        with open(OUT_DIR / name, "w", encoding="utf-8") as f:
            for row in rows:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"wrote {len(examples) - n_val} train / {n_val} val examples to {OUT_DIR}")


if __name__ == "__main__":
    main()
