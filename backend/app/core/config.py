# core/config.py
import os
from dotenv import load_dotenv

load_dotenv()

DEBUG = os.getenv("DEBUG") == "True"
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT")
DB_NAME = os.getenv("DB_NAME")
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?sslmode=require"
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
SEWMR_SMS_BASE_URL = os.getenv("SEWMR_SMS_BASE_URL", "https://api.sewmrsms.co.tz/api/v1/")
SEWMR_SMS_ACCESS_TOKEN = os.getenv("SEWMR_SMS_ACCESS_TOKEN", "")
SEWMR_SMS_DEFAULT_SENDER_ID = os.getenv("SEWMR_SMS_DEFAULT_SENDER_ID", "")
