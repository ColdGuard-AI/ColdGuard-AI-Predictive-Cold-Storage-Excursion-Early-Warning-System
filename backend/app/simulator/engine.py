"""Physics-informed cold-room sensor simulator with stateful door tracking and post-closure thermal dynamics.

Models:
- Infiltration during door openings (warm air ingress, latent and sensible heat).
- Trapped warm air and thermal boundary layer diffusion after closure, causing a
  residual temperature rise that peaks 3-8 minutes post-closure.
- Exponential refrigeration pull-down recovery.
- Power consumption dynamics (fan baseline, compressor load curve, ambient derate, strain).
- Comprehensive fault scenarios: compressor failure, cooling degradation, sensor anomalies,
  abnormal humidity ingress, and fire / thermal runaway.

All data produced here is SIMULATED.
"""
from __future__ import annotations

import copy
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

from .zones import ZoneConfig

SCENARIOS: dict[str, str] = {
    "normal": "Normal Operation",
    "door_open": "Door Left Open",
    "compressor_failure": "Compressor Failure",
    "cooling_degradation": "Cooling System Degradation",
    "ambient_increase": "Ambient Temperature Increase",
    "sensor_anomaly": "Sensor Anomaly",
    "abnormal_humidity": "Abnormal Humidity Ingress",
    "fire_runaway": "Fire / Thermal Runaway",
}

CAPACITY_DERATE_PER_DEG = 0.035
DEFAULT_AMBIENT_DELTA = 18.0
AMBIENT_RAMP_MINUTES = 15


@dataclass
class Scenario:
    kind: str = "normal"
    duration_minutes: int | None = None
    ambient_delta: float = DEFAULT_AMBIENT_DELTA

    def __post_init__(self) -> None:
        if self.kind not in SCENARIOS:
            raise ValueError(f"Unknown scenario '{self.kind}'. Valid: {', '.join(SCENARIOS)}")


@dataclass
class ZoneState:
    temperature: float  # true physical air temperature
    humidity: float
    ambient: float
    compressor_on: bool = True
    door_open: bool = False
    routine_door_remaining: int = 0
    ambient_noise: float = 0.0
    scenario: Scenario = field(default_factory=Scenario)
    scenario_minutes: int = 0
    stuck_value: float | None = None

    # Stateful door event and post-closure thermal recovery tracking
    door_open_seconds: int = 0
    time_since_closure_seconds: int = 0
    last_door_duration_seconds: int = 0
    temp_at_open: float | None = None
    temp_at_close: float | None = None
    ambient_at_open: float | None = None
    residual_rise_predicted: float = 0.0
    peak_temp_predicted: float = 0.0
    recovery_time_minutes: float = 0.0
    recovery_progress_pct: float = 100.0
    recovery_phase: str = "none"  # "none", "residual_rise", "active_recovery", "recovered"
    cumulative_open_seconds_24h: int = 0
    door_events_count_24h: int = 0
    active_door_event_id: int | None = None


