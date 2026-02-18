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
UPLOAD_SERVICE_URL = "https://data.sewmrtechnologies.com/handle-file-uploads"
DELETE_SERVICE_URL = "https://data.sewmrtechnologies.com/delete-file.php"
MAX_IMAGE_SIZE = 500 * 1024 # 0.5MB
MAX_SERVICE_IMAGES = 4
MAX_EVENT_IMAGES = 3
ALLOWED_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "avif"}
ALLOWED_UPLOAD_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "mp4", "mov", "avi"}
MAX_KYC_FILE_SIZE = 1 * 1024 * 1024
MAX_FILES_PER_KYC = 3
REFRESH_TOKEN_EXPIRE_DAYS = 30  # 30 days
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
RESET_TOKEN_EXPIRE_MINUTES = 10
MOMENT_EXPIRY_HOURS = 24