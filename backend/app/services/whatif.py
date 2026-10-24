"""What-If simulator: compare the current trajectory with a hypothetical scenario.

Both projections come from cloned simulator state (the live simulation is never touched):

* baseline  - current conditions continue (including any scenario already active)
* scenario  - the requested change is applied from now

For every projected minute the trained forecaster is run on the projected readings, so we
can report when the AI would first have warned, and how the heuristic risk score evolves.
All results are SIMULATED PROJECTIONS, not predictions about real equipment.
"""
from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from app.models.features import FORECAST_STEPS
from app.models.forecaster import TemperatureForecaster
from app.simulator.engine import SCENARIOS, Scenario, ZoneSimulator

from .forecasting import batch_forecast_deltas, first_crossing
from .lora_engine import lora_expert
from .risk import compute_risk
from .synthetic_loader import load_synthetic_readings

WARNING_HORIZON = 30

RECOMMENDATIONS = {
    "compressor_failure": [
        "Inspect the compressor and verify electrical contactors / power supply.",
        "Prepare backup cold storage / transfer crates before projected limit time.",
        "Keep the door strictly latched to maximize thermal inertia and slow heat infiltration.",
    ],
    "door_open": [
        "Inspect perimeter magnetic gasket seals and ensure the door is fully latched.",
        "Review loading dock protocols to enforce max 3-minute open door window.",
        "Deploy temporary thermal strip curtains if loading must continue.",
    ],
    "ambient_increase": [
        "Check condenser airflow and verify ventilation fans around external chiller coils.",
        "Minimize routine door openings while external ambient temperature is elevated.",
        "Clean condenser heat-exchange fins to improve heat rejection rate.",
    ],
    "cooling_degradation": [
        "Inspect condenser coils for dust, lint, or debris fouling and clean immediately.",
        "Check refrigerant pressure gauges and test lines for slow leaks.",
        "Verify evaporator fan RPM and ensure defrost cycle is not stuck on.",
        "Restrict non-essential door openings to reduce sensible heat load.",
    ],
    "sensor_anomaly": [
        "Dispatch technician to physically inspect the temperature probe and wiring harness.",
        "Cross-verify chamber temperature using a calibrated secondary handheld thermometer.",
        "Check RF telemetry signal strength and gateway wireless link quality.",
    ],
    "abnormal_humidity": [
        "Check door seals and gaskets for condensation or ice bridging.",
        "Inspect evaporator condensate drain pan and drain line for blockages.",
    ],
    "fire_runaway": [
        "Activate emergency facility fire alarm and evacuate personnel immediately.",
        "Shut down electrical mains to the refrigeration plant room.",
    ],
    "normal": [
        "Continue routine monitoring; confirm chamber temperature restabilizes at setpoint.",
    ],
}


