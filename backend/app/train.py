"""Train (or retrain) the forecasting and anomaly models.

Usage:  python -m app.train [--days 12] [--seed 42]
"""
from __future__ import annotations

import argparse
import json
import logging

from app.config import settings
from app.models.registry import train_all


def main() -> None:
    parser = argparse.ArgumentParser(description="Train ColdGuard AI models on simulated data")
    parser.add_argument("--days", type=int, default=12, help="Days of simulated history per zone")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    bundle = train_all(settings.artifacts_dir, days=args.days, seed=args.seed)
    m = bundle.forecaster.metrics if bundle.forecaster else {}
    print("\nHeld-out MAE (°C) on SIMULATED data:")
    print(f"{'horizon':>8} {'model':>8} {'persist':>8} {'trend':>8}")
    for row in m.get("horizons", []):
        print(f"{row['horizon_minutes']:>6}m {row['mae_model']:>8.3f} {row['mae_persistence']:>8.3f} {row['mae_trend']:>8.3f}")
    print("\n30-min excursion warning:", json.dumps(m.get("excursion_warning_30min", {}), indent=2))


if __name__ == "__main__":
    main()
