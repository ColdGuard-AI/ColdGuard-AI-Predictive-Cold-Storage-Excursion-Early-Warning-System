"""ColdGuard AI — System Knowledge Database & Strict Keyword Matching Engine.

Provides authoritative domain knowledge, situation-based financial loss calculations
matching the Manager Dashboard What-If Loss Simulator, and multi-lingual strict
keyword routing for all cold storage system inquiries.
"""
from __future__ import annotations

import math
import re
from typing import Any, Dict, List, Optional, Tuple


# Currency Conversion Baseline (1 USD = 83 INR)
USD_TO_INR = 83.0

# Authoritative Commodity Profiles (Identical to Manager Dashboard InventoryRisk)
SYSTEM_COMMODITIES: Dict[str, Dict[str, Any]] = {
    "zone-a": {
        "zone_id": "zone-a",
        "name": "Vaccine Store A",
        "name_hi": "वैक्सीन स्टोर A",
        "name_mr": "लस साठा A",
        "name_es": "Almacén de Vacunas A",
        "product": "Vaccines & Biologics (mRNA, Insulin, Antivenom)",
        "product_hi": "वैक्सीन एवं बायोलॉजिक्स (mRNA, इंसुलिन, एंटीवेनम)",
        "product_mr": "लस आणि जैविक उत्पादने (mRNA, इन्सुलिन, अँटीव्हेनम)",
        "batch_id": "LOT-BIO-2026-09A",
        "mass_kg": 500,
        "unit_cost_inr": 450,
        "gross_usd": 186000.0,
        "gross_inr": 186000.0 * USD_TO_INR,
        "setpoint": 5.0,
        "lower_limit": 2.0,
        "upper_limit": 8.0,
        "spoilage_threshold_c": 8.0,
        "spoilage_mechanism": (
            "Denaturation of tertiary protein chains and mRNA lipid nanoparticle degradation above 8.0°C; "
            "results in irreversible antigenic potency loss requiring mandatory quarantine under WHO/FDA GDP."
        ),
        "spoilage_mechanism_hi": (
            "8.0°C से ऊपर mRNA लिपिड नैनोपार्टिकल और तृतीयक प्रोटीन संरचना का विघटन; "
            "एंटीजेनिक क्षमता की अपूरणीय क्षति जिसके कारण WHO/FDA नियमों के तहत अनिवार्य क्वारंटाइन आवश्यक है।"
        ),
        "spoilage_mechanism_mr": (
            "८.०°C पेक्षा जास्त तापमानात mRNA लिपिड नॅनोपार्टिकल आणि प्रोटिन रचनेचे विघटन; "
            "अपरिवर्तनीय गुणवत्ता हानीमुळे WHO/FDA नियमांनुसार अनिवार्य क्वारंटाइन आवश्यक."
        ),
        "regulatory_standard": "WHO Annex 5 / FDA 21 CFR Part 211.142",
        "items": [
            "COVID-19 mRNA Vaccine Vials (Comirnaty / Spikevax) - 4,200 doses ($65,000 USD)",
            "Pediatric MMR, Varicella & Rotavirus Vaccines - 3,500 doses ($42,000 USD)",
            "Recombinant Human Insulin (Glargine & Lispro) - 2,800 cartridges ($31,000 USD)",
            "Monoclonal Antibodies & Oncology Immunotherapies - 1,100 vials ($48,000 USD)",
        ],
        "items_hi": [
            "COVID-19 mRNA वैक्सीन शीशियां (Comirnaty / Spikevax) - 4,200 खुराक ($65,000 USD)",
            "बाल चिकित्सा MMR, वेरिसेला एवं रोटावायरस वैक्सीन - 3,500 खुराक ($42,000 USD)",
            "पुनः संयोजक मानव इंसुलिन (Glargine & Lispro) - 2,800 कार्ट्रिज ($31,000 USD)",
            "मोनोक्लोनल एंटीबॉडीज एवं ऑन्कोलॉजी इम्यूनोथेरेपी - 1,100 शीशियां ($48,000 USD)",
        ],
        "items_mr": [
            "COVID-19 mRNA लस कुपी (Comirnaty / Spikevax) - ४,२०० डोस ($65,000 USD)",
            "बालरोग MMR, व्हेरिसेला आणि रोटाव्हायरस लस - ३,५०० डोस ($42,000 USD)",
            "रिकॉम्बीनंट मानवी इन्सुलिन (Glargine & Lispro) - २,८०० काडतुसे ($31,000 USD)",
            "मोनोक्लोनल अँटीबॉडीज आणि ऑन्कोलॉजी इम्युनोथेरपी - १,१०० कुपी ($48,000 USD)",
        ],
        "thermal_tau_minutes": 120.0,  # Deep product core thermal inertia
        "infiltration_rate_c_min": 0.82,  # Air warming rate when door opened
    },
    "zone-b": {
        "zone_id": "zone-b",
        "name": "Dairy Chiller B",
        "name_hi": "डेयरी चिलर B",
        "name_mr": "डेअरी चिलर B",
        "name_es": "Cámara de Lácteos B",
        "product": "Milk, Yoghurt & Cheese",
        "product_hi": "दूध, दही एवं पनीर",
        "product_mr": "दूध, दही आणि चीज",
        "batch_id": "LOT-DAIRY-884B",
        "mass_kg": 2400,
        "unit_cost_inr": 120,
        "gross_usd": 26500.0,
        "gross_inr": 26500.0 * USD_TO_INR,
        "setpoint": 4.0,
        "lower_limit": 0.0,
        "upper_limit": 6.0,
        "spoilage_threshold_c": 6.0,
        "spoilage_mechanism": (
            "Proliferation of psychrotrophic bacteria (Pseudomonas, Listeria monocytogenes) accelerating casein proteolysis "
            "and lactic acidification above 6.0°C; causes premature curdling and renders stock unsellable within 2-4 hours."
        ),
        "spoilage_mechanism_hi": (
            "6.0°C से ऊपर साइक्रोट्रॉफिक बैक्टीरिया का प्रसार जो कैसिइन प्रोटियोलिसिस को तेज करता है; "
            "2 से 4 घंटे के भीतर दूध के खट्टे होने और स्टॉक खराब होने का खतरा।"
        ),
        "spoilage_mechanism_mr": (
            "६.०°C पेक्षा जास्त तापमानात जीवाणूंची वाढ व दुग्धाम्लाची निर्मिती; "
            "२ ते ४ तासांत दूध नासणे व साठा पूर्णपणे खराब होण्याचा धोका."
        ),
        "regulatory_standard": "USDA Grade A Pasteurized Milk Ordinance (PMO)",
        "items": [
            "Grade-A Pasteurized Whole & Skim Milk Cartons - 1,800 units ($5,400 USD)",
            "Artisan Live-Culture Greek Yoghurts & Kefir - 950 jars ($6,650 USD)",
            "Soft Fresh Cheeses (Mozzarella, Ricotta, Brie) - 620 kg ($9,920 USD)",
            "Heavy Whipping Cream & Custards - 480 liters ($4,530 USD)",
        ],
        "items_hi": [
            "ग्रेड-ए पाश्चुरीकृत होल एवं स्किम्ड दूध कार्टन - 1,800 यूनिट ($5,400 USD)",
            "आर्टिसन लाइव-कल्चर ग्रीक योगर्ट एवं केफिर - 950 जार ($6,650 USD)",
            "नरम ताज़ा पनीर (मोज़ेरेला, रिकोटा, ब्री) - 620 kg ($9,920 USD)",
            "हैवी व्हिपिंग क्रीम एवं कस्टर्ड - 480 लीटर ($4,530 USD)",
        ],
        "items_mr": [
            "ग्रेड-ए पाश्चराइज्ड दूध कार्टन - १,८०० युनिट्स ($5,400 USD)",
            "ग्रीक योगर्ट आणि केफिर - ९५० जार ($6,650 USD)",
            "ताजे चीज (मोझरेला, रिकोटा) - ६२० किलो ($9,920 USD)",
            "हेवी व्हिपिंग क्रीम - ४८० लिटर ($4,530 USD)",
        ],
        "thermal_tau_minutes": 180.0,
        "infiltration_rate_c_min": 0.65,
    },
    "zone-c": {
        "zone_id": "zone-c",
        "name": "Frozen Store C",
        "name_hi": "फ्रोजन स्टोर C",
        "name_mr": "फ्रोजन स्टोअर C",
        "name_es": "Cámara de Congelados C",
        "product": "Frozen Seafood, Poultry & Cryogenic Stocks",
        "product_hi": "फ्रोजन समुद्री भोजन, पोल्ट्री एवं क्रायोजेनिक स्टॉक",
        "product_mr": "गोठवलेले सीफूड, पोल्ट्री आणि क्रायोजेनिक साठा",
        "batch_id": "LOT-CRYO-411C",
        "mass_kg": 3100,
        "unit_cost_inr": 85,
        "gross_usd": 48000.0,
        "gross_inr": 48000.0 * USD_TO_INR,
        "setpoint": -20.0,
        "lower_limit": -25.0,
        "upper_limit": -15.0,
        "spoilage_threshold_c": -15.0,
        "spoilage_mechanism": (
            "Recrystallization of microscopic ice crystals above -15.0°C causing cellular wall puncture, enzymatic lipid oxidation, "
            "and moisture purge; irreversible texture damage and freezer burn."
        ),
        "spoilage_mechanism_hi": (
            "-15.0°C से ऊपर सूक्ष्म बर्फ क्रिस्टल का पुन: क्रिस्टलीकरण जिससे कोशिकीय दीवारें फट जाती हैं; "
            "एंजाइमी लिपिड ऑक्सीकरण और फ्रिजर बर्न से उत्पाद की गुणवत्ता नष्ट।"
        ),
        "spoilage_mechanism_mr": (
            "-१५.०°C पेक्षा जास्त तापमानात बर्फाचे स्फटिक वितळून पेशींची हानी व फटकळपणा निर्माण होणे; "
            "फ्रीझर बर्नमुळे उत्पादनाची गुणवत्ता नष्ट होणे."
        ),
        "regulatory_standard": "Codex Alimentarius Code of Practice for Frozen Foods (CAC/RCP 8-1976)",
        "items": [
            "Wild-Caught IQF Atlantic Salmon & Cod Fillets - 1,200 kg ($19,200 USD)",
            "Flash-Frozen Organic Poultry & Prime Cuts - 980 kg ($11,760 USD)",
            "Prepared Cold-Chain Ready Meals & Pastries - 650 kg ($7,840 USD)",
            "Cryogenic Biological Culture Stocks - 270 kg ($9,200 USD)",
        ],
        "items_hi": [
            "वाइल्ड-कॉट IQF अटलांटिक सैल्मन एवं कॉड फ़िलेट्स - 1,200 kg ($19,200 USD)",
            "फ्लैश-फ्रोजन ऑर्गेनिक पोल्ट्री एवं प्राइम कट्स - 980 kg ($11,760 USD)",
            "कोल्ड-चेन रेडी मील्स एवं पेस्ट्रीज - 650 kg ($7,840 USD)",
            "क्रायोजेनिक बायोलॉजिकल कल्चर स्टॉक्स - 270 kg ($9,200 USD)",
        ],
        "items_mr": [
            "वाइल्ड-कॉट अटलांटिक सॅल्मन आणि कॉड - १,२०० किलो ($19,200 USD)",
            "फ्लॅश-फ्रोजन ऑरगॅनिक पोल्ट्री - ९८० किलो ($11,760 USD)",
            "कोल्ड-चेन तयार जेवण - ६५० किलो ($7,840 USD)",
            "क्रायोजेनिक बायोलॉजिकल कल्चर साठा - २७० किलो ($9,200 USD)",
        ],
        "thermal_tau_minutes": 240.0,
        "infiltration_rate_c_min": 1.15,
    },
}