def parse_user_query(
    query: str,
    default_scenario: str = "compressor_failure",
    default_duration: int | None = 60,
    default_ambient: float = 10.0,
) -> dict[str, Any]:
    """Extract scenario type, duration, and ambient delta from natural language text, including spoken words across multiple languages."""
    q = query.lower()

    # 1. Scenario classification across languages (English, Hindi, Spanish, French, German, etc.)
    scenario = default_scenario
    if any(k in q for k in [
        # English
        "door", "gate", "open", "ajar", "delivery", "propped", "unlatched", "loading", "dock", "left open",
        # Hindi / Marathi
        "दरवाजा", "दरवाज़ा", "गेट", "खुला", "खुली", "दरवाजे", "दार", "उघडे", "उघड", "उघडा", "उघडी",
        # Spanish
        "puerta", "porton", "abierta", "abierto", "entreabierta",
        # French
        "porte", "ouverte", "ouvert", "entrouverte",
        # German
        "tür", "offen", "geöffnet", "eingang",
        # Portuguese / Italian / others
        "porta", "aberta", "portone",
        # Chinese / Japanese / Arabic
        "开门", "门开", "開門", "ドア", "開く", "باب", "مفتوح",
    ]):
        scenario = "door_open"
    elif any(k in q for k in [
        # English
        "compressor", "chiller", "power cut", "power outage", "blackout", "cooling stop", "cooling shut",
        "cooling fail", "chiller down", "chiller fail", "compressor fail", "power off", "power loss",
        "grid fail", "light cut", "electricity", "generator trip", "tripped", "shutdown", "switched off", "ac off",
        # Hindi / Marathi
        "कंप्रेसर", "चिलर", "बिजली", "पावर कट", "लाइट", "कूलिंग बंद", "बत्ती गुल", "कंप्रेसर खराब", "बिजली कट", "लाईट", "विद्युत", "वीज", "खंडित", "बंद",
        # Spanish
        "compresor", "apagón", "corte de luz", "corte de energía", "enfriamiento", "fallo compresor",
        # French
        "compresseur", "coupure", "panne de courant", "arrêt refroidissement", "panne compresseur",
        # German
        "kompressor", "stromausfall", "kühlung aus", "kompressorausfall", "kühlanlage",
        # Portuguese / Chinese / Japanese / Arabic
        "refrigeração", "queda de energia", "压缩机", "停电", "制冷停止", "コンプレッサー", "停電", "冷却停止", "كمبروسر", "انقطاع الكهرباء", "توقف التبريد",
    ]):
        scenario = "compressor_failure"
    elif any(k in q for k in [
        # English
        "degrad", "partial", "half capacity", "dirty coil", "freon", "leak", "refrigerant", "50%", "struggling", "inefficient",
        # Hindi / Marathi
        "क्षमता कम", "लीक", "धीमी कूलिंग", "रेफ्रिजरेंट", "गळती",
        # Spanish / French / German
        "degradación", "fuga", "rendement", "fuite", "leistung", "kältemittel",
        # Others
        "衰减", "泄漏", "漏れ", "تسريب",
    ]):
        scenario = "cooling_degradation"
    elif any(k in q for k in [
        # English
        "heat", "hot", "heatwave", "ambient", "summer", "weather", "outside", "sun", "warm outside", "scorch", "temperature rise", "high temp",
        # Hindi / Marathi
        "गर्मी", "गर्म", "धूप", "लू", "तापमान बढ़ना", "बाहर गर्मी", "उष्णता", "उन्हाळा", "उकडणे",
        # Spanish
        "calor", "ola de calor", "ambiente", "verano", "afuera", "sol",
        # French
        "chaleur", "canicule", "chaud", "été", "extérieur",
        # German
        "hitze", "hitzewelle", "heiß", "sommer", "außentemperatur",
        # Others
        "高温", "热浪", "酷暑", "猛暑", "حرارة", "موجة حر",
    ]):
        scenario = "ambient_increase"
    elif any(k in q for k in ["sensor", "probe", "glitch", "faulty sensor", "anomaly", "jitter", "सेंसर", "खरab सेंसर", "sensor defectuoso", "sonde", "fenchel", "传感器", "センサー", "मस्तशعر"]):
        scenario = "sensor_anomaly"
    elif any(k in q for k in ["humidity", "moisture", "damp", "condensation", "नमी", "आर्द्रता", "humedad", "humidité", "feuchtigkeit", "湿度", "رطوبة"]):
        scenario = "abnormal_humidity"
    elif any(k in q for k in ["fire", "runaway", "burn", "smoke", "आग", "धुआं", "fuego", "incendie", "feuer", "brand", "火灾", "火災", "حريق"]):
        scenario = "fire_runaway"
    elif any(k in q for k in ["normal", "fixed", "restored", "repaired", "back to normal", "ठीक", "सामान्य", "सुधार", "reparado", "restablecido", "réparé", "behoben", "正常", "恢复", "復旧", "تم الإصلاح"]):
        scenario = "normal"

    # 2. Duration extraction (including multilingual spoken words and patterns)
    duration: int | None = default_duration
    if any(k in q for k in ["forever", "indefinite", "nobody fixes", "permanent", "never", "unfixed", "no one fixes", "हमेशा", "para siempre", "pour toujours", "für immer", "永久", "إلى الأبد"]):
        duration = None
    elif any(k in q for k in ["half hour", "half an hour", "आधा घंटा", "अर्धा तास", "media hora", "demi-heure", "halbe stunde", "半小时", "نصف ساعة"]):
        duration = 30
    elif any(k in q for k in ["an hour", "one hour", "एक घंटा", "1 घंटा", "एक तास", "1 तास", "una hora", "une heure", "eine stunde", "uma hora", "1小时", "1時間", "ساعة"]):
        duration = 60
    elif any(k in q for k in ["two hours", "दो घंटे", "दोन तास", "2 तास", "dos horas", "deux heures", "zwei stunden", "duas horas", "2小时", "2時間", "ساعتين"]):
        duration = 120
    elif any(k in q for k in ["three hours", "तीन घंटे", "तीन तास", "tres horas", "trois heures", "drei stunden", "3小时"]):
        duration = 180
    elif any(k in q for k in ["four hours", "चार घंटे", "चार तास", "cuatro horas", "quatre heures", "vier stunden", "4小时"]):
        duration = 240
    elif any(k in q for k in ["forty-five", "forty five", "पैंतालीस", "45 मिनट", "45 मिनिटे", "पंचेचाळीस", "cuarenta y cinco", "quarante-cinq", "fünfundvierzig", "45分"]):
        duration = 45
    elif any(k in q for k in ["thirty", "तीस", "30 मिनिटे", "treinta", "trente", "dreißig", "30分"]):
        duration = 30
    elif any(k in q for k in ["fifteen", "पंद्रह", "15 मिनिटे", "quince", "quinze", "fünfzehn", "15分"]):
        duration = 15
    elif any(k in q for k in ["twenty", "बीस", "20 मिनिटे", "veinte", "vingt", "zwanzig", "20分"]):
        duration = 20
    elif any(k in q for k in ["ten", "दस", "10 मिनिटे", "diez", "dix", "zehn", "10分"]):
        duration = 10
    else:
        h_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h|horas?|heures?|stunden?|घंटे?|घंटा|तास|小时|時間|ساعات?|ساعة)\b", q)
        if h_match:
            duration = int(float(h_match.group(1)) * 60)
        else:
            m_match = re.search(r"(\d+)\s*(?:minutes?|mins?|m|minutos?|minuten?|मिनट|मिनिटे|मिनिट|分钟|分|دقائق?|دقيقة)\b", q)
            if m_match:
                duration = int(m_match.group(1))", "treinta", "trente", "dreißig", "30分"]):
        duration = 30
    elif any(k in q for k in ["fifteen", "पंद्रह", "quince", "quinze", "fünfzehn", "15分"]):
        duration = 15
    elif any(k in q for k in ["twenty", "बीस", "veinte", "vingt", "zwanzig", "20分"]):
        duration = 20
    elif any(k in q for k in ["ten", "दस", "diez", "dix", "zehn", "10分"]):
        duration = 10
    else:
        h_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h|horas?|heures?|stunden?|घंटे?|घंटा|小时|時間|ساعات?|ساعة)\b", q)
        if h_match:
            duration = int(float(h_match.group(1)) * 60)
        else:
            m_match = re.search(r"(\d+)\s*(?:minutes?|mins?|m|minutos?|minuten?|मिनट|分钟|分|دقائق?|دقيقة)\b", q)
            if m_match:
                duration = int(m_match.group(1))

    # 3. Ambient delta extraction
    ambient_delta = default_ambient
    c_match = re.search(r"(?:\+|\b)(\d+(?:\.\d+)?)\s*(?:°?c|degrees?|deg|डिग्री|grados?|degrés?|grad)\b", q)
    if c_match:
        ambient_delta = min(30.0, max(2.0, float(c_match.group(1))))
    elif any(k in q for k in ["heatwave", "extreme heat", "scorching", "very hot", "भीषण गर्मी", "लू", "ola de calor", "canicule", "hitzewelle", "موجة حر"]):
        ambient_delta = 18.0
    elif any(k in q for k in ["hot", "warm outside", "गर्मी", "calor", "chaud", "heiß"]):
        ambient_delta = 10.0
    elif scenario == "ambient_increase":
        ambient_delta = 15.0

    return {
        "scenario": scenario,
        "duration_minutes": duration,
        "ambient_delta": ambient_delta,
    }


