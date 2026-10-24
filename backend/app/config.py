"""Application configuration, read from environment variables with sensible defaults."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


@dataclass
class Settings:
    # Path to the SQLite database holding live readings and alerts.
    db_path: Path = field(default_factory=lambda: Path(os.getenv("COLDGUARD_DB_PATH", BACKEND_DIR / "data" / "coldguard.db")))
    # Directory holding the trained model, metrics and training CSV.
    artifacts_dir: Path = field(default_factory=lambda: Path(os.getenv("COLDGUARD_ARTIFACTS_DIR", BACKEND_DIR / "artifacts")))
    # Real seconds between simulator ticks. Each tick advances the simulated clock by one minute.
    tick_seconds: float = field(default_factory=lambda: _env_float("COLDGUARD_TICK_SECONDS", 1.0))
    # Start the background simulator loop automatically.
    autostart_simulator: bool = field(default_factory=lambda: _env_bool("COLDGUARD_AUTOSTART", True))
    # Minutes of normal-operation history generated on a fresh start.
    seed_history_minutes: int = field(default_factory=lambda: _env_int("COLDGUARD_SEED_HISTORY_MINUTES", 240))
    # Random seed used for reproducible demos.
    seed: int = field(default_factory=lambda: _env_int("COLDGUARD_SEED", 7))
    # Comma separated CORS origins.
    cors_origins: list[str] = field(
        default_factory=lambda: [
            o.strip()
            for o in os.getenv(
                "COLDGUARD_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
            ).split(",")
            if o.strip()
        ]
    )
    # Forecast horizon (minutes) used for early-warning alerts.
    alert_horizon_minutes: int = field(default_factory=lambda: _env_int("COLDGUARD_ALERT_HORIZON", 30))
    # Simulated minutes before an identical alert can be re-raised after it cleared.
    alert_cooldown_minutes: int = field(default_factory=lambda: _env_int("COLDGUARD_ALERT_COOLDOWN", 20))
    # MQTT broker settings
    mqtt_broker_host: str = field(default_factory=lambda: os.getenv("MQTT_BROKER_HOST", "127.0.0.1"))
    mqtt_broker_port: int = field(default_factory=lambda: _env_int("MQTT_BROKER_PORT", 1883))
    mqtt_topic: str = field(default_factory=lambda: os.getenv("MQTT_TOPIC", "coldguard/telemetry/+"))
    mqtt_username: str | None = field(default_factory=lambda: os.getenv("MQTT_USERNAME"))
    mqtt_password: str | None = field(default_factory=lambda: os.getenv("MQTT_PASSWORD"))
    mqtt_use_tls: bool = field(default_factory=lambda: _env_bool("MQTT_USE_TLS", False))
    # Blockchain settings
    blockchain_difficulty: int = field(default_factory=lambda: _env_int("BLOCKCHAIN_DIFFICULTY", 1))
    blockchain_batch_size: int = field(default_factory=lambda: _env_int("BLOCKCHAIN_BATCH_SIZE", 5))


settings = Settings()