TOTAL_FACILITY_GROSS_USD = sum(c["gross_usd"] for c in SYSTEM_COMMODITIES.values())
TOTAL_FACILITY_GROSS_INR = TOTAL_FACILITY_GROSS_USD * USD_TO_INR


# Comprehensive Multi-Lingual Keyword Taxonomy
SYSTEM_KEYWORD_TAXONOMY: Dict[str, Dict[str, Any]] = {
    "situation_financial_loss": {
        "description": "Situation-based financial loss, What-If loss simulator, cost damage from open doors, cooling disruption",
        "keywords": [
            "financial loss", "financial losses", "loss if door", "loss if open", "loss occur",
            "loss will occur", "cost loss", "how much loss", "what loss", "damage cost",
            "monetary loss", "dollar loss", "rupee loss", "capital at risk", "what-if loss",
            "what if loss", "situation based loss", "situation loss", "potential exposure",
            "financial impact", "inventory loss", "cost affect", "how much cost", "exposure cost",
            # Hindi
            "वित्तीय नुकसान", "पूंजी नुकसान", "पूंजी हानि", "कितना नुकसान", "नुकसान होगा",
            "क्या नुकसान होगा", "दरवाजा खुला नुकसान", "दरवाजा खुला हानि", "खर्चा", "लागत नुकसान",
            "कितना लॉस", "फाइनेंशियल लॉस", "लॉस होगा", "वित्तीय प्रभाव",
            # Marathi
            "आर्थिक नुकसान", "किती नुकसान", "नुकसान होईल", "दरवाजा उघडा नुकसान", "पैशांचे नुकसान",
            "भांडवली जोखीम", "संभाव्य नुकसान", "नुकसान काय होईल", "तोटा", "आर्थिक फटका", "किती तोटा", "नुकसान किती होईल",
            # Spanish
            "pérdida financiera", "cuánto se pierde", "pérdida si puerta abierta", "costo de daño",
        ],
        "weight": 3.0,
    },
    "door_open_simulation": {
        "description": "Chamber door opened, infiltration warming, recovery time, breach timeline",
        "keywords": [
            "door open", "door opened", "keep open", "kept open", "leave open", "leaving door",
            "open the door", "open door for", "door left open", "door open 10 min", "door 10 minutes",
            "open 5 min", "open 15 min", "open 30 min", "what happens if door", "door what if",
            # Hindi
            "दरवाजा खुला", "दरवाजा खोल", "दरवाजा खुला छोड़", "द्वार खुला", "दरवाजा 10 मिनट",
            "अगर दरवाजा", "यदि दरवाजा",
            # Marathi
            "दरवाजा उघडा", "दरवाजा उघडला", "दरवाजा उघडा ठेवला", "दरवाजा उघडा राहिला", "दार उघडे",
            "दार उघडले", "जर दरवाजा", "जर दार", "१० मिनिटे", "९० मिनिटे", "मिनिटे उघडा", "मिनिट उघडे",
            # Spanish
            "puerta abierta", "abrir la puerta", "dejar abierta",
        ],
        "weight": 2.5,
    },
    "inventory_products": {
        "description": "Commodities, lots, batches, dosages, vaccines, dairy, frozen foods, asset values",
        "keywords": [
            "which products", "what products", "products in", "items in", "stored in",
            "inventory in", "what is stored", "stock", "batches", "lot id", "vaccine",
            "insulin", "salmon", "milk", "cheese", "poultry", "cartridges", "doses",
            # Hindi
            "कौन से उत्पाद", "क्या सामान", "स्टॉक", "वैक्सीन", "इंसुलिन", "दूध", "मछली",
            # Marathi
            "कोणती उत्पादने", "काय साठवले आहे", "उत्पादने", "लस", "इन्सुलिन", "दूध", "मासे", "साठा", "माल",
            # Spanish
            "qué productos", "inventario", "artículos",
        ],
        "weight": 2.0,
    },
    "current_temperature": {
        "description": "Live chamber thermocouple readings, limits, and setpoints",
        "keywords": [
            "current temperature", "temperature reading", "temp right now", "what is the temperature",
            "reading right now", "live temp", "chamber temperature", "zone temperature",
            # Hindi
            "वर्तमान तापमान", "तापमान क्या है", "रीडिंग", "लाइव तापमान",
            # Marathi
            "सध्याचे तापमान", "तापमान काय आहे", "तापमान किती", "चेंबर तापमान", "लाइव्ह तापमान",
            # Spanish
            "temperatura actual", "cuál es la temperatura",
        ],
        "weight": 1.5,
    },
    "equipment_failure": {
        "description": "Compressor trip, power outage, condenser failure, electrical load",
        "keywords": [
            "compressor fail", "compressor stop", "power outage", "blackout", "cooling failure",
            "compressor trip", "power fail", "kw load", "electricity cut",
            # Hindi
            "कंप्रेसर बंद", "बिजली चली", "कंप्रेसर खराब", "पावर कट",
            # Marathi
            "कॉम्प्रेसर बंद", "वीज गेली", "पॉवर कट", "कॉम्प्रेसर बिघाड", "कूलिंग बिघाड", "विद्युत पुरवठा",
            # Spanish
            "fallo del compresor", "corte de luz",
        ],
        "weight": 2.0,
    },
    "blockchain_audit": {
        "description": "FDA 21 CFR Part 11 cryptographic tamper-proof ledger, Merkle roots, SHA-256",
        "keywords": [
            "blockchain", "merkle", "audit trail", "tamper", "hash verification", "21 cfr",
            "part 11", "cryptographic", "block height",
            # Hindi
            "ब्लॉकचेन", "ऑडिट लेजर", "अपरिवर्तनीय", "हैश",
            # Marathi
            "ब्लॉकचेन", "ऑडिट ट्रेल", "अपरिवर्तनीय लेजर", "मर्कल लेजर",
            # Spanish
            "cadena de bloques", "pista de auditoría",
        ],
        "weight": 2.0,
    },
    "sensor_health": {
        "description": "Thermocouple calibration, drift, noise, sensor faults",
        "keywords": [
            "sensor health", "sensor fault", "sensor anomaly", "rtd drift", "calibration",
            # Hindi
            "सेंसर स्वास्थ्य", "सेंसर खराब",
            # Marathi
            "सेन्सर आरोग्य", "सेन्सर बिघाड", "सेन्सर अचूकता",
            # Spanish
            "salud del sensor",
        ],
        "weight": 1.5,
    },
    "recommended_actions": {
        "description": "SOP protocols, corrective actions, quarantine procedures",
        "keywords": [
            "sop", "recommended action", "what should i do", "action plan", "sop-01",
            "sop-02", "sop-03", "sop-04", "corrective action",
            # Hindi
            "अनुशंसित कार्रवाई", "क्या करना चाहिए", "एसओपी",
            # Marathi
            "शिफारस केलेली कृती", "काय करावे", "एसओपी", "उपाय", "कृती योजना",
            # Spanish
            "acción recomendada", "protocolo sop",
        ],
        "weight": 1.5,
    },
}