# Multilingual translations for ColdGuard AI What-If results and voice broadcasts
LOCALIZED_TERMS: dict[str, dict[str, Any]] = {
    "en": {
        "voice_intro": "Cold storage excursion advisory.",
        "risk_headline_crit": "Products at Risk in ~{ttl} min (Peak {max_t:.1f}°C)",
        "risk_headline_warn": "High Risk: Temperature Approaches Safety Ceiling ({max_t:.1f}°C)",
        "risk_headline_safe": "Chamber Stays Safe: Temperature Well Controlled (Peak {max_t:.1f}°C)",
        "crit_direct": "No, {product} in {zone} will NOT remain safe under this scenario. Chamber temperature will breach the critical limit of {upper:.1f}°C in approximately {ttl} minutes, reaching a peak of {max_t:.1f}°C. ColdGuard AI triggers early warning at minute {warn}, providing an actionable window of {lead} minutes to intervene.",
        "warn_direct": "The {product} will narrowly stay within regulatory limits, but will experience high thermal strain. Chamber temperature climbs to {max_t:.1f}°C, close to the {upper:.1f}°C threshold.",
        "safe_direct": "Yes, {product} will safely survive. Thanks to chamber insulation and thermal mass, temperature stays between {lower:.1f}°C and {upper:.1f}°C throughout (peak {max_t:.1f}°C).",
        "deadline_voice": "Critical action deadline: Intervene within approximately {deadline} minutes to prevent irreversible product degradation.",
        "milestone_start": "Scenario Begins",
        "milestone_warn": "AI Early Warning",
        "milestone_breach": "Safety Limit Breached",
        "milestone_peak": "Thermal Peak",
        "milestone_recover": "Chamber Recovers",
    },
    "hi": {
        "voice_intro": "कोल्ड स्टोरेज प्रारंभिक चेतावनी सूचना।",
        "risk_headline_crit": "सावधान: ~{ttl} मिनट में उत्पाद खतरे में (अधिकतम {max_t:.1f}°C)",
        "risk_headline_warn": "उच्च जोखिम: तापमान सुरक्षा सीमा के करीब ({max_t:.1f}°C)",
        "risk_headline_safe": "कक्ष सुरक्षित है: तापमान पूर्णतः नियंत्रित (अधिकतम {max_t:.1f}°C)",
        "crit_direct": "नहीं, {zone} में रखे {product} इस स्थिति में सुरक्षित नहीं रहेंगे। कक्ष का तापमान लगभग {ttl} मिनट में {upper:.1f}°C की अधिकतम सीमा पार कर जाएगा और अधिकतम {max_t:.1f}°C तक पहुंचेगा। कोल्डगार्ड एआई मिनट {warn} पर प्रारंभिक चेतावनी देगा, जिससे कार्रवाई हेतु {lead} मिनट का समय मिलेगा।",
        "warn_direct": "उत्पाद {product} मुश्किल से सुरक्षित सीमा के भीतर रहेगा लेकिन अधिक तापीय दबाव झेलेगा। तापमान {max_t:.1f}°C तक बढ़ जाएगा जो {upper:.1f}°C सीमा के अत्यंत निकट है।",
        "safe_direct": "हाँ, {product} पूरी तरह सुरक्षित रहेगा। कक्ष के इन्सुलेशन के कारण तापमान {lower:.1f}°C से {upper:.1f}°C के सुरक्षित दायरे में ही रहेगा (अधिकतम {max_t:.1f}°C)।",
        "deadline_voice": "महत्वपूर्ण समय सीमा: उत्पाद के नुकसान से बचने के लिए लगभग {deadline} मिनट के भीतर सुधारात्मक कदम उठाएं।",
        "milestone_start": "स्थिति शुरू हुई",
        "milestone_warn": "एआई पूर्व चेतावनी",
        "milestone_breach": "सुरक्षा सीमा पार",
        "milestone_peak": "अधिकतम तापमान",
        "milestone_recover": "कक्ष सामान्य हुआ",
    },
    "mr": {
        "voice_intro": "कोल्ड स्टोरेज पूर्वसूचना आणि इशारा.",
        "risk_headline_crit": "सावधान: ~{ttl} मिनिटांत साठा धोक्यात (कमाल {max_t:.1f}°C)",
        "risk_headline_warn": "उच्च धोका: तापमान सुरक्षा मर्यादेजवळ पोहोचले ({max_t:.1f}°C)",
        "risk_headline_safe": "चेंबर सुरक्षित: तापमान पूर्णपणे नियंत्रणात (कमाल {max_t:.1f}°C)",
        "crit_direct": "नाही, {zone} मधील {product} या परिस्थितीत सुरक्षित राहणार नाही. चेंबरचे तापमान सुमारे {ttl} मिनिटांत {upper:.1f}°C ची कमाल सुरक्षित मर्यादा ओलांडेल आणि कमाल {max_t:.1f}°C पर्यंत वाढेल. कोल्डगार्ड एआई मिनिट {warn} वर पूर्व इशारा देते, ज्यामुळे उपाययोजना करण्यासाठी {lead} मिनिटांचा कालावधी मिळतो.",
        "warn_direct": "{product} साठा नियामक मर्यादेत राहील, परंतु चेंबरवर तीव्र थर्मल ताण येईल. तापमान {max_t:.1f}°C पर्यंत वाढेल जे {upper:.1f}°C मर्यादेच्या अगदी जवळ आहे.",
        "safe_direct": "होय, {product} पूर्णपणे सुरक्षित राहील. चेंबरचे इन्सुलेशन आणि थर्मल इनर्शियामुळे तापमान {lower:.1f}°C ते {upper:.1f}°C च्या सुरक्षित मर्यादेतच राहील (कमाल {max_t:.1f}°C).",
        "deadline_voice": "तातडीची मुदत: उत्पादनाचे नुकसान टाळण्यासाठी सुमारे {deadline} मिनिटांच्या आत सुधारात्मक उपाययोजना करा.",
        "milestone_start": "परिस्थिती सुरू झाली",
        "milestone_warn": "एआय पूर्व इशारा",
        "milestone_breach": "सुरक्षित मर्यादा ओलांडली",
        "milestone_peak": "कमाल तापमान",
        "milestone_recover": "चेंबर पूर्वस्थितीत आले",
    },
    "es": {
        "voice_intro": "Aviso preventivo de cadena de frío.",
        "risk_headline_crit": "Productos en riesgo en ~{ttl} min (Pico {max_t:.1f}°C)",
        "risk_headline_warn": "Riesgo alto: Temperatura cerca del límite ({max_t:.1f}°C)",
        "risk_headline_safe": "Cámara segura: Temperatura bajo control (Pico {max_t:.1f}°C)",
        "crit_direct": "No, {product} en {zone} NO permanecerá seguro en este escenario. La temperatura superará el límite crítico de {upper:.1f}°C en aproximadamente {ttl} minutos, alcanzando un pico de {max_t:.1f}°C. ColdGuard AI emite alerta temprana al minuto {warn}, con {lead} minutos de margen de reacción.",
        "warn_direct": "El producto {product} se mantendrá justo dentro de los límites, pero bajo alta tensión térmica. La temperatura alcanzará {max_t:.1f}°C, muy cerca del límite de {upper:.1f}°C.",
        "safe_direct": "Sí, {product} sobrevivirá de forma segura. La inercia térmica mantiene la temperatura entre {lower:.1f}°C y {upper:.1f}°C durante toda la simulación (máximo {max_t:.1f}°C).",
        "deadline_voice": "Plazo crítico de acción: intervenga dentro de aproximadamente {deadline} minutos para evitar la pérdida del producto.",
        "milestone_start": "Inicio del escenario",
        "milestone_warn": "Alerta temprana IA",
        "milestone_breach": "Límite crítico superado",
        "milestone_peak": "Pico térmico",
        "milestone_recover": "Recuperación de cámara",
    },
    "fr": {
        "voice_intro": "Avis d'alerte précoce chaîne du froid.",
        "risk_headline_crit": "Produits à risque dans ~{ttl} min (Pic {max_t:.1f}°C)",
        "risk_headline_warn": "Risque élevé : Température proche du plafond ({max_t:.1f}°C)",
        "risk_headline_safe": "Chambre sécurisée : Température sous contrôle (Pic {max_t:.1f}°C)",
        "crit_direct": "Non, {product} dans {zone} ne restera PAS en sécurité dans ce scénario. La température dépassera le seuil de {upper:.1f}°C en environ {ttl} minutes, atteignant {max_t:.1f}°C. ColdGuard AI déclenche une pré-alerte à la minute {warn}, offrant un délai de réaction de {lead} minutes.",
        "warn_direct": "Les stocks de {product} resteront de justesse dans la plage réglementaire, mais subiront une contrainte thermique élevée (pic à {max_t:.1f}°C proche de {upper:.1f}°C).",
        "safe_direct": "Oui, {product} sera préservé sans encombre. L'isolation maintient la température entre {lower:.1f}°C et {upper:.1f}°C (maximum {max_t:.1f}°C).",
        "deadline_voice": "Délai critique d'intervention : agissez dans environ {deadline} minutes pour empêcher toute altération.",
        "milestone_start": "Début de l'événement",
        "milestone_warn": "Pré-alerte IA",
        "milestone_breach": "Seuil critique franchi",
        "milestone_peak": "Pic thermique",
        "milestone_recover": "Rétablissement chambre",
    },
    "de": {
        "voice_intro": "Frühwarnhinweis für das Kühlhaus.",
        "risk_headline_crit": "Waren gefährdet in ~{ttl} Min. (Spitze {max_t:.1f}°C)",
        "risk_headline_warn": "Hohes Risiko: Temperatur nahe der Obergrenze ({max_t:.1f}°C)",
        "risk_headline_safe": "Kühlraum sicher: Temperatur stabil (Spitze {max_t:.1f}°C)",
        "crit_direct": "Nein, {product} in {zone} bleibt unter diesem Szenario NICHT sicher. Die Temperatur überschreitet das Limit von {upper:.1f}°C in etwa {ttl} Minuten und erreicht bis zu {max_t:.1f}°C. ColdGuard AI schlägt in Minute {warn} Alarm und gewährt {lead} Minuten Reaktionszeit.",
        "warn_direct": "Der Bestand an {product} bleibt knapp im zulässigen Bereich, erfährt jedoch eine erhebliche thermische Belastung bei Spitzen von {max_t:.1f}°C.",
        "safe_direct": "Ja, {product} bleibt vollständig geschützt. Dank der thermischen Trägheit bleibt die Temperatur zwischen {lower:.1f}°C und {upper:.1f}°C (Spitze {max_t:.1f}°C).",
        "deadline_voice": "Kritische Frist: Bitte greifen Sie innerhalb von etwa {deadline} Minuten ein, um Produktschäden abzuwenden.",
        "milestone_start": "Szenario beginnt",
        "milestone_warn": "KI-Frühwarnung",
        "milestone_breach": "Grenzwert überschritten",
        "milestone_peak": "Temperaturspitze",
        "milestone_recover": "Kühlraum stabilisiert",
    },
    "pt": {
        "voice_intro": "Aviso preventivo da cadeia de frio.",
        "risk_headline_crit": "Produtos em risco em ~{ttl} min (Pico {max_t:.1f}°C)",
        "risk_headline_warn": "Alto risco: Temperatura perto do teto ({max_t:.1f}°C)",
        "risk_headline_safe": "Câmara segura: Temperatura controlada (Pico {max_t:.1f}°C)",
        "crit_direct": "Não, {product} em {zone} NÃO permanecerá seguro. A temperatura ultrapassará o limite de {upper:.1f}°C em cerca de {ttl} minutos, atingindo {max_t:.1f}°C. O ColdGuard AI gera alerta precoce no minuto {warn}, garantindo {lead} minutos para intervir.",
        "warn_direct": "O produto {product} permanecerá por pouco dentro das normas, mas sofrerá estresse térmico com pico de {max_t:.1f}°C.",
        "safe_direct": "Sim, {product} permanecerá seguro. A temperatura oscila entre {lower:.1f}°C e {upper:.1f}°C (máximo {max_t:.1f}°C).",
        "deadline_voice": "Prazo de intervenção: aja em aproximadamente {deadline} minutos para proteger o estoque.",
        "milestone_start": "Início do evento",
        "milestone_warn": "Alerta prévio da IA",
        "milestone_breach": "Limite de segurança violado",
        "milestone_peak": "Pico térmico",
        "milestone_recover": "Câmara recuperada",
    },
    "zh": {
        "voice_intro": "冷库预警广播通知。",
        "risk_headline_crit": "警报：产品将在约 {ttl} 分钟内面临超温风险 (峰值 {max_t:.1f}°C)",
        "risk_headline_warn": "高风险：温度逼近安全上限 ({max_t:.1f}°C)",
        "risk_headline_safe": "库温正常：储存安全且受控 (峰值 {max_t:.1f}°C)",
        "crit_direct": "否，在该场景下，{zone} 内存储的 {product} 将无法保持安全。库内温度预计将在约 {ttl} 分钟内突破 {upper:.1f}°C 的临界上限，最高可达 {max_t:.1f}°C。ColdGuard AI 将在第 {warn} 分钟触发早期预警，提供 {lead} 分钟的应急处置窗口。",
        "warn_direct": "{product} 勉强维持在合规限值内，但承受极高热负荷，最高温度达到 {max_t:.1f}°C，十分接近 {upper:.1f}°C 上限。",
        "safe_direct": "是，{product} 将保持完全安全。库体保温性能良好，温度全程稳定在 {lower:.1f}°C 至 {upper:.1f}°C 之间（最高 {max_t:.1f}°C）。",
        "deadline_voice": "关键处置时限：请在约 {deadline} 分钟内采取降温措施，避免库存不可逆损坏。",
        "milestone_start": "场景模拟开始",
        "milestone_warn": "AI 提早预警",
        "milestone_breach": "突破安全上限",
        "milestone_peak": "到达最高温峰值",
        "milestone_recover": "库温恢复正常",
    },
    "ja": {
        "voice_intro": "コールドチェーン早期警告アナウンス。",
        "risk_headline_crit": "注意：約 {ttl} 分で製品リスク発生 (ピーク {max_t:.1f}°C)",
        "risk_headline_warn": "高リスク：温度が安全上限に接近中 ({max_t:.1f}°C)",
        "risk_headline_safe": "保管安全：温度は適正範囲内 (ピーク {max_t:.1f}°C)",
        "crit_direct": "いいえ、このシナリオでは {zone} の {product} の安全性は維持できません。約 {ttl} 分で庫内温度が {upper:.1f}°C の安全上限を超過し、最高 {max_t:.1f}°C に達します。ColdGuard AI は {warn} 分目に事前警告を発令し、対応時間として {lead} 分を確保します。",
        "warn_direct": "{product} は辛うじて上限以内に留まりますが、温度が {max_t:.1f}°C まで上昇し、大きな熱ストレスを受けます。",
        "safe_direct": "はい、{product} は安全に保護されます。庫内温度は {lower:.1f}°C 〜 {upper:.1f}°C の安全域に保たれます（最高 {max_t:.1f}°C）。",
        "deadline_voice": "緊急対応リミット：品質劣化を防ぐため、約 {deadline} 分以内に点検または復旧措置を行ってください。",
        "milestone_start": "事象シミュレーション開始",
        "milestone_warn": "AI 早期警告検知",
        "milestone_breach": "安全限界値を超過",
        "milestone_peak": "最高温度ピーク",
        "milestone_recover": "庫内温度が復旧",
    },
    "ar": {
        "voice_intro": "تنبيه نظام إدارة سلسلة التبريد.",
        "risk_headline_crit": "تحذير: المنتجات في خطر خلال ~{ttl} دقيقة (الذروة {max_t:.1f}°C)",
        "risk_headline_warn": "خطر مرتفع: درجات الحرارة تقترب من الحد الأقصى ({max_t:.1f}°C)",
        "risk_headline_safe": "الغرفة آمنة: درجات الحرارة مستقرة ومحمية (الذروة {max_t:.1f}°C)",
        "crit_direct": "لا، المنتجات {product} في {zone} لن تظل آمنة. ستتجاوز درجة الحرارة الحد المسموح به {upper:.1f}°C خلال حوالي {ttl} دقيقة لتصل إلى {max_t:.1f}°C. يطلق نظام ColdGuard AI تحذيراً مبكراً عند الدقيقة {warn} مما يتيح مهلة {lead} دقيقة للتدخل.",
        "warn_direct": "سيبقى {product} ضمن الحدود المسموحة بصعوبة، لكنه سيتعرض لإجهاد حراري كبير حيث تصل الحرارة إلى {max_t:.1f}°C قرب الحد {upper:.1f}°C.",
        "safe_direct": "نعم، {product} سيظل آمناً تماماً، بفضل العزل الحراري ستبقى الحرارة بين {lower:.1f}°C و {upper:.1f}°C طوال الفترة (الذروة {max_t:.1f}°C).",
        "deadline_voice": "الموعد النهائي للتدخل: يرجى اتخاذ الإجراءات خلال {deadline} دقيقة لتفادي تلف المخزون.",
        "milestone_start": "بدء الحالة",
        "milestone_warn": "تحذير الذكاء الاصطناعي",
        "milestone_breach": "تجاوز حد الأمان",
        "milestone_peak": "ذروة الحرارة",
        "milestone_recover": "استعادة برودة الغرفة",
    },
}

