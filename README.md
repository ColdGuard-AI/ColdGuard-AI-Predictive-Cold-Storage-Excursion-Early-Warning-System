# ColdGuard AI

**Predict Before It Spoils.** A predictive cold-storage excursion and early-warning system.

Built for **CODE APEX, Track 4: Technology for Social Impact**.

> ⚠️ **This is a prototype that runs on simulated data.** Every sensor reading comes from a built-in simulator, and the forecasting model is trained and evaluated only on that simulated data. Nothing here is validated for real-world, medical, pharmaceutical or food-safety decisions.

---

## 1. Problem

Cold rooms for vaccines, dairy and frozen food must stay inside a narrow temperature band. Most monitoring systems raise an alarm only **after** a limit is crossed. By then product may already be compromised, and staff have little time to react. The cost shows up as spoilage, financial loss and safety risk.

## 2. Solution & innovation

ColdGuard AI watches each storage zone continuously and acts on the **forecast** as well as the current reading:

* **Forecasting.** A Random Forest model predicts temperature 5–60 minutes ahead and raises an early warning *before* the limit is breached.
* **Explainable risk.** A documented 0–100 risk score lists exactly which factors contribute: the forecast, the trend, the compressor, the door and sensor health.
* **Sensor-health checks.** Rule-based checks plus an Isolation Forest catch spikes, missing data and stuck sensors, so a faulty probe isn't trusted blindly.
* **Actionable alerts.** Every alert carries a recommendation tied to the observed condition. Alerts are de-duplicated, have a cooldown and can be acknowledged.
* **What-If simulator.** A plain-language "What happens if…?" tool. Pick a room, a situation ("the cooling stops", "someone leaves the door open", "it gets very hot outside") and a duration. You get a direct answer: whether products stay safe, how long until they're at risk, and how much warning you'd get. Technical numbers are tucked under "Technical details".
* **Storage Manager dashboard.** A live floor plan of the facility. Each room shows its thermometer against the safe band, a cooling unit that spins while running, a door that swings open on the wall, a last-hour sparkline and a plain-language status ("All good", "Door left open", "Out of safe range"). Alongside it are facility KPIs, time-in-range compliance per room and a "Needs your review" list.
* **Authentication is out of scope for this branch.** Login and roles come from the team's login module. The API client exposes `setAuthToken()` in `frontend/src/services/api.ts` so that module can attach its token to every request.

In the demo scenario (compressor failure in Zone A), the early-warning alert fires about **25–30 simulated minutes before** the actual excursion.

## 3. Architecture

```
┌──────────────────────── React + Vite (TypeScript, Tailwind, Recharts) ───────────────────────┐
│ Facility Overview · Live Monitor · Zones · Sensor History · Alerts · What-If · Model & Method │
│ polls REST API every 2 s                                                                      │
└───────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                                │ /api (Vite proxy in dev, CORS configured)
┌───────────────────────────────────────────────▼──────────────────────────────────────────────┐
│ FastAPI                                                                                       │
│  background loop: every tick (1 s) = 1 simulated minute                                       │
│   Simulator (3 zones) ──► SQLite readings ──► Features ──► RF forecast (+ tree quantiles)     │
│                                              └──► Sensor checks (rules + Isolation Forest)    │
│                                                    ──► Heuristic risk score ──► Alert manager │
│  What-If: clones simulator state → projects baseline vs scenario → runs model per minute      │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 4. Technology stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3, Recharts, Lucide React, React Router |
| Backend  | Python 3.11+ (tested on 3.14), FastAPI, Pydantic v2, Uvicorn |
| ML       | scikit-learn (RandomForestRegressor, IsolationForest), pandas, NumPy |
| Storage  | SQLite (live readings and alerts); CSV (generated training data) |
| Tests    | pytest + FastAPI TestClient; Vitest |

No paid services, API keys or hardware are required.

## 5. Folder structure

```
ColdGuardAI/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app factory, CORS, lifespan, error handlers
│   │   ├── config.py            # env-var settings
│   │   ├── train.py             # `python -m app.train` CLI
│   │   ├── api/routes.py        # REST endpoints
│   │   ├── schemas/api.py       # Pydantic request/response models
│   │   ├── database/db.py       # SQLite repository
│   │   ├── simulator/           # zones, physics engine, history generator
│   │   ├── models/              # features, forecaster, anomaly detector, model registry
│   │   └── services/            # monitor (orchestrator), forecasting, risk, alerts, what-if
│   ├── tests/                   # 53 pytest tests
│   ├── artifacts/               # trained model + metrics + training CSV (auto-generated)
│   ├── data/                    # SQLite DB (auto-generated)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Layout, ui primitives, charts, alerts, FacilityMap, zone widgets
│   │   ├── pages/               # Manager (Facility Overview), Dashboard (Live Monitor), Zones, History, Alerts, WhatIf, Model
│   │   ├── hooks/               # usePolling, AppContext
│   │   ├── services/api.ts      # typed REST client
│   │   ├── types/api.ts
│   │   └── lib/format.ts
│   ├── package.json
│   └── vite.config.ts
├── README.md
└── .gitignore
```

## 6. Setup

Prerequisites: **Python 3.11+** and **Node.js 18+**.

### Backend

```bash
cd backend
python -m venv .venv
# Windows (PowerShell):   .venv\Scripts\Activate.ps1
# Windows (Git Bash):     source .venv/Scripts/activate
# macOS / Linux:          source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

