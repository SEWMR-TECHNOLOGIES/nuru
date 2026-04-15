# core/test_connection.py
from sqlalchemy import text
from database import engine

try:
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        print("Database connection successful:", result.scalar())
except Exception as e:
    print("Database connection failed:", e)