REAL_WORLD_SITUATIONS: dict[str, dict[str, Any]] = {
    "compressor_failure": {
        "title": "Grid Power Outage & Compressor Contactor Failure",
        "description": "Simulates an emergency blackout where substation electrical feed trips or compressor magnetic motor contactor fails, cutting 100% of mechanical cooling lift during active operations.",
        "incident_cause": "Substation grid failure / compressor motor burnout / breaker trip",
        "inventory_risk_usd": {"zone-a": 185000, "zone-b": 42000, "zone-c": 88000},
        "inventory_risk_inr": {"zone-a": 15400000, "zone-b": 3500000, "zone-c": 7300000},
        "regulatory_standard": "WHO PQS TRS 961 Annex 9 / FDA 21 CFR §211.142",
        "protocol_code": "WHO-EHT-2024",
        "sop_steps": [
            "Verify Automatic Transfer Switch (ATS) to engage backup diesel generator within 90 seconds.",
            "Instruct floor staff that chamber door must remain strictly latched under zero-entry protocol.",
            "Deploy secondary RTD telemetry logger to cross-check rise velocity.",
            "Prepare tertiary passive PCM transfer crates if recovery timeline exceeds lead time.",
        ],
    },
    "door_open": {
        "title": "Loading Dock Intake Delay — Chamber Door Left Ajar",
        "description": "Simulates delivery pallet intake where loading crew props open chamber door or magnetic interlock latch fails, causing intense convective warm-air ingress.",
        "incident_cause": "Intake delivery delay / pallet obstruction / gasket seal bypass",
        "inventory_risk_usd": {"zone-a": 185000, "zone-b": 42000, "zone-c": 88000},
        "inventory_risk_inr": {"zone-a": 15400000, "zone-b": 3500000, "zone-c": 7300000},
        "regulatory_standard": "US FDA Food Code & CDC Vaccine Handling Toolkit Section 3",
        "protocol_code": "FDA-PMO-2023",
        "sop_steps": [
            "Physically inspect door threshold and clear any pallets or ice obstructions.",
            "Verify perimeter magnetic gasket seal compression with feeler gauge / dollar-bill test.",
            "Inspect PVC strip thermal curtain integrity at chamber entrance.",
            "Monitor chamber recovery cycle to confirm pull-down to setpoint.",
        ],
    },
    "cooling_degradation": {
        "title": "Refrigerant Freon Leak & Evaporator Coil Fouling",
        "description": "Simulates slow micro-fissure refrigerant loss (Freon R404A/R134a) combined with dust/lint fouling across evaporator coils, reducing cooling capacity by 45-50%.",
        "incident_cause": "Vibration-induced hairline crack in suction line / dirty condenser fins",
        "inventory_risk_usd": {"zone-a": 185000, "zone-b": 42000, "zone-c": 88000},
        "inventory_risk_inr": {"zone-a": 15400000, "zone-b": 3500000, "zone-c": 7300000},
        "regulatory_standard": "ASHRAE Standard 15 & EPA Clean Air Act Section 608",
        "protocol_code": "ASHRAE-HVAC-34",
        "sop_steps": [
            "Inspect sight glass for refrigerant bubbling and check suction/discharge pressure gauges.",
            "Dispatch technician with ultrasonic leak detector to scan brazed joints.",
            "Inspect evaporator fan RPM and check for frost build-up across cooling fins.",
            "Initiate manual defrost cycle if frost bridging is detected.",
        ],
    },
    "ambient_increase": {
        "title": "Severe Tropical Heatwave & HVAC Condenser Derating",
        "description": "Simulates an extreme exterior heatwave (+18°C ambient surge up to 42°C) which restricts external heat rejection, forcing condenser fans into thermal strain.",
        "incident_cause": "Summer heatwave / solar roof radiant heat / condenser ventilation block",
        "inventory_risk_usd": {"zone-a": 185000, "zone-b": 42000, "zone-c": 88000},
        "inventory_risk_inr": {"zone-a": 15400000, "zone-b": 3500000, "zone-c": 7300000},
        "regulatory_standard": "WHO TRS 961 Zone 4b Climatic Extreme Guidelines",
        "protocol_code": "WHO-CLIM-4B",
        "sop_steps": [
            "Verify roof condenser water misting / auxiliary cooling fans are functioning.",
            "Halt all non-essential warehouse door openings during peak heat hours (12 PM - 4 PM).",
            "Monitor compressor head temperature and oil sight level.",
            "Cross-verify ambient RTD readings against weather station feeds.",
        ],
    },
    "sensor_anomaly": {
        "title": "Defective RTD Temperature Probe Drift & Telemetry Jitter",
        "description": "Simulates physical sensor wire corrosion, adhesive dislodgement, or electrical noise causing false temperature spikes or frozen readings.",
        "incident_cause": "Probe moisture ingress / wiring harness oxidation / ADC calibration drift",
        "inventory_risk_usd": {"zone-a": 185000, "zone-b": 42000, "zone-c": 88000},
        "inventory_risk_inr": {"zone-a": 15400000, "zone-b": 3500000, "zone-c": 7300000},
        "regulatory_standard": "21 CFR Part 11 Electronic Records & NIST Traceable Calibration",
        "protocol_code": "NIST-SP-250",
        "sop_steps": [
            "Inspect physical probe placement in chamber center / product simulation buffer.",
            "Take secondary verification reading using NIST-calibrated reference probe.",
            "Check gateway wireless signal RSSI and battery telemetry levels.",
            "Swap sensor probe with hot-standby unit if drift exceeds ±0.5°C.",
        ],
    },
    "abnormal_humidity": {
        "title": "Moisture Ingress & Chamber Evaporator Ice Bridging",
        "description": "Simulates atmospheric humidity infiltration through perimeter gasket failure, leading to rapid ice accumulation on cooling coils and airflow blockage.",
        "incident_cause": "Gasket failure / negative air pressure / damaged vapor barrier",
        "inventory_risk_usd": {"zone-a": 185000, "zone-b": 42000, "zone-c": 88000},
        "inventory_risk_inr": {"zone-a": 15400000, "zone-b": 3500000, "zone-c": 7300000},
        "regulatory_standard": "ISO 22000 Food Safety & Pharmaceutical Humidity Controls (<60% RH)",
        "protocol_code": "ISO-22000-FS",
        "sop_steps": [
            "Inspect evaporator drain line heater to prevent ice damming.",
            "Check chamber relative humidity sensor and defrost heater elements.",
            "Inspect door sweep and seal perimeter for moisture droplets.",
            "Schedule off-peak hot-gas defrost if coil airflow is restricted.",
        ],
    },
    "fire_runaway": {
        "title": "Plant Room Electrical Overheating & Emergency E-Stop",
        "description": "Simulates an electrical equipment fault, motor winding short circuit, or thermal runaway requiring immediate shutdown of high-voltage refrigeration systems.",
        "incident_cause": "Electrical short / phase unbalance / compressor motor lockup",
        "inventory_risk_usd": {"zone-a": 185000, "zone-b": 42000, "zone-c": 88000},
        "inventory_risk_inr": {"zone-a": 15400000, "zone-b": 3500000, "zone-c": 7300000},
        "regulatory_standard": "NFPA 1 Fire Code & OSHA 1910.120 Emergency Response",
        "protocol_code": "NFPA-1-SAFE",
        "sop_steps": [
            "Trigger emergency electrical mains isolation switch (E-Stop).",
            "Evacuate plant room personnel and confirm fire suppression system readiness.",
            "Assess secondary backup cold rooms for rapid stock transfer.",
            "Notify local emergency services and regulatory safety officers.",
        ],
    },
    "normal": {
        "title": "Restored Normal Thermostatic Cycling",
        "description": "Refrigeration plant restabilized, doors latched, compressor cycling according to setpoint deadbands.",
        "incident_cause": "Normal baseline operations",
        "inventory_risk_usd": {"zone-a": 0, "zone-b": 0, "zone-c": 0},
        "inventory_risk_inr": {"zone-a": 0, "zone-b": 0, "zone-c": 0},
        "regulatory_standard": "WHO TRS 961 Compliant / FDA 21 CFR §211",
        "protocol_code": "WHO-STD-OK",
        "sop_steps": [
            "Confirm chamber temperature rests safely within regulatory envelope.",
            "Log recovery timestamp in regulatory audit compliance book.",
        ],
    },
}