## 7. Running

**Terminal 1: backend** (from `backend/`, with the venv active):

```bash
uvicorn app.main:app --port 8000
```

On the **first** start, the backend generates 12 simulated days of training data and trains the models. This takes about 20–60 s and the results are saved in `backend/artifacts/`. Later starts load the saved models. Each start also wipes the live database and seeds 4 hours of normal operation, so every demo begins from the same state.

**Terminal 2: frontend** (from `frontend/`):

```bash
npm run dev
```

Open **http://localhost:5173**. The dev server proxies `/api` to `http://127.0.0.1:8000`.

### API documentation

* Swagger UI: **http://localhost:8000/docs**
* ReDoc: http://localhost:8000/redoc

### Configuration (optional environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `COLDGUARD_TICK_SECONDS` | `1.0` | Real seconds per simulated minute |
| `COLDGUARD_SEED` | `7` | Seed for reproducible demos |
| `COLDGUARD_SEED_HISTORY_MINUTES` | `240` | Normal history generated on start |
| `COLDGUARD_ALERT_HORIZON` | `30` | Early-warning horizon (min) |
| `COLDGUARD_ALERT_COOLDOWN` | `20` | Alert cooldown (simulated min) |
| `COLDGUARD_CORS_ORIGINS` | localhost:5173,4173 | Allowed origins |
| `COLDGUARD_DB_PATH` / `COLDGUARD_ARTIFACTS_DIR` | `backend/data/…`, `backend/artifacts` | Storage paths |
| `VITE_API_BASE_URL` (frontend) | empty | Call the API directly instead of through the proxy |

To retrain manually: `python -m app.train --days 12 --seed 42` (from `backend/`).

## 8. Simulation scenarios

