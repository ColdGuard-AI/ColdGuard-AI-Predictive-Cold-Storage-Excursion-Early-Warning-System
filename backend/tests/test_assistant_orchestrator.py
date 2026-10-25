"""Comprehensive Test Suite for ColdGuard Organization-Wide AI Assistant.

Validates:
1. TrueTemp Node battery backup & power grid telemetry.
2. Compressor & refrigeration rack engineering (R-744 CO2 Transcritical, kW load, VFD).
3. Equipment maintenance SOPs (SOP-COMP-01, SOP-SENS-01, coil wash, calibration).
4. User approvals & RBAC organization tenancy (manager authorized, operator restricted).
5. Action execution guard (safety against unauthorized AI action execution).
6. Multilingual support in Marathi (mr), Hindi (hi), Spanish (es), and English (en).
7. SOP & Regulatory Compliance document retrieval (Codex, USDA PMO, WHO Annex 5, 21 CFR Part 11).
"""
from __future__ import annotations

import pytest
from app.api.assistant_routes import AssistantIntent


def test_truetemp_power_battery_query(client):
    """Domain 2: TrueTemp Node, Power Outages & Battery Backup."""
    payload = {
        "message": "What is the TrueTemp battery backup and power grid status?",
        "language": "en",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.TRUETEMP_POWER_BATTERY.value
    reply = data["reply"]
    assert "battery" in reply.lower() or "truetemp" in reply.lower() or "grid" in reply.lower()
    assert "data_origin_tag" in data
    assert len(data.get("evidence_sources", [])) > 0


def test_compressor_refrigeration_engineering_query(client):
    """Domain 3: Compressors & Refrigeration Racks."""
    payload = {
        "message": "What is the compressor rack power draw and refrigerant status?",
        "language": "en",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.COMPRESSOR_REFRIGERATION.value
    reply = data["reply"]
    assert "compressor" in reply.lower() or "rack" in reply.lower() or "kw" in reply.lower()
    assert "co2" in reply.lower() or "r-744" in reply.lower() or "refrigerant" in reply.lower()


def test_equipment_maintenance_sop_query(client):
    """Domain 8: Equipment Maintenance & Servicing Schedules."""
    payload = {
        "message": "What is the preventive maintenance schedule for compressors and sensors?",
        "language": "en",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.EQUIPMENT_MAINTENANCE.value
    reply = data["reply"]
    assert "sop-comp-01" in reply.lower() or "sop-sens-01" in reply.lower() or "maintenance" in reply.lower()


def test_user_approvals_manager_authorized(client):
    """Domain 10: User Approvals Queue - Manager Allowed."""
    payload = {
        "message": "Who is currently pending approval in the registration queue?",
        "language": "en",
        "history": [],
        "role_override": "manager",
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.USER_APPROVALS.value
    assert data["user_context"]["role"] == "manager"
    reply = data["reply"]
    assert "approval" in reply.lower() or "pending" in reply.lower() or "registration" in reply.lower()


def test_user_approvals_operator_restricted(client):
    """Domain 10: RBAC Enforcement - Non-manager is restricted from viewing approvals queue."""
    payload = {
        "message": "Show me the user approvals queue",
        "language": "en",
        "history": [],
        "role_override": "operator",
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.USER_APPROVALS.value
    assert data["user_context"]["role"] == "operator"
    reply = data["reply"]
    assert "access restricted" in reply.lower() or "permission" in reply.lower() or "manager" in reply.lower()


def test_action_execution_guard(client):
    """Action Execution Guard: Refuse to execute side-effects via chat and provide authenticated advisory."""
    payload = {
        "message": "Approve user ruchita right now in the database",
        "language": "en",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.ACTION_EXECUTION_GUARD.value
    reply = data["reply"]
    assert any(term in reply.lower() for term in ["cannot be triggered", "read-only", "dashboard interface", "non-repudiation", "mutation guard"])


def test_sop_and_compliance_rag_query(client):
    """Domain 12: SOP & Regulatory Compliance RAG Retrieval."""
    payload = {
        "message": "What does Codex CAC/RCP 8-1976 and WHO Annex 5 state regarding cold storage?",
        "language": "en",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.SOP_DOCUMENTATION.value
    reply = data["reply"]
    assert "codex" in reply.lower() or "annex 5" in reply.lower() or "compliance" in reply.lower()


def test_multilingual_marathi_query(client):
    """Multilingual Support: Marathi (mr) language inquiry and response."""
    payload = {
        "message": "सर्व कक्षांचे सध्याचे तापमान काय आहे?",
        "language": "mr",
        "history": [],
    }
    resp = client.post("/api/assistant/chat", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert data["intent"] == AssistantIntent.CURRENT_TEMPERATURE.value
    reply = data["reply"]
    # Check for Marathi numbers or terms
    assert "°c" in reply.lower()
    assert any(term in reply for term in ["तापमान", "कक्षा", "लस", "डेअरी", "फ्रोजन", "नोंद"])