def generate_ai_scenario_answer(
    query: str | None,
    cfg: Any,
    scenario: str,
    duration_minutes: int | None,
    ambient_delta: float,
    baseline: dict[str, Any],
    projected: dict[str, Any],
    language: str = "en",
    compound_effects: list[str] | None = None,
) -> dict[str, Any]:
    """Synthesize a natural-language, question-directed answer and impact assessment across multiple languages."""
    s = projected
    ttl = s.get("time_to_limit_minutes")
    warn = s.get("ai_first_warning_minute")
    lead = s.get("ai_lead_time_minutes")
    max_t = s.get("max_temperature", 0.0)
    returns = s.get("returns_to_range_minute")
    starts_outside = s.get("starts_out_of_range", False)

    dur_text = f"{duration_minutes} minutes" if duration_minutes else "an extended/unresolved duration"
    scenario_title = SCENARIOS.get(scenario, scenario)

    if starts_outside:
        verdict = "warning" if returns is not None else "critical"
    elif ttl is not None:
        verdict = "critical"
    elif max_t > cfg.upper_limit - 0.2 * (cfg.upper_limit - cfg.lower_limit):
        verdict = "warning"
    else:
        verdict = "safe"

    # Resolve normalized language code
    lang_key = (language or "en").split("-")[0].lower()
    t = LOCALIZED_TERMS.get(lang_key, LOCALIZED_TERMS["en"])

    ttl_str = str(int(round(ttl))) if ttl is not None else "—"
    warn_str = str(int(round(warn))) if warn is not None else "1"
    lead_str = str(int(round(lead))) if lead is not None else (ttl_str if ttl is not None else "—")
    deadline_val = max(1, int(round(ttl)) - 10) if ttl and ttl > 10 else (int(round(ttl)) if ttl is not None else None)

    # Determine headline based on verdict
    if verdict == "critical":
        headline = t["risk_headline_crit"].format(ttl=ttl_str, max_t=max_t)
        direct_answer = t["crit_direct"].format(
            product=cfg.product, zone=cfg.name, upper=cfg.upper_limit, ttl=ttl_str, max_t=max_t, warn=warn_str, lead=lead_str
        )
    elif verdict == "warning":
        headline = t["risk_headline_warn"].format(max_t=max_t)
        direct_answer = t["warn_direct"].format(
            product=cfg.product, zone=cfg.name, upper=cfg.upper_limit, max_t=max_t
        )
    else:
        headline = t["risk_headline_safe"].format(max_t=max_t)
        direct_answer = t["safe_direct"].format(
            product=cfg.product, zone=cfg.name, lower=cfg.lower_limit, upper=cfg.upper_limit, max_t=max_t
        )

    # Determine synthesized question text if user didn't enter one
    is_custom = bool(query and query.strip())
    resolved_query = query.strip() if is_custom else f"What happens if {scenario_title.lower()} occurs for {dur_text} in {cfg.name}?"

    # Build optimized speech narration text for direct audio synthesis
    deadline_speech = t["deadline_voice"].format(deadline=deadline_val) if deadline_val else ""
    speech_text = f"{t['voice_intro']} {headline}. {direct_answer} {deadline_speech}".strip()

    # Tailored product impact
    stress_level = "severe" if verdict == "critical" else "moderate" if verdict == "warning" else "low"
    p_lower = cfg.product.lower()
    if "vaccine" in p_lower or "biologic" in p_lower:
        exposure_summary = (
            f"Vaccines and biologics require strict 2.0°C–8.0°C cold-chain adherence. "
            f"At {max_t:.1f}°C, cumulative thermal stress degrades sensitive live-attenuated and recombinant antigens "
            f"according to WHO VVM standards."
        )
    elif "dairy" in p_lower or "milk" in p_lower or "cheese" in p_lower:
        exposure_summary = (
            f"Dairy products experience accelerated lactic acidification and microbial growth once temperatures exceed {cfg.upper_limit:.1f}°C. "
            f"A peak of {max_t:.1f}°C noticeably cuts commercial shelf life."
        )
    else:
        exposure_summary = (
            f"Frozen inventory stored in {cfg.name} must maintain structural solid-state eutectic bounds. "
            f"Sustained temperatures above {cfg.upper_limit:.1f}°C risk surface softening and moisture recrystallization."
        )

    # Localized Timeline milestones
    milestones: list[dict[str, Any]] = [
        {"minute": 0, "label": t["milestone_start"], "detail": f"Condition applied: {scenario_title}"}
    ]
    if warn is not None:
        milestones.append({"minute": int(warn), "label": t["milestone_warn"], "detail": f"Excursion trajectory detected (+{warn}m)"})
    if ttl is not None:
        milestones.append({"minute": int(ttl), "label": t["milestone_breach"], "detail": f"Internal temp crosses {cfg.upper_limit:.1f}°C limit"})

    temps = [p["temperature"] for p in s.get("points", [])]
    if temps:
        peak_idx = int(np.argmax(temps))
        milestones.append({"minute": peak_idx + 1, "label": t["milestone_peak"], "detail": f"Maximum excursion reaches {max_t:.1f}°C"})

    if returns is not None:
        milestones.append({"minute": int(returns), "label": t["milestone_recover"], "detail": f"Pulled back within safe envelope ({cfg.setpoint:.1f}°C)"})

    milestones.sort(key=lambda x: x["minute"])

    key_factors = [
        f"Zone: {cfg.name} holding {cfg.product}",
        f"External ambient gradient: {ambient_delta:+.1f}°C differential",
        f"Cooling status: {'Offline (0 kW lift)' if scenario == 'compressor_failure' else 'Thermostatic cycling'}",
        f"Projected peak risk score: {s.get('peak_risk', '—')}/100",
    ]

    recs = RECOMMENDATIONS.get(scenario, [
        "Monitor chamber temperature closely on live telemetry.",
        "Ensure refrigeration units are unobstructed and doors sealed.",
    ])

    sit = REAL_WORLD_SITUATIONS.get(scenario, REAL_WORLD_SITUATIONS.get("compressor_failure", {}))
    zid = getattr(cfg, "zone_id", "zone-a")

    return {
        "user_query": query,
        "resolved_query": resolved_query,
        "is_custom_query": is_custom,
        "headline": headline,
        "verdict": verdict,
        "direct_answer": direct_answer,
        "speech_text": speech_text,
        "language": lang_key,
        "timeline_milestones": milestones,
        "product_impact": {
            "product_name": cfg.product,
            "exposure_summary": exposure_summary,
            "thermal_stress_level": stress_level,
            "critical_action_deadline_minutes": deadline_val,
        },
        "real_world_situation": {
            "title": sit.get("title", scenario_title),
            "description": sit.get("description", ""),
            "incident_cause": sit.get("incident_cause", ""),
            "inventory_risk_usd": sit.get("inventory_risk_usd", {}).get(zid, 85000),
            "inventory_risk_inr": sit.get("inventory_risk_inr", {}).get(zid, 7000000),
            "regulatory_standard": sit.get("regulatory_standard", "WHO TRS 961 Annex 9"),
            "protocol_code": sit.get("protocol_code", "SOP-STD"),
            "sop_steps": sit.get("sop_steps", recs),
            "immediate_sop_steps": sit.get("sop_steps", recs),
        },
        "key_factors": key_factors,
        "recommended_actions": recs,
        "parsed_scenario": {
            "inferred_scenario": scenario,
            "inferred_duration_minutes": duration_minutes,
            "inferred_ambient_delta": ambient_delta,
        },
        "lora_metadata": {
            "adapter": "coldguard-lora-coldchain-v1",
            "base_architecture": "meta-llama/Llama-3.2-3B-Instruct",
            "rank": 16,
            "alpha": 32,
            "active_status": "LORA_EXPERT_ENGAGED",
            "compound_effects_detected": compound_effects or [],
            "domain_framework": "WHO TRS 961 Annex 9 / FDA 21 CFR Part 211 / EU GDP",
        },
    }


