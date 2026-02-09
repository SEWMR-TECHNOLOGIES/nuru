# core/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from . import config  

# 1. Create the SQLAlchemy engine
engine = create_engine(
    config.DATABASE_URL,
    echo=False,
    future=True,
    poolclass=NullPool,
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
