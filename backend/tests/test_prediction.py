import numpy as np
import pandas as pd
import pytest

from app.models.features import FEATURE_COLUMNS, FORECAST_STEPS, build_features, build_targets, prepare_readings
from app.models.forecaster import InsufficientDataError, TemperatureForecaster, train_and_evaluate
from app.services.forecasting import first_crossing, forecast_from_history
from app.simulator.zones import ZONES

ZONE = ZONES["zone-a"]


def _frame(temps, door="closed", comp="running"):
    n = len(temps)
    return pd.DataFrame({
        "timestamp": pd.date_range("2026-01-01", periods=n, freq="min"),
        "zone_id": "zone-a", "sensor_id": "TS-A01",
        "temperature": temps, "humidity": [50.0] * n, "compressor_status": [comp] * n,
        "door_status": [door] * n, "ambient_temperature": [25.0] * n, "scenario": ["normal"] * n,
    })


def test_features_handle_missing_values_and_unsorted_input():
    df = _frame([5.0, None, 5.2, None, None, 5.5] * 10).sample(frac=1, random_state=0)
    prepared = prepare_readings(df)
    assert prepared["timestamp"].is_monotonic_increasing
    feats = build_features(prepared, ZONE)
    assert list(feats.columns) == FEATURE_COLUMNS
    assert not feats.isna().any().any()
    assert feats["missing_10"].max() > 0


def test_run_length_features():
    feats = build_features(_frame([5.0] * 10, door="open", comp="stopped"), ZONE)
    assert feats["door_open_minutes"].iloc[-1] == 10
    assert feats["compressor_off_minutes"].iloc[-1] == 10
    assert feats["compressor_on"].iloc[-1] == 0


def test_targets_are_future_deltas():
    df = _frame([float(i) for i in range(80)])
    df["true_temperature"] = df["temperature"]
    targets = build_targets(prepare_readings(df))
    assert targets["h5"].iloc[0] == pytest.approx(5.0)
    assert np.isnan(targets["h60"].iloc[-1])


def test_model_beats_persistence_baseline_on_held_out_data(models):
    metrics = models.forecaster.metrics
    by_h = {row["horizon_minutes"]: row for row in metrics["horizons"]}
    for h in (15, 30, 60):
        assert by_h[h]["mae_model"] < by_h[h]["mae_persistence"]
    assert metrics["n_test_samples"] > 0 and metrics["n_train_samples"] > 0
    assert "SIMULATED" in metrics["data_source"]
    assert metrics["excursion_warning_30min"]["model_warning_rule"]["recall"] is not None


def test_training_rejects_insufficient_data(training_df):
    small = training_df.groupby("zone_id").head(200)
    with pytest.raises(InsufficientDataError):
        train_and_evaluate(small, n_estimators=5)


def test_forecaster_save_and_load_roundtrip(models, tmp_path):
    models.forecaster.save(tmp_path)
    loaded = TemperatureForecaster.load(tmp_path)
    X = pd.DataFrame([np.zeros(len(FEATURE_COLUMNS))], columns=FEATURE_COLUMNS)
    np.testing.assert_allclose(loaded.predict_deltas(X), models.forecaster.predict_deltas(X))


def test_quantile_prediction_matches_mean(models):
    X = pd.DataFrame([np.zeros(len(FEATURE_COLUMNS))], columns=FEATURE_COLUMNS)
    mean, qs = models.forecaster.predict_quantiles(X, (10, 90))
    np.testing.assert_allclose(mean, models.forecaster.predict_deltas(X), atol=1e-4)
    assert (qs[10] <= qs[90] + 1e-9).all()


def test_forecast_rises_when_compressor_is_stopped(monitor):
    monitor.set_scenario("zone-a", "compressor_failure")
    monitor.advance(8)
    fc = monitor.forecast("zone-a", 60)
    assert fc["available"]
    temps = [p["temperature"] for p in fc["points"]]
    assert len(temps) == len(FORECAST_STEPS)
    assert temps[-1] > temps[0] > fc["base_temperature"]
    assert all(p["lower"] <= p["upper"] for p in fc["points"])


def test_forecast_horizon_filters_points(monitor):
    assert len(monitor.forecast("zone-a", 15)["points"]) == 3
    assert len(monitor.forecast("zone-a", 30)["points"]) == 6


def test_forecast_unavailable_without_model_or_data(models):
    assert forecast_from_history(_frame([5.0] * 40), ZONE, None)["available"] is False
    assert forecast_from_history(_frame([5.0] * 2), ZONE, models.forecaster)["available"] is False
    assert forecast_from_history(_frame([None] * 40), ZONE, models.forecaster)["available"] is False
    short = forecast_from_history(_frame([5.0] * 10), ZONE, models.forecaster)
    assert short["available"] and short["limited_history"]


def test_first_crossing_interpolates():
    ttb, side = first_crossing(7.0, [7.5, 8.5], [5, 10], 2.0, 8.0)
    assert side == "upper" and ttb == pytest.approx(7.5)
    assert first_crossing(5.0, [5.1, 5.2], [5, 10], 2.0, 8.0) == (None, None)
    assert first_crossing(3.0, [1.0], [5], 2.0, 8.0)[1] == "lower"