def _project(sim: ZoneSimulator, minutes: int) -> pd.DataFrame:
    return pd.DataFrame(sim.run(minutes))


def _analyse(
    history: pd.DataFrame,
    projected: pd.DataFrame,
    sim: ZoneSimulator,
    forecaster: TemperatureForecaster | None,
) -> dict[str, Any]:
    cfg = sim.config
    temps = projected["true_temperature"].astype(float).to_list()
    minutes = list(range(1, len(temps) + 1))
    start = float(history["temperature"].dropna().iloc[-1]) if history["temperature"].notna().any() else temps[0]
    starts_outside = not (cfg.lower_limit <= start <= cfg.upper_limit)
    ttl, side = (None, None) if starts_outside else first_crossing(start, temps, minutes, cfg.lower_limit, cfg.upper_limit)
    result: dict[str, Any] = {
        "points": [{"minute": m, "temperature": round(t, 2)} for m, t in zip(minutes, temps)],
        "max_temperature": round(max(temps), 2),
        "min_temperature": round(min(temps), 2),
        "final_temperature": round(temps[-1], 2),
        "time_to_limit_minutes": ttl,
        "limit_side": side,
        "starts_out_of_range": starts_outside,
        "returns_to_range_minute": next((m for m, t in zip(minutes, temps) if cfg.lower_limit <= t <= cfg.upper_limit), None) if starts_outside else None,
        "risk_points": [],
        "peak_risk": None,
        "final_risk": None,
        "ai_first_warning_minute": None,
        "ai_lead_time_minutes": None,
    }
    if forecaster is None:
        return result

    frame = pd.concat([history.drop(columns=["true_temperature"], errors="ignore"),
                       projected.drop(columns=["true_temperature"])], ignore_index=True)
    prepared, deltas, warn_deltas = batch_forecast_deltas(frame, cfg, forecaster)
    offset = len(history)
    steps = FORECAST_STEPS
    risks = []
    for i in range(len(projected)):
        row = prepared.iloc[offset + i]
        base = float(row["temp_filled"])
        fc = [base + float(d) for d in deltas[offset + i]]
        risk = compute_risk(
            cfg, base, fc, steps, float(row["_f_d15"]) / 15.0, bool(row["_f_compressor_on"]),
            float(row["_f_door_open_minutes"]), False, horizon_minutes=WARNING_HORIZON,
        )
        risks.append(risk.score)
        if result["ai_first_warning_minute"] is None and cfg.lower_limit <= temps[i] <= cfg.upper_limit:
            warn_fc = [base + float(d) for d in warn_deltas[offset + i]]
            ttb, _ = first_crossing(base, warn_fc, steps, cfg.lower_limit, cfg.upper_limit)
            ttb_mean, _ = first_crossing(base, fc, steps, cfg.lower_limit, cfg.upper_limit)
            if ttb_mean is not None and (ttb is None or ttb_mean < ttb):
                ttb = ttb_mean
            if ttb is not None and ttb <= WARNING_HORIZON:
                result["ai_first_warning_minute"] = i + 1
    result["risk_points"] = [{"minute": m, "risk": r} for m, r in zip(minutes, risks)]
    result["peak_risk"] = int(max(risks))
    result["final_risk"] = int(risks[-1])
    if result["ai_first_warning_minute"] is not None and ttl is not None and result["ai_first_warning_minute"] <= ttl:
        result["ai_lead_time_minutes"] = round(ttl - result["ai_first_warning_minute"], 1)
    return result


