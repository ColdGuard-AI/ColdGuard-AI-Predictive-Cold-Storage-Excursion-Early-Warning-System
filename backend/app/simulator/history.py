"""Synthetic history generation for model training and for seeding a fresh demo."""
from __future__ import annotations

from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from .engine import Scenario, ZoneSimulator
from .zones import ZONES, ZoneConfig

TRAINING_START = datetime(2026, 1, 1, 0, 0)


def generate_zone_history(
    config: ZoneConfig,
    minutes: int,
    seed: int,
    start_time: datetime = TRAINING_START,
    with_episodes: bool = True,
) -> pd.DataFrame:
    """Simulate ``minutes`` of readings for one zone.

    With ``with_episodes`` the history contains randomly placed incidents (door left open,
    compressor failures, ambient heat waves, sensor faults) separated by normal operation,
    so the forecasting model sees both steady-state and excursion dynamics.
    """
    sim = ZoneSimulator(config, seed=seed, start_time=start_time)
    rng = np.random.default_rng(seed + 10_000)
    rows: list[dict] = []
    next_episode = int(rng.integers(120, 360))
    t = 0
    while t < minutes:
        if with_episodes and t >= next_episode and sim.scenario == "normal":
            kind = str(rng.choice(
                ["compressor_failure", "door_open", "ambient_increase", "sensor_anomaly"],
                p=[0.32, 0.32, 0.22, 0.14],
            ))
            duration = {
                "compressor_failure": int(rng.integers(15, 100)),
                "door_open": int(rng.integers(8, 70)),
                "ambient_increase": int(rng.integers(45, 200)),
                "sensor_anomaly": int(rng.integers(15, 45)),
            }[kind]
            sim.set_scenario(Scenario(kind=kind, duration_minutes=duration, ambient_delta=float(rng.uniform(8.0, 22.0))))
            # Leave time to recover before the next incident.
            next_episode = t + duration + int(rng.integers(150, 480))
        rows.append(sim.step())
        t += 1
    return pd.DataFrame(rows)


def generate_training_dataset(days: int = 12, seed: int = 42) -> pd.DataFrame:
    frames = []
    for i, config in enumerate(ZONES.values()):
        frames.append(generate_zone_history(config, minutes=days * 24 * 60, seed=seed + i * 101))
    return pd.concat(frames, ignore_index=True)


def seed_live_history(config: ZoneConfig, sim: ZoneSimulator, minutes: int) -> list[dict]:
    """Warm up a live simulator with normal-operation history ending at its current clock."""
    sim.time = sim.time - timedelta(minutes=minutes)
    return sim.run(minutes)