def calculate_situation_financial_loss(
    target_zone_id: Optional[str],
    situation: str = "door_open",
    duration_minutes: float = 10.0,
    telemetry_zones: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Calculates situation-based financial exposure and physical loss.

    Uses the exact physics and economic formulas from the Manager Dashboard
    What-If Loss Simulator:
    - Dual-mass convective warm air infiltration
    - Thermal overdrive over critical spoilage threshold
    - Spoilage % = min(100, 20 + thermal_overdrive*18 + duration_hours*12) if breached
    - Segregation of Potential Exposure (capital under GxP quarantine) vs Realized Loss
    """
    zones_to_evaluate = [target_zone_id] if target_zone_id and target_zone_id in SYSTEM_COMMODITIES else list(SYSTEM_COMMODITIES.keys())
    t_ambient = 25.0
    duration_hours = max(0.1, duration_minutes / 60.0)

    results_by_zone: Dict[str, Any] = {}
    total_projected_loss_usd = 0.0
    total_projected_loss_inr = 0.0
    total_potential_exposure_usd = 0.0
    total_potential_exposure_inr = 0.0

    for zid in zones_to_evaluate:
        prof = SYSTEM_COMMODITIES[zid]
        z_telemetry = (telemetry_zones or {}).get(zid, {})

        # Base current temperature
        try:
            raw_t = z_telemetry.get("raw_temperature")
            t_base = float(raw_t) if raw_t is not None else prof["setpoint"]
        except Exception:
            t_base = prof["setpoint"]

        infilt_rate = prof["infiltration_rate_c_min"]
        threshold = prof["spoilage_threshold_c"]
        gross_usd = prof["gross_usd"]
        gross_inr = prof["gross_inr"]

        # Physics warming during door opening
        warming_delta = min(t_ambient - t_base, infilt_rate * duration_minutes)
        projected_air_temp = round(t_base + warming_delta, 2)
        residual = min(2.5, round(0.08 * duration_minutes * ((t_ambient - projected_air_temp) / 18.0), 2))
        peak_temp = round(projected_air_temp + residual, 2)

        # Deep liquid core temperature
        tau = prof["thermal_tau_minutes"]
        core_temp = round(t_base + (t_ambient - t_base) * (1.0 - math.exp(-duration_minutes / tau)), 2)

        # Threshold evaluation
        exceeds_threshold = peak_temp > threshold
        thermal_overdrive = max(0.0, peak_temp - threshold)
        breach_time_min = max(0.5, round((threshold - t_base) / infilt_rate, 1)) if t_base < threshold else 0.0

        core_breached = core_temp > threshold
        core_overdrive = max(0.0, core_temp - threshold)

        # Spoilage Percentage calculation
        if exceeds_threshold:
            exposure_usd = gross_usd
            exposure_inr = gross_inr
            if duration_minutes <= 15.0:
                # Core liquid inertia protects interior payload if promptly re-sealed
                spoilage_pct = 0.0
                loss_usd = 0.0
                loss_inr = 0.0
            elif duration_minutes <= 45.0:
                # Moderate/partial exposure: outer packaging and boundary layers degrade
                spoilage_pct = min(60.0, round(15.0 + (duration_minutes - 15.0) * 1.5, 1))
                loss_usd = round((gross_usd * spoilage_pct) / 100.0, 2)
                loss_inr = round((gross_inr * spoilage_pct) / 100.0, 2)
            else:
                # Extended exposure (>45m, e.g. 90m): total/near-total catastrophic degradation
                spoilage_pct = min(100.0, round(60.0 + (duration_minutes - 45.0) * 1.0 + core_overdrive * 10.0, 1))
                loss_usd = round((gross_usd * spoilage_pct) / 100.0, 2)
                loss_inr = round((gross_inr * spoilage_pct) / 100.0, 2)
        else:
            spoilage_pct = 0.0
            exposure_usd = 0.0
            exposure_inr = 0.0
            loss_usd = 0.0
            loss_inr = 0.0

        salvage_usd = round(gross_usd - loss_usd, 2)
        salvage_inr = round(gross_inr - loss_inr, 2)

        # Pull-down recovery
        pull_down_rate = 0.28  # °C/min
        recovery_time_min = round(max(2.0, (peak_temp - prof["setpoint"]) / pull_down_rate), 1)

        zone_res = {
            "zone_id": zid,
            "name": prof["name"],
            "name_hi": prof["name_hi"],
            "name_mr": prof.get("name_mr", prof["name"]),
            "product": prof["product"],
            "product_hi": prof["product_hi"],
            "product_mr": prof.get("product_mr", prof["product"]),
            "batch_id": prof["batch_id"],
            "mass_kg": prof["mass_kg"],
            "current_temp": t_base,
            "projected_peak_temp": peak_temp,
            "core_temp": core_temp,
            "threshold": threshold,
            "exceeds_threshold": exceeds_threshold,
            "thermal_overdrive": thermal_overdrive,
            "breach_time_min": breach_time_min,
            "spoilage_pct": spoilage_pct,
            "gross_usd": gross_usd,
            "gross_inr": gross_inr,
            "potential_exposure_usd": exposure_usd,
            "potential_exposure_inr": exposure_inr,
            "realized_loss_usd": loss_usd,
            "realized_loss_inr": loss_inr,
            "salvage_usd": salvage_usd,
            "salvage_inr": salvage_inr,
            "recovery_time_min": recovery_time_min,
            "spoilage_mechanism": prof["spoilage_mechanism"],
            "spoilage_mechanism_hi": prof["spoilage_mechanism_hi"],
            "spoilage_mechanism_mr": prof.get("spoilage_mechanism_mr", prof["spoilage_mechanism"]),
            "items": prof["items"],
            "items_hi": prof["items_hi"],
            "items_mr": prof.get("items_mr", prof["items"]),
        }
        results_by_zone[zid] = zone_res

        total_potential_exposure_usd += exposure_usd
        total_potential_exposure_inr += exposure_inr
        total_projected_loss_usd += loss_usd
        total_projected_loss_inr += loss_inr

    is_single = len(zones_to_evaluate) == 1
    target_profile = results_by_zone[zones_to_evaluate[0]] if is_single else None

    return {
        "situation": situation,
        "duration_minutes": duration_minutes,
        "is_single_zone": is_single,
        "target_zone": target_profile,
        "zones": results_by_zone,
        "total_facility_gross_usd": TOTAL_FACILITY_GROSS_USD,
        "total_facility_gross_inr": TOTAL_FACILITY_GROSS_INR,
        "total_potential_exposure_usd": total_potential_exposure_usd,
        "total_potential_exposure_inr": total_potential_exposure_inr,
        "total_projected_loss_usd": total_projected_loss_usd,
        "total_projected_loss_inr": total_projected_loss_inr,
        "total_realized_loss_usd": total_projected_loss_usd,
        "total_realized_loss_inr": total_projected_loss_inr,
        "total_remaining_protected_usd": TOTAL_FACILITY_GROSS_USD - total_potential_exposure_usd,
        "total_remaining_protected_inr": TOTAL_FACILITY_GROSS_INR - total_potential_exposure_inr,
    }


def match_system_keywords(message: str) -> Dict[str, Any]:
    """Strict keyword matching against the ColdGuard domain dictionary.

    Returns detected intent, target zone, duration, and whether a situation
    financial loss inquiry is active.
    """
    m = message.lower()

    # 1. Target zone detection
    target_zone: Optional[str] = None
    if any(k in m for k in ["zone a", "zone-a", "vaccine", "biologics", "वैक्सीन", "इंसुलिन", "लस", "लस साठा"]):
        target_zone = "zone-a"
    elif any(k in m for k in ["zone b", "zone-b", "dairy", "chiller b", "milk", "cheese", "डेयरी", "दूध", "डेअरी", "दही"]):
        target_zone = "zone-b"
    elif any(k in m for k in ["zone c", "zone-c", "frozen", "store c", "salmon", "seafood", "cryo", "फ्रोजन", "मासे", "सीफूड"]):
        target_zone = "zone-c"

    # 2. Duration extraction (default to 10 minutes for what-if door simulations)
    duration_min = 10.0
    dur_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:min|minute|मिनट|मिनिटे|मिनिट|m\b)", m)
    if dur_match:
        try:
            duration_min = float(dur_match.group(1))
        except ValueError:
            duration_min = 10.0
    else:
        hr_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hour|hr|घंटे|घंटा|तास|h\b)", m)
        if hr_match:
            try:
                duration_min = float(hr_match.group(1)) * 60.0
            except ValueError:
                duration_min = 10.0

    # 3. Keyword matching across taxonomy
    scores: Dict[str, float] = {}
    for intent_key, data in SYSTEM_KEYWORD_TAXONOMY.items():
        score = 0.0
        for kw in data["keywords"]:
            if kw in m:
                score += data["weight"]
        scores[intent_key] = score

    # Check for situation-based financial inquiry (Loss + Door/Situation)
    is_cost = scores.get("situation_financial_loss", 0.0) > 0
    is_door = scores.get("door_open_simulation", 0.0) > 0 or any(w in m for w in ["door", "open", "दरवाजा", "खोल", "खुला", "दार", "उघडा", "उघडे", "उघडले"])
    is_cooling = scores.get("equipment_failure", 0.0) > 0 or any(w in m for w in ["compressor", "power", "बिजली", "कंप्रेसर", "कॉम्प्रेसर", "वीज"])

    is_situation_financial_inquiry = is_cost and (
        is_door or is_cooling or "situation" in m or "tab" in m or "if i" in m or "अगर" in m or "जर" in m or "राहिला" in m or "ठेवला" in m
    )

    # Determine highest scoring intent
    best_intent = max(scores, key=scores.get) if any(scores.values()) else "current_temperature"

    return {
        "matched_intent": "situation_financial_loss" if is_situation_financial_inquiry else best_intent,
        "is_situation_financial_inquiry": is_situation_financial_inquiry,
        "target_zone": target_zone,
        "duration_minutes": duration_min,
        "scores": scores,
    }
