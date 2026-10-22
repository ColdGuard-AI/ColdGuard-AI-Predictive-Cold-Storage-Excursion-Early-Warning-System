"""ColdGuard AI - FastAPI entry point.

Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api.routes import router
from app.api.auth_routes import router as auth_router
from app.api.stream_routes import router as stream_router
from app.config import Settings, settings
from app.database.db import Database
from app.models.registry import ModelBundle, load_or_train
from app.services.monitor import MonitoringService

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def create_app(cfg: Settings = settings, models: ModelBundle | None = None, autostart: bool | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        bundle = models or load_or_train(cfg.artifacts_dir)
        db = Database(cfg.db_path)
        monitor = MonitoringService(cfg, bundle, db)
        monitor.initialize()
        app.state.monitor = monitor
        if cfg.autostart_simulator if autostart is None else autostart:
            monitor.start_background()
        yield
        await monitor.stop_background()
        monitor.db.close()

    app = FastAPI(
        title="ColdGuard AI API",
        version=__version__,
        description=(
            "Predictive cold-storage excursion & early-warning system (hackathon prototype). "
            "**All sensor data is simulated.** Forecasts come from a Random Forest trained on simulated data; "
            "risk scores are a documented heuristic."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(KeyError)
    async def key_error_handler(_: Request, exc: KeyError) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": f"Not found: {exc}"})

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception) -> JSONResponse:
        logging.getLogger("coldguard.api").exception("Unhandled error")
        return JSONResponse(status_code=500, content={"detail": f"Internal error: {type(exc).__name__}: {exc}"})

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {"name": "ColdGuard AI", "tagline": "Predict Before It Spoils.", "docs": "/docs", "data": "simulated"}

    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(stream_router)
    return app


app = create_app()
