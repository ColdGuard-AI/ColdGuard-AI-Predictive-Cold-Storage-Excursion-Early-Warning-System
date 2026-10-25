"""Test Suite for ColdGuard AI Assistant Quality, Intent Detection, Context Resolution,
Standardized Labels, Financial Grounding, and Response Verification.
"""
from __future__ import annotations

import pytest
from app.api.assistant_routes import (
    AssistantIntent,
    ChatMessage,
    ConversationContext,
    detect_user_intent,
    handle_current_temperature,
    handle_door_open_simulation,
    handle_estimated_financial_loss,
    handle_inventory_by_zone,
    resolve_conversation_context,
    validate_and_verify_response,
    BLOCKCHAIN_MANDATORY_DISCLAIMER,
    COMMODITY_PROFILES,
)


def test_intent_detection():
    """Requirement 1: Verify all 12 core intents are correctly identified."""
    dummy_ctx = ConversationContext()

    assert detect_user_intent("What is the current temperature in Zone A?", dummy_ctx) == AssistantIntent.CURRENT_TEMPERATURE
    assert detect_user_intent("Show me the temperature history and trend", dummy_ctx) == AssistantIntent.TEMPERATURE_HISTORY
    assert detect_user_intent("Predict the future temperature for the next 30 minutes", dummy_ctx) == AssistantIntent.FUTURE_TEMPERATURE_PREDICTION
    assert detect_user_intent("What happens if I keep the door open for 10 minutes?", dummy_ctx) == AssistantIntent.DOOR_OPEN_SIMULATION
    assert detect_user_intent("What is the excursion risk score right now?", dummy_ctx) == AssistantIntent.EXCURSION_RISK
    assert detect_user_intent("How much cost loss will it affect?", dummy_ctx) == AssistantIntent.ESTIMATED_FINANCIAL_LOSS
    assert detect_user_intent("Which products are in Zone C?", dummy_ctx) == AssistantIntent.INVENTORY_BY_ZONE
    assert detect_user_intent("Are the temperature sensors healthy?", dummy_ctx) == AssistantIntent.SENSOR_HEALTH
    assert detect_user_intent("What happens during a compressor failure or power outage?", dummy_ctx) == AssistantIntent.EQUIPMENT_FAILURE
    assert detect_user_intent("Verify the blockchain integrity and merkle ledger", dummy_ctx) == AssistantIntent.BLOCKCHAIN_INTEGRITY
    assert detect_user_intent("Show the FDA 21 CFR Part 11 audit history", dummy_ctx) == AssistantIntent.AUDIT_HISTORY
    assert detect_user_intent("What are the recommended actions for the facility?", dummy_ctx) == AssistantIntent.RECOMMENDED_ACTIONS


