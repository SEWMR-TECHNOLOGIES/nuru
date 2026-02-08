import hashlib
import secrets
import jwt
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from core.config import ACCESS_TOKEN_EXPIRE_MINUTES, ALGORITHM, REFRESH_TOKEN_EXPIRE_DAYS, SECRET_KEY
from models.users import User
from fastapi import Depends, HTTPException, Request, Cookie
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.database import get_db

security = HTTPBearer()

def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session_cookie: str = Cookie(None, alias="session_id"),
    db: Session = Depends(get_db)
):
    """
    Retrieve the current user either via JWT token or session cookie.
    Priority: JWT token > session cookie
    """
    user = None

    # First, try JWT token
    if credentials:
        token = credentials.credentials
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("uid")
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token has expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

    # Fallback to session cookie
    if not user and session_cookie:
        user = db.query(User).filter(User.id == session_cookie).first()

    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User account is inactive")

    return user

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token

def get_user_by_credential(db: Session, credential: str):
    return db.query(User).filter(
        (User.email == credential) |
        (User.phone == credential) |
        (User.username == credential)
    ).first()


def create_refresh_token(data: dict, expires_delta: timedelta = None):
    """
    Create a JWT refresh token.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return token


def verify_refresh_token(token: str):
    """
    Verify a refresh token. Returns payload if valid, else None.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def generate_reset_token() -> tuple[str, str]:
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    return raw_token, token_hash

def is_token_expired(expires_at: datetime) -> bool:
    return datetime.utcnow() > expires_at