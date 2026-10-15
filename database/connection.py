"""
ColdGuard AI Database Connection & Session Configuration
Supports PostgreSQL / TimescaleDB (Time-series) with automatic SQLite fallback
"""

import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("coldguard.database")

# Environment configurations
DB_DIR = os.path.dirname(os.path.abspath(__file__))
SQLITE_DB_PATH = os.getenv("COLDGUARD_DB_PATH", os.path.join(DB_DIR, "coldguard.db"))
SQLITE_URL = f"sqlite:///{SQLITE_DB_PATH}"

# PostgreSQL / TimescaleDB URL (e.g. from environment or standard port 5432)
POSTGRES_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://coldguard:coldguard_secret@localhost:5432/coldguard_db"
)

# Attempt to connect to PostgreSQL/TimescaleDB first; fallback to SQLite
ACTIVE_DB_TYPE = "sqlite"
engine = None

if os.getenv("FORCE_SQLITE", "0") != "1":
    try:
        pg_engine = create_engine(
            POSTGRES_URL, 
            pool_pre_ping=True, 
            connect_args={"connect_timeout": 2}
        )
        # Test connection
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine = pg_engine
        ACTIVE_DB_TYPE = "postgresql_timescale"
        logger.info("Successfully connected to PostgreSQL / TimescaleDB time-series database.")
    except Exception as e:
        logger.info(f"PostgreSQL/TimescaleDB not reachable locally ({e}). Operating in SQLite mode.")
        engine = None

if engine is None:
    engine = create_engine(
        SQLITE_URL,
        connect_args={"check_same_thread": False}
    )
    ACTIVE_DB_TYPE = "sqlite"

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """FastAPI Dependency for database session management"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_db_status():
    """Returns details on the active database driver"""
    return {
        "engine": ACTIVE_DB_TYPE,
        "is_timeseries_ready": True,
        "description": "PostgreSQL / TimescaleDB High-Volume Time-Series" if ACTIVE_DB_TYPE == "postgresql_timescale" else "SQLite (High-Performance Local Embedded)"
    }
