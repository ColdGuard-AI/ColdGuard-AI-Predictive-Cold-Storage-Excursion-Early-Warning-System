"""What-If simulator: compare the current trajectory with a hypothetical scenario.

Both projections come from cloned simulator state (the live simulation is never touched):

* baseline  - current conditions continue (including any scenario already active)
* scenario  - the requested change is applied from now

For every projected minute the trained forecaster is run on the projected readings, so we
can report when the AI would first have warned, and how the heuristic risk score evolves.
All results are SIMULATED PROJECTIONS, not predictions about real equipment.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from app.models.features import FORECAST_STEPS
from app.models.forecaster import TemperatureForecaster
from app.simulator.engine import SCENARIOS, Scenario, ZoneSimulator

from .forecasting import batch_forecast_deltas, first_crossing
from .risk import compute_risk

WARNING_HORIZON = 30

RECOMMENDATIONS = {
    "compressor_failure": [
        "Inspect the compressor and verify power supply.",
        "Prepare backup cold storage before the projected limit time.",
        "Keep the door closed to slow the temperature rise.",
    ],
    "door_open": [
        "Check the door seal and close the door.",
        "Review door-open alarms and staff procedures for loading.",
    ],
    "ambient_increase": [
        "Check condenser airflow and ventilation around the refrigeration unit.",
        "Reduce door openings while ambient temperature is elevated.",
        "Inspect refrigeration performance and prepare corrective action.",
    ],
    "normal": [
        "Continue routine monitoring; confirm the temperature returns to setpoint.",
    ],
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
    # "Time to limit" is only meaningful when the zone starts inside its safe range.
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
) -> dict[str, Any]:
    if history.empty:
        raise ValueError("No readings available for this zone yet.")

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

    return {
        "zone_id": cfg.zone_id,
        "scenario": scenario,
        "scenario_label": SCENARIOS[scenario],
        "baseline_label": f"Current conditions continue ({SCENARIOS[live_sim.scenario]})",
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
        "notes": [
            "Simulated projection: trajectories come from the physics-based simulator, not from real equipment.",
            "AI warning time: the minute at which the forecasting model (live early-warning rule), run on the projected readings, first predicts a limit breach within 30 minutes.",
            "Risk values are the heuristic risk score computed at each projected minute.",
        ],
    }