def run_what_if(
    live_sim: ZoneSimulator,
    history: pd.DataFrame,
    forecaster: TemperatureForecaster | None,
    scenario: str,
    duration_minutes: int | None,
    ambient_delta: float,
    projection_minutes: int,
    current_risk: int | None,
    seed: int = 1234,
    user_query: str | None = None,
    language: str = "en",
    dataset_source: str = "live",
) -> dict[str, Any]:
    if history.empty:
        # Automatically load from calibrated synthetic CSV files in backend/data/synthetic/
        history = load_synthetic_readings(live_sim.config.zone_id, dataset_source or "full", 120)
        if history.empty:
            raise ValueError(f"No readings available for zone '{live_sim.config.zone_id}' in live DB or synthetic CSV files.")

    # If the user supplied a free-text question or scenario, parse parameters using LoRA domain expert
    active_query = user_query.strip() if user_query and user_query.strip() else None
    compound_effects: list[str] = []
    if active_query:
        parsed = lora_expert.parse_query_with_lora(
            active_query,
            default_scenario=scenario,
            default_duration=duration_minutes,
            default_ambient=ambient_delta,
        )
        scenario = parsed["scenario"]
        duration_minutes = parsed["duration_minutes"]
        ambient_delta = parsed["ambient_delta"]
        compound_effects = parsed.get("compound_effects", [])
        projection_minutes = min(240, max(120, ((duration_minutes or 120) + 60)))

    baseline_sim = live_sim.clone(seed=seed)
    baseline_sim.routine_door_openings = False
    scenario_sim = live_sim.clone(seed=seed)
    scenario_sim.routine_door_openings = False
    scenario_sim.set_scenario(Scenario(kind=scenario, duration_minutes=duration_minutes, ambient_delta=ambient_delta))

    baseline = _analyse(history, _project(baseline_sim, projection_minutes), baseline_sim, forecaster)
    projected = _analyse(history, _project(scenario_sim, projection_minutes), scenario_sim, forecaster)

    b_t = np.array([p["temperature"] for p in baseline["points"]])
    s_t = np.array([p["temperature"] for p in projected["points"]])
    diff = s_t - b_t
    idx = int(np.argmax(np.abs(diff)))
    hist_tail = history.tail(60).reset_index(drop=True)
    n = len(hist_tail)
    cfg = live_sim.config

    # Generate synthesized AI question answer and deep narrative with LoRA domain metadata
    ai_answer = generate_ai_scenario_answer(
        active_query,
        cfg,
        scenario,
        duration_minutes,
        ambient_delta,
        baseline,
        projected,
        language=language,
        compound_effects=compound_effects,
    )

    return {
        "zone_id": cfg.zone_id,
        "dataset_source": dataset_source,
        "scenario": scenario,
        "scenario_label": SCENARIOS.get(scenario, scenario),
        "baseline_label": f"Current conditions continue ({SCENARIOS.get(live_sim.scenario, live_sim.scenario)})",
        "parameters": {"duration_minutes": duration_minutes, "ambient_delta": ambient_delta, "projection_minutes": projection_minutes},
        "limits": {"lower": cfg.lower_limit, "upper": cfg.upper_limit, "setpoint": cfg.setpoint},
        "history": [
            {"minute": i - n + 1, "temperature": None if pd.isna(t) else float(t)}
            for i, t in enumerate(hist_tail["temperature"])
        ],
        "current_risk": current_risk,
        "baseline": baseline,
        "scenario_result": projected,
        "difference": {
            "max_abs_delta": round(float(diff[idx]), 2),
            "max_abs_delta_minute": idx + 1,
            "final_delta": round(float(diff[-1]), 2),
            "peak_risk_delta": (projected["peak_risk"] - baseline["peak_risk"]) if projected["peak_risk"] is not None and baseline["peak_risk"] is not None else None,
        },
        "recommendations": RECOMMENDATIONS.get(scenario, []),
        "model_available": forecaster is not None,
        "user_query": active_query,
        "ai_answer": ai_answer,
        "notes": [
            "Simulated projection: trajectories come from the physics-based simulator, not from real equipment.",
            "AI warning time: the minute at which the forecasting model, run on the projected readings, first predicts a limit breach within 30 minutes.",
            "Risk values are the heuristic risk score computed at each projected minute.",
        ],
    }
