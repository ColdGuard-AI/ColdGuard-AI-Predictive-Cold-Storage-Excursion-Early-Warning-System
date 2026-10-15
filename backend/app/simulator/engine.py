"""Physics-inspired cold-room sensor simulator.

Each call to :meth:`ZoneSimulator.step` advances the simulated clock by one minute and
returns one sensor reading. Temperature follows a simple lumped thermal model:

    dT/dt = k_leak * (T_amb - T) + door * k_door * (T_amb - T) - cooling + noise

where ``cooling`` comes from a proportional thermostat that is capped by the unit's
capacity (which degrades when the ambient temperature rises). Scenarios modify the
inputs (door, compressor, ambient, sensor) rather than the displayed numbers, so every
chart, forecast, risk score and alert downstream is driven by generated time-series data.

All data produced here is SIMULATED.
"""
from __future__ import annotations

import copy
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

import numpy as np

from .zones import ZoneConfig

SCENARIOS: dict[str, str] = {
    "normal": "Normal Operation",
    "door_open": "Door Left Open",
    "compressor_failure": "Compressor Failure",
    "ambient_increase": "Ambient Temperature Increase",
    "sensor_anomaly": "Sensor Anomaly",
}

# Capacity loss of the refrigeration unit per °C of ambient above its design ambient.
CAPACITY_DERATE_PER_DEG = 0.035
DEFAULT_AMBIENT_DELTA = 18.0
AMBIENT_RAMP_MINUTES = 15


@dataclass
class Scenario:
    kind: str = "normal"
    # Minutes after which the scenario ends by itself (None = until reset).
    duration_minutes: int | None = None
    # Ambient increase in °C for the ``ambient_increase`` scenario.
    ambient_delta: float = DEFAULT_AMBIENT_DELTA

    def __post_init__(self) -> None:
        if self.kind not in SCENARIOS:
            raise ValueError(f"Unknown scenario '{self.kind}'. Valid: {', '.join(SCENARIOS)}")


@dataclass
class ZoneState:
    temperature: float  # true (physical) air temperature
    humidity: float
    ambient: float
    compressor_on: bool = True
    door_open: bool = False
    routine_door_remaining: int = 0
    ambient_noise: float = 0.0
    scenario: Scenario = field(default_factory=Scenario)
    scenario_minutes: int = 0
    stuck_value: float | None = None


class ZoneSimulator:
    def __init__(
        self,
        config: ZoneConfig,
        seed: int,
        start_time: datetime,
        routine_door_openings: bool = True,
    ) -> None:
        self.config = config
        self.rng = np.random.default_rng(seed)
        self.time = start_time
        self.routine_door_openings = routine_door_openings
        self.state = ZoneState(
            temperature=config.setpoint,
            humidity=config.humidity_base,
            ambient=config.ambient_base,
        )

    # ------------------------------------------------------------------ control
    def set_scenario(self, scenario: Scenario | str) -> None:
        if isinstance(scenario, str):
            scenario = Scenario(kind=scenario)
        self.state.scenario = scenario
        self.state.scenario_minutes = 0
        self.state.stuck_value = None
        if scenario.kind == "normal":
            self.state.door_open = False
            self.state.routine_door_remaining = 0

    @property
    def scenario(self) -> str:
        return self.state.scenario.kind

    def clone(self, seed: int | None = None) -> "ZoneSimulator":
        """Deep copy used by the What-If simulator so projections never touch live state."""
        twin = copy.deepcopy(self)
        if seed is not None:
            twin.rng = np.random.default_rng(seed)
        return twin

    # ------------------------------------------------------------------ physics
    def _ambient(self, s: ZoneState) -> float:
        cfg = self.config
        hour = self.time.hour + self.time.minute / 60.0
        daily = 1.5 * math.sin(2 * math.pi * (hour - 9.0) / 24.0)
        s.ambient_noise = 0.97 * s.ambient_noise + self.rng.normal(0.0, 0.08)
        ambient = cfg.ambient_base + daily + s.ambient_noise
        if s.scenario.kind == "ambient_increase":
            ramp = min(1.0, (s.scenario_minutes + 1) / AMBIENT_RAMP_MINUTES)
            ambient += s.scenario.ambient_delta * ramp
        return ambient

    def step(self) -> dict[str, Any]:
        cfg, s = self.config, self.state
        kind = s.scenario.kind

        # Scenarios with a duration revert to normal operation on their own.
        if s.scenario.duration_minutes is not None and s.scenario_minutes >= s.scenario.duration_minutes:
            self.set_scenario("normal")
            kind = "normal"

        s.ambient = self._ambient(s)

        # Door: forced open by scenario, otherwise brief routine openings (loading/picking).
        if kind == "door_open":
            s.door_open = True
        else:
            if s.routine_door_remaining > 0:
                s.routine_door_remaining -= 1
            elif self.routine_door_openings and kind == "normal" and self.rng.random() < 1 / 75:
                s.routine_door_remaining = int(self.rng.integers(1, 3))
            s.door_open = s.routine_door_remaining > 0

        s.compressor_on = kind != "compressor_failure"

        # Thermal update.
        leak = cfg.k_leak * (s.ambient - s.temperature)
        door_leak = cfg.k_door * (s.ambient - s.temperature) if s.door_open else 0.0
        cooling = 0.0
        if s.compressor_on:
            derate = 1.0 - CAPACITY_DERATE_PER_DEG * max(0.0, s.ambient - cfg.ambient_base)
            capacity = cfg.cooling_max * min(1.0, max(0.3, derate))
            demand = cfg.k_leak * (cfg.ambient_base - cfg.setpoint) + cfg.kp * (s.temperature - cfg.setpoint)
            cooling = min(capacity, max(0.0, demand))
        s.temperature += leak + door_leak - cooling + self.rng.normal(0.0, 0.008)

        # Humidity relaxes toward a target; open doors and stopped compressors raise it.
        target_h = cfg.humidity_door if s.door_open else cfg.humidity_base
        if not s.compressor_on:
            target_h += 8.0
        s.humidity = float(np.clip(s.humidity + 0.15 * (target_h - s.humidity) + self.rng.normal(0.0, 0.3), 15.0, 99.0))

        reported: float | None = round(s.temperature + float(self.rng.normal(0.0, 0.04)), 2)
        if kind == "sensor_anomaly":
            reported = self._corrupt_reading(reported)

        reading = {
            "timestamp": self.time,
            "zone_id": cfg.zone_id,
            "sensor_id": cfg.sensor_id,
            "temperature": reported,
            "humidity": round(s.humidity, 1),
            "compressor_status": "running" if s.compressor_on else "stopped",
            "door_status": "open" if s.door_open else "closed",
            "ambient_temperature": round(s.ambient, 2),
            "scenario": kind,
            # Ground-truth temperature: only available because this is a simulation.
            "true_temperature": round(s.temperature, 3),
        }
        s.scenario_minutes += 1
        self.time += timedelta(minutes=1)
        return reading

    def _corrupt_reading(self, reported: float) -> float | None:
        """Sensor-anomaly scenario: spikes, then dropouts, then a stuck (frozen) value."""
        s = self.state
        m = s.scenario_minutes
        if m < 12:
            if m % 3 == 1:
                sign = 1.0 if self.rng.random() < 0.7 else -1.0
                return round(reported + sign * float(self.rng.uniform(5.0, 8.0)), 2)
            return reported
        if m < 22:
            return None if m % 2 == 0 else reported
        if s.stuck_value is None:
            s.stuck_value = reported
        return s.stuck_value

    def run(self, minutes: int) -> list[dict[str, Any]]:
        return [self.step() for _ in range(minutes)]
