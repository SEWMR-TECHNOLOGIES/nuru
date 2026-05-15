# core/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool  # kept for backwards-compat imports
from . import config

# 1. Create the SQLAlchemy engine
# Pool sized for a multi-worker Gunicorn deployment on a 2-4 core VPS.
# Defaults give each worker 10 base connections + 20 overflow before queueing.
# Override per-environment via env vars to stay under Postgres' max_connections.
_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "10"))

engine = create_engine(
    config.DATABASE_URL,
    echo=False, future=True,
    pool_size=_POOL_SIZE, max_overflow=_MAX_OVERFLOW,
    pool_timeout=_POOL_TIMEOUT, pool_recycle=1800,
    pool_pre_ping=True,
)

# 2. Create the configured SessionLocal class
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# 3. Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