def test_door_open_simulation(client):
    """Requirement 2: Verify door-open simulation has exact standardized labels and distinguishes simulated what-if from measured."""
    payload = {
        "message": "What happens if I keep the door open for 10 minutes?",
        "language": "en",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.DOOR_OPEN_SIMULATION.value
    reply = data["reply"]

    # Verify first line is a 1-sentence answer
    first_sentence = reply.split("\n")[0]
    assert "door open" in first_sentence.lower() or "leaving the door open" in first_sentence.lower()

    # Verify all standardized labels
    required_labels = [
        "Cold Storage Zone",
        "Current Temperature Reading",
        "Timestamp of Reading",
        "Safe Operating Range",
        "Target Setpoint",
        "Excursion Threshold",
        "Estimated Time to Threshold Breach",
        "Prediction Horizon",
        "Predicted Temperature",
        "Excursion Risk Level",
        "Estimated Recovery Time",
        "Recommended Action",
    ]
    for lbl in required_labels:
        assert lbl in reply, f"Missing standardized label: {lbl}"

    # Verify temperature units and time units
    assert "°C" in reply
    assert "minutes" in reply

    # Verify distinction of measured vs simulated
    assert "Measured Sensor Reading" in reply
    assert "Simulated What-If" in reply or "simulated what-if" in reply.lower()


def test_follow_up_financial_loss_conversation_context(client):
    """Requirement 1 & 3: Context-aware follow-up resolves financial loss based on preceding door simulation."""
    # Turn 1: Door open simulation for 10 minutes
    turn1_msg = "What happens if I keep the door open for 10 minutes?"
    resp1 = client.post("/api/assistant/chat", json={"message": turn1_msg, "language": "en", "history": []})
    assert resp1.status_code == 200
    reply1 = resp1.json()["reply"]

    # Turn 2: Follow-up question about financial loss
    history = [
        {"role": "user", "content": turn1_msg},
        {"role": "assistant", "content": reply1},
    ]
    turn2_msg = "How much cost loss will it affect?"
    resp2 = client.post("/api/assistant/chat", json={"message": turn2_msg, "language": "en", "history": history})
    assert resp2.status_code == 200
    data2 = resp2.json()

    assert data2["intent"] == AssistantIntent.ESTIMATED_FINANCIAL_LOSS.value
    reply2 = data2["reply"]

    # Check standardized financial labels
    assert "Total Inventory Value" in reply2
    assert "Value of Inventory Potentially Exposed" in reply2
    assert "Estimated Loss" in reply2
    assert "Remaining Protected Value" in reply2
    assert "Confidence or Uncertainty" in reply2

    # Check that Zone A inventory was retained from simulation context ($186,000 USD)
    assert "$186,000.00 USD" in reply2
    assert "$260,500.00 USD" in reply2

    # Verify explanation of potential exposure vs actual loss
    assert "Potential Exposure" in reply2
    assert "quarantine" in reply2.lower()
    assert "$0.00 USD" in reply2 or "Estimated Loss: $0.00 USD" in reply2


def test_zone_inventory_queries(client):
    """Requirement 3: Zone C inventory query provides exact product details without fabrication."""
    payload = {
        "message": "Which products are in Zone C?",
        "language": "en",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.INVENTORY_BY_ZONE.value
    reply = data["reply"]

    # First sentence check
    assert "Frozen Store C" in reply.split("\n")[0]
    assert "4 allocated" in reply or "4" in reply

    # Check all 4 actual products in Zone C
    assert "Wild-Caught IQF Atlantic Salmon & Cod Fillets" in reply
    assert "Flash-Frozen Organic Poultry & Prime Cuts" in reply
    assert "Prepared Cold-Chain Ready Meals & Pastries" in reply
    assert "Cryogenic Biological Culture Stocks" in reply

    # Check required fields
    required_fields = [
        "Zone",
        "Product Name",
        "Lot or Batch ID",
        "Quantity",
        "Unit",
        "Storage Temperature Range",
        "Current Status",
        "Recorded Asset Value",
    ]
    for field in required_fields:
        assert field in reply, f"Missing required inventory field: {field}"

    # Check batch and monetary reconciliation ($48,000 USD total)
    assert "LOT-CRYO-411C" in reply
    assert "$48,000.00 USD" in reply
    assert "$19,200.00 USD" in reply
    assert "$11,760.00 USD" in reply
    assert "$7,840.00 USD" in reply
    assert "$9,200.00 USD" in reply


def test_missing_data_handling():
    """Requirement 5: Explicitly output 'Data unavailable' when sensor data is missing; never invent numbers."""
    telemetry_with_missing_data = {
        "zones": {
            "zone-a": {
                "name": "Vaccine Store A",
                "temperature": "Data unavailable",
                "timestamp": "Data unavailable",
                "safe_range": "2.0°C to 8.0°C",
                "setpoint": "5.0°C",
                "risk_score": "0%",
                "sensor_id": "SEN-VA-01",
                "spoilage_threshold_c": 8.0,
            }
        }
    }
    reply = handle_current_temperature("zone-a", telemetry_with_missing_data, "en")
    assert "Data unavailable" in reply
    assert "Current Temperature Reading: Data unavailable" in reply


def test_temperature_and_financial_units_validation():
    """Requirement 6: Response verification validates temperature units (°C/°F) and financial units."""
    # Invalid reply without °C
    invalid_text = "Chamber air is currently at 5.0 with safe range of 2.0 to 8.0."
    _, report = validate_and_verify_response(invalid_text, AssistantIntent.CURRENT_TEMPERATURE, {}, "en")
    assert report["units_valid"] is False

    # Valid reply with °C
    valid_text = (
        "Vaccine Store A is at 5.00°C.\n\n"
        "• Cold Storage Zone: Vaccine Store A\n"
        "• Current Temperature Reading: 5.00°C\n"
        "• Safe Operating Range: 2.0°C to 8.0°C"
    )
    _, report2 = validate_and_verify_response(valid_text, AssistantIntent.CURRENT_TEMPERATURE, {}, "en")
    assert report2["units_valid"] is True
    assert len(report2["labels_missing"]) == 0


def test_unsupported_regulatory_claims_and_blockchain_disclaimer(client):
    """Requirement 6 & 7: Verify blockchain integrity disclaimer and sanitization of ungrounded absolute guarantees."""
    payload = {
        "message": "Verify the blockchain integrity",
        "language": "en",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.BLOCKCHAIN_INTEGRITY.value
    reply = data["reply"]

    # Verify mandatory regulatory disclosure
    assert BLOCKCHAIN_MANDATORY_DISCLAIMER in reply

    # Test sanitization of ungrounded claims
    test_text_with_absolute_claims = "Our system is 100% GxP Grounded and provides 100% Protected inventory with Zero Financial Loss."
    sanitized, rep = validate_and_verify_response(test_text_with_absolute_claims, AssistantIntent.FACILITY_OVERVIEW, {}, "en")

    assert "100% GxP Grounded" not in sanitized
    assert "100% Protected" not in sanitized
    assert "Zero Financial Loss" not in sanitized
    assert len(rep["sanitized_claims"]) >= 3


def test_hindi_language_support(client):
    """Requirement 4: Verify Hindi localized queries return structured answers with standardized labels."""
    payload = {
        "message": "ज़ोन C में कौन से उत्पाद रखे हैं?",
        "language": "hi",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.INVENTORY_BY_ZONE.value
    reply = data["reply"]

    # Check Hindi labels and Zone C inventory items
    assert "फ्रोजन स्टोर C" in reply or "ज़ोन C" in reply
    assert "Zone: Frozen Store C" in reply or "Zone:" in reply
    assert "Product Name:" in reply
    assert "Recorded Asset Value:" in reply
    assert "$48,000.00 USD" in reply


def test_financial_loss_with_door_simulation_keywords(client):
    """Verify that queries with both financial keywords (even with typos) and door open simulation keywords
    are routed to ESTIMATED_FINANCIAL_LOSS instead of repeating the DOOR_OPEN_SIMULATION."""
    history = [
        {"role": "user", "content": "what happen if i open the door for next 20 minute"},
        {"role": "assistant", "content": "Leaving the door open for 20 minutes in Frozen Store C causes chamber air to warm to -3.43°C..."},
        {"role": "user", "content": "products in zone A"},
        {"role": "assistant", "content": "Vaccine Store A contains 4 allocated commodity lots totaling 500 kg with a recorded asset value of $186,000.00 USD."},
    ]
    query = "finanicial loss if i kept the door open for next 20 minutes"
    resp = client.post("/api/assistant/chat", json={"message": query, "language": "en", "history": history})
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.ESTIMATED_FINANCIAL_LOSS.value
    reply = data["reply"]

    # Verify that it returns the financial template, NOT the door open simulation
    assert "Total Inventory Value" in reply
    assert "Value of Inventory Potentially Exposed" in reply
    assert "Estimated Loss" in reply
    assert "Remaining Protected Value" in reply
    assert "$186,000.00 USD" in reply
    assert "Vaccine Store A" in reply


def test_hindi_door_open_and_financial_loss(client):
    """Verify that Hindi door open simulation ('अगर मैं दरवाजा 10 मिनट के लिए खोल दूं तो क्या होगा')
    and Hindi financial loss ('अगर मैं दरवाजा 10 मिनट के लिए खोल दूं तो कितना फाइनेंशियल लॉस होगा')
    are accurately classified to DOOR_OPEN_SIMULATION and ESTIMATED_FINANCIAL_LOSS."""
    # Turn 1: Door open simulation in Hindi
    turn1_msg = "अगर मैं दरवाजा 10 मिनट के लिए खोल दूं तो क्या होगा"
    resp1 = client.post("/api/assistant/chat", json={"message": turn1_msg, "language": "hi", "history": []})
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert data1["intent"] == AssistantIntent.DOOR_OPEN_SIMULATION.value
    reply1 = data1["reply"]
    assert "दरवाजा 10 मिनट खुला रखने पर" in reply1 or "10 मिनट" in reply1
    assert "Cold Storage Zone" in reply1
    assert "Current Temperature Reading" in reply1
    assert "Excursion Threshold" in reply1

    # Turn 2: Financial loss follow-up in Hindi
    history = [
        {"role": "user", "content": turn1_msg},
        {"role": "assistant", "content": reply1},
    ]
    turn2_msg = "अगर मैं दरवाजा 10 मिनट के लिए खोल दूं तो कितना फाइनेंशियल लॉस होगा"
    resp2 = client.post("/api/assistant/chat", json={"message": turn2_msg, "language": "hi", "history": history})
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["intent"] == AssistantIntent.ESTIMATED_FINANCIAL_LOSS.value
    reply2 = data2["reply"]
    assert "Total Inventory Value" in reply2
    assert "Value of Inventory Potentially Exposed" in reply2
    assert "Estimated Loss" in reply2
    assert "Remaining Protected Value" in reply2