class ZoneSimulator:
    def __init__(
        self,
        config: ZoneConfig,
        seed: int,
        start_time: datetime,
        routine_door_openings: bool = False,
    ) -> None:
        self.config = config
        self.rng = np.random.default_rng(seed)
        self.time = start_time
        self.routine_door_openings = routine_door_openings
        self.state = ZoneState(
            temperature=config.setpoint,
            humidity=config.humidity_base,
            ambient=config.ambient_base,
            peak_temp_predicted=config.setpoint,
        )

    # ------------------------------------------------------------------ door control
    def open_door(self, duration_minutes: int | None = None) -> None:
        s = self.state
        if not s.door_open:
            s.door_open = True
            s.temp_at_open = round(s.temperature, 2)
            s.ambient_at_open = round(s.ambient, 2)
            s.door_open_seconds = 0
            s.time_since_closure_seconds = 0
            s.recovery_phase = "none"
        if duration_minutes is not None:
            s.scenario = Scenario(kind="door_open", duration_minutes=duration_minutes)
            s.scenario_minutes = 0

    def close_door(self) -> dict[str, Any]:
        """Transition door from open to closed without resetting risk.
        Computes residual temperature rise, predicted peak, and cooling recovery curve."""
        s, cfg = self.state, self.config
        was_open = s.door_open
        s.door_open = False
        s.routine_door_remaining = 0
        if s.scenario.kind == "door_open":
            s.scenario = Scenario(kind="normal")
            s.scenario_minutes = 0

        dur_sec = max(60, s.door_open_seconds if was_open else s.last_door_duration_seconds)
        dur_min = max(1.0, dur_sec / 60.0)
        s.last_door_duration_seconds = dur_sec
        s.temp_at_close = round(s.temperature, 2)
        s.door_open_seconds = 0
        s.time_since_closure_seconds = 0
        s.door_events_count_24h += 1
        s.cumulative_open_seconds_24h += dur_sec

        # Physics calculation of residual temperature rise after door closure:
        # Hot air trapped inside + warm chamber surface boundary bleeding inwards
        amb_delta = max(0.0, s.ambient - s.temp_at_close)
        residual_rise = min(2.8, round(0.085 * dur_min * (amb_delta / 18.0), 2))
        if dur_min < 2.0:
            residual_rise = min(0.5, round(0.04 * dur_min * (amb_delta / 18.0), 2))

        predicted_peak = round(s.temp_at_close + residual_rise, 2)
        s.residual_rise_predicted = residual_rise
        s.peak_temp_predicted = predicted_peak

        # Time constant for exponential refrigeration recovery:
        tau_rec = 25.0 if cfg.zone_id == "zone-a" else (32.0 if cfg.zone_id == "zone-b" else 42.0)
        delta_to_setpoint = max(0.2, predicted_peak - cfg.setpoint)
        est_recovery_minutes = round(tau_rec * math.log(max(1.15, delta_to_setpoint / 0.25)), 1)
        s.recovery_time_minutes = est_recovery_minutes
        s.recovery_progress_pct = 0.0
        s.recovery_phase = "residual_rise"

        return {
            "zone_id": cfg.zone_id,
            "door_status": "closed",
            "duration_seconds": dur_sec,
            "temp_at_open": s.temp_at_open,
            "temp_at_close": s.temp_at_close,
            "residual_rise_predicted": residual_rise,
            "peak_temp_predicted": predicted_peak,
            "recovery_time_minutes": est_recovery_minutes,
            "recovery_progress_pct": 0.0,
            "recovery_phase": s.recovery_phase,
        }

    # ------------------------------------------------------------------ control
    def set_scenario(self, scenario: Scenario | str) -> None:
        if isinstance(scenario, str):
            scenario = Scenario(kind=scenario)
        self.state.scenario = scenario
        self.state.scenario_minutes = 0
        self.state.stuck_value = None
        if scenario.kind == "normal":
            if self.state.door_open:
                self.close_door()
            else:
                self.state.door_open = False
                self.state.routine_door_remaining = 0
        elif scenario.kind == "door_open":
            s = self.state
            if not s.door_open:
                s.door_open = True
                s.temp_at_open = round(s.temperature, 2)
                s.ambient_at_open = round(s.ambient, 2)
                s.door_open_seconds = 0
                s.time_since_closure_seconds = 0
                s.recovery_phase = "none"

    @property
    def scenario(self) -> str:
        return self.state.scenario.kind

    def clone(self, seed: int | None = None) -> "ZoneSimulator":
        twin = copy.deepcopy(self)
        if seed is not None:
            twin.rng = np.random.default_rng(seed)
        return twin

    # ------------------------------------------------------------------ physics
    def _ambient(self, s: ZoneState) -> float:
        cfg = self.config
        hour = self.time.hour + self.time.minute / 60.0
        daily = 1.5 * math.sin(2 * math.pi * (hour - 9.0) / 24.0)
        s.ambient_noise = 0.97 * s.ambient_noise + float(self.rng.normal(0.0, 0.08))
        ambient = cfg.ambient_base + daily + s.ambient_noise
        if s.scenario.kind == "ambient_increase":
            ramp = min(1.0, (s.scenario_minutes + 1) / AMBIENT_RAMP_MINUTES)
            ambient += s.scenario.ambient_delta * ramp
        return ambient

    def step(self) -> dict[str, Any]:
        cfg, s = self.config, self.state
        kind = s.scenario.kind

        # Auto-reverting scenarios
        if s.scenario.duration_minutes is not None and s.scenario_minutes >= s.scenario.duration_minutes:
            if kind == "door_open":
                self.close_door()
            else:
                self.set_scenario("normal")
            kind = s.scenario.kind

        s.ambient = self._ambient(s)

        # Door state resolution
        if kind == "door_open":
            if not s.door_open:
                self.open_door()
        elif kind == "normal":
            if s.routine_door_remaining > 0:
                s.routine_door_remaining -= 1
                if s.routine_door_remaining == 0:
                    self.close_door()
            elif self.routine_door_openings and self.rng.random() < 1 / 80:
                self.open_door()
                s.routine_door_remaining = int(self.rng.integers(1, 4))

        if s.door_open:
            s.door_open_seconds += 60
            s.time_since_closure_seconds = 0
        else:
            s.time_since_closure_seconds += 60

        # Compressor status & degradation logic
        cooling_efficiency = 1.0
        degradation_strain = 1.0

        if kind == "compressor_failure":
            s.compressor_on = False
            comp_status_str = "stopped"
        elif kind == "cooling_degradation":
            s.compressor_on = True
            comp_status_str = "degraded"
            cooling_efficiency = 0.50
            degradation_strain = 1.30
        elif kind == "fire_runaway":
            s.compressor_on = False
            comp_status_str = "failed"
        else:
            s.compressor_on = True
            comp_status_str = "running"

        # Thermal dynamics
        leak = cfg.k_leak * (s.ambient - s.temperature)
        door_leak = cfg.k_door * (s.ambient - s.temperature) if s.door_open else 0.0
        cooling = 0.0
        compressor_load_pct = 0.0

        if s.compressor_on:
            derate = 1.0 - CAPACITY_DERATE_PER_DEG * max(0.0, s.ambient - cfg.ambient_base)
            capacity = cfg.cooling_max * min(1.0, max(0.3, derate)) * cooling_efficiency
            demand = cfg.k_leak * (cfg.ambient_base - cfg.setpoint) + cfg.kp * (s.temperature - cfg.setpoint)
            cooling = min(capacity, max(0.0, demand))
            if cfg.cooling_max > 0:
                compressor_load_pct = min(100.0, max(0.0, (cooling / cfg.cooling_max) * 100.0))
            if compressor_load_pct < 5.0 and not s.door_open and kind == "normal" and s.recovery_phase in ("none", "recovered"):
                comp_status_str = "idle"
                compressor_load_pct = 0.0
                cooling = 0.0

        # Post-closure thermal wave:
        residual_boost = 0.0
        if not s.door_open and s.recovery_phase in ("residual_rise", "active_recovery"):
            m_since = s.time_since_closure_seconds // 60
            t_peak_arrival = min(6, max(2, int(0.35 * (s.last_door_duration_seconds / 60.0))))
            if m_since <= t_peak_arrival:
                s.recovery_phase = "residual_rise"
                # Inflow of heat from trapped air boundary layer
                residual_boost = (s.residual_rise_predicted / max(1, t_peak_arrival)) * 0.70
                # Compressor is straining against the trapped heat
                compressor_load_pct = min(100.0, compressor_load_pct + 25.0)
                if s.peak_temp_predicted > cfg.setpoint:
                    prog = max(0.0, (s.peak_temp_predicted - s.temperature) / max(0.1, s.peak_temp_predicted - cfg.setpoint)) * 15.0
                    s.recovery_progress_pct = round(prog, 1)
            else:
                s.recovery_phase = "active_recovery"
                # Pull-down recovery
                if s.peak_temp_predicted > cfg.setpoint:
                    prog = max(0.0, (s.peak_temp_predicted - s.temperature) / max(0.1, s.peak_temp_predicted - cfg.setpoint)) * 100.0
                    s.recovery_progress_pct = min(100.0, max(0.0, round(prog, 1)))
                if s.temperature <= cfg.setpoint + 0.25:
                    s.recovery_phase = "recovered"
                    s.recovery_progress_pct = 100.0
                    s.residual_rise_predicted = 0.0

        # Fire / thermal runaway scenario
        fire_heat = 0.0
        if kind == "fire_runaway":
            fire_heat = 1.8 + min(3.0, s.scenario_minutes * 0.2)

        s.temperature += leak + door_leak + residual_boost + fire_heat - cooling + float(self.rng.normal(0.0, 0.008))

        # Power consumption (kW)
        fan_base = 0.45 if cfg.zone_id != "zone-c" else 0.75
        rated_comp_kw = 2.8 if cfg.zone_id == "zone-a" else (4.5 if cfg.zone_id == "zone-b" else 7.2)
        ambient_penalty = 1.0 + 0.025 * max(0.0, s.ambient - 25.0)

        if comp_status_str in ("running", "degraded"):
            comp_kw = rated_comp_kw * (compressor_load_pct / 100.0) * ambient_penalty * degradation_strain
            power_kw = fan_base + comp_kw + float(self.rng.normal(0.0, 0.04))
        elif comp_status_str == "idle":
            power_kw = fan_base + float(self.rng.normal(0.0, 0.02))
        else:
            power_kw = (fan_base * 0.4) + float(self.rng.normal(0.0, 0.01))

        power_kw = max(0.1, round(power_kw, 2))

        # Humidity dynamics
        target_h = cfg.humidity_door if s.door_open else cfg.humidity_base
        if not s.compressor_on:
            target_h += 10.0
        if kind == "abnormal_humidity":
            target_h = 94.0
        s.humidity = float(np.clip(s.humidity + 0.16 * (target_h - s.humidity) + float(self.rng.normal(0.0, 0.3)), 15.0, 99.0))

        # Sensor readings
        reported: float | None = round(s.temperature + float(self.rng.normal(0.0, 0.04)), 2)
        sensor_health = "healthy"
        if kind == "sensor_anomaly":
            reported, sensor_health = self._corrupt_reading(reported)

        reading = {
            "timestamp": self.time,
            "zone_id": cfg.zone_id,
            "sensor_id": cfg.sensor_id,
            "temperature": reported,
            "humidity": round(s.humidity, 1),
            "compressor_status": comp_status_str,
            "compressor_load_pct": round(compressor_load_pct, 1),
            "power_consumption_kw": power_kw,
            "sensor_health": sensor_health,
            "door_status": "open" if s.door_open else "closed",
            "door_open_duration_seconds": s.door_open_seconds,
            "time_since_closure_seconds": s.time_since_closure_seconds,
            "cumulative_open_seconds_24h": s.cumulative_open_seconds_24h,
            "ambient_temperature": round(s.ambient, 2),
            "scenario": kind,
            "residual_rise_predicted": s.residual_rise_predicted,
            "peak_temp_predicted": s.peak_temp_predicted,
            "recovery_time_minutes": s.recovery_time_minutes,
            "recovery_progress_pct": s.recovery_progress_pct,
            "recovery_phase": s.recovery_phase,
            "true_temperature": round(s.temperature, 3),
            "is_synthetic": True,
        }
        s.scenario_minutes += 1
        self.time += timedelta(minutes=1)
        return reading

    def _corrupt_reading(self, reported: float) -> tuple[float | None, str]:
        s = self.state
        m = s.scenario_minutes
        if m < 12:
            if m % 3 == 1:
                sign = 1.0 if self.rng.random() < 0.7 else -1.0
                return round(reported + sign * float(self.rng.uniform(5.0, 8.0)), 2), "spike_anomaly"
            return reported, "healthy"
        if m < 22:
            return (None, "missing") if m % 2 == 0 else (reported, "healthy")
        if s.stuck_value is None:
            s.stuck_value = reported
        return s.stuck_value, "stuck_frozen"

    def run(self, minutes: int) -> list[dict[str, Any]]:
        return [self.step() for _ in range(minutes)]