Scenarios are triggered through the API (the dashboard is the manager's view, so it has no simulator buttons). The easiest way is Swagger at http://localhost:8000/docs → `POST /api/simulator/scenario`, or from a terminal:

```bash
curl -X POST http://localhost:8000/api/simulator/scenario -H "Content-Type: application/json" -d "{\"zone_id\":\"zone-a\",\"scenario\":\"compressor_failure\"}"
curl -X POST http://localhost:8000/api/simulator/reset -H "Content-Type: application/json" -d "{\"mode\":\"scenario\"}"
```

`POST /api/simulator/control` sets speed and pause, and `POST /api/simulator/advance` fast-forwards.

| Scenario | What changes in the simulator |
|---|---|
| Normal Operation | Thermostat holds the setpoint, with brief routine door openings |
| Compressor Failure | Cooling stops, and temperature drifts toward ambient |
| Door Left Open | Extra air exchange with warm, humid air that exceeds cooling capacity |
| Ambient Temperature Increase | Ambient +18 °C over 15 min, and cooling capacity derates |
| Sensor Anomaly | The *reported* value spikes, then drops out, then freezes; the physical temperature is unaffected |

Scenarios change simulator **inputs**. Readings, charts, forecasts, risk and alerts all respond through the normal pipeline. 

Zones (illustrative limits): **Vaccine Store A** 2–8 °C, **Dairy Chiller B** 0–6 °C, **Frozen Store C** −25 to −15 °C.

## 9. How the prediction works

1. **Data prep.** Readings are sorted chronologically. Missing temperatures are forward-filled for feature computation, and their missingness is kept as a feature.
2. **Features.** These are: deviation from setpoint and upper limit, ambient gap, 1/5/15/30-minute changes, 15-min volatility, humidity, door open (and for how long), compressor on (and minutes off), and missing readings in the last 10 min.
3. **Model.** A multi-output `RandomForestRegressor` (80 trees) predicts the temperature change at 5, 10, …, 60 min ahead. Targets are the simulator's ground-truth temperature. This is possible only because the data is simulated, and it means the model learns to ignore sensor noise and spikes.
4. **Evaluation.** The split is chronological per zone (first 80 % train, last 20 % test) with a 60-minute embargo, so no training target overlaps the test period. The model is compared with a **persistence** baseline (no change) and a **linear-trend** baseline. Metrics appear on the *Model & Method* page and at `GET /api/model/metrics`.
5. **Excursion prediction.** The forecast is compared with the zone limits. An **early-warning alert** fires when the **75th percentile of the tree forecasts** crosses a limit within 30 min. Using the mean alone missed too many excursions on held-out data (recall ≈ 0.57); the upper-quartile rule raises recall to ≈ 0.87 at precision ≈ 0.70.
6. **Risk score (heuristic, not ML).** It sums five documented components: forecast proximity ≤ 40, current position ≤ 20, trend ≤ 15, equipment/door ≤ 20 and sensor ≤ 10. The total is capped at 100, and each contributing factor is shown with its points and an explanation.
7. **Anomalies.** Rules flag missing data, stuck values (15+ identical readings) and spikes (> 2.5 °C from the recent median). An Isolation Forest is used as a secondary signal (3+ of the last 10 readings unusual). While the sensor is suspicious, predicted-excursion alerts are suppressed.

### Current held-out results (simulated data, seed 42)

| Horizon | Model MAE | Persistence MAE | Trend MAE |
|---|---|---|---|
| 15 min | 0.14 °C | 0.29 °C | 0.30 °C |
| 30 min | 0.33 °C | 0.49 °C | 0.67 °C |
| 60 min | 0.65 °C | 0.78 °C | 1.54 °C |

30-minute breach warning: the warning rule scores F1 0.77 (P 0.70 / R 0.87). The simple trend baseline scores F1 0.77 (P 0.65 / R 0.94). On this simulated data, the trend baseline is competitive for *detecting* excursions; the model's advantage is much lower forecast error and earlier, less noisy forecasts. These numbers are reported as-is.

## 10. Limitations

* All data is simulated, so real-world accuracy is unknown. The simulator uses one thermal mass and a proportional thermostat.
* The forecast assumes current conditions persist. It cannot anticipate a door that will be opened later.
* The tree-spread band is an uncertainty indicator, not a calibrated confidence interval.
* The risk score is a hand-designed heuristic, not a probability.
* Single-process prototype: state lives in one FastAPI process with SQLite. Authentication is provided separately by the team login module.
* Timestamps come from a fast simulated clock (1 tick = 1 simulated minute).

## 11. Tests

```bash
# backend (from backend/, venv active), 53 tests incl. the full demo flow through the API
python -m pytest -q

# frontend (from frontend/)
npm test            # Vitest unit tests (API error handling, formatters, chart helpers)
npm run typecheck   # tsc
npm run build       # production build
```

Backend tests cover: simulator (reproducibility, every scenario, reset, duration), features with missing or unsorted data, training and baseline comparison, insufficient training data, save/load, forecast availability, risk scoring, sensor checks, alert rules, de-duplication, cooldown, escalation, acknowledgement, request validation (422/404), What-If, manager overview, and an end-to-end demo flow that asserts **the early warning precedes the actual excursion**.

## 12. 2-minute demo script

1. Run `uvicorn app.main:app --port 8000` and `npm run dev`, then open http://localhost:5173/manager. **Facility Overview** shows all three rooms green, 100% time in range and nothing to review.
2. Open http://localhost:8000/docs in a second window and run `POST /api/simulator/scenario` with `{"zone_id": "zone-a", "scenario": "compressor_failure"}`.
3. On **Facility Overview**, Vaccine Store A's cooling unit shows *Stopped* and the room turns red with "Cooling has stopped". The thermometer rises, and a *Compressor Failure* alert appears under "Needs your review".
4. In **Live Monitor**, the dashed forecast bends up toward the 8 °C limit and the risk score climbs. "Why this risk score?" lists the forecast, trend and compressor factors.
5. After about 10 s (≈10 simulated min), the amber **Early warning: excursion predicted in ~N min** banner appears while the room is still below 8 °C. The actual *High Temperature* alert follows about 25–30 s later.
6. Open an alert to see its explanation and recommended action, then **Acknowledge** it.
7. Open **What-If Simulator**, choose *The cooling stops* and *1 hour*, then click **Show me what happens**. You get a plain answer: products at risk in N min, and how early ColdGuard would warn.
8. Reset with `POST /api/simulator/reset` and `{"mode": "scenario"}`; the room recovers in about 30 simulated minutes. `{"mode": "full"}` restarts everything.
